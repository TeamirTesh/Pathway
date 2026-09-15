import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pLimit from "p-limit";

const execFileAsync = promisify(execFile);

const TECTONIC_BIN = process.env.TECTONIC_BIN ?? "tectonic";
const COMPILE_TIMEOUT_MS = Number(process.env.RESUME_COMPILE_TIMEOUT_MS) || 20_000;
const COMPILE_CONCURRENCY =
  Number(process.env.RESUME_COMPILE_CONCURRENCY) || Math.max(1, os.cpus().length - 1);

// Shared across every caller so a burst of preview renders and a
// generate-with-repair (2 compiles) all queue behind the same cap instead of
// each independently trying to run unbounded Tectonic processes.
const limit = pLimit(COMPILE_CONCURRENCY);

export type CompileResult = { ok: true; pdf: Buffer } | { ok: false; log: string };

async function readLogFallback(dir: string, err: unknown): Promise<string> {
  try {
    return await fs.readFile(path.join(dir, "input.log"), "utf8");
  } catch {
    if (err && typeof err === "object") {
      const e = err as { stderr?: string; stdout?: string; message?: string };
      return e.stderr || e.stdout || e.message || "Unknown compile error";
    }
    return "Unknown compile error";
  }
}

async function runTectonic(latex: string): Promise<CompileResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pathway-tex-"));
  try {
    await fs.writeFile(path.join(dir, "input.tex"), latex, "utf8");

    try {
      await execFileAsync(TECTONIC_BIN, ["--outdir", dir, "--keep-logs", "input.tex"], {
        cwd: dir,
        timeout: COMPILE_TIMEOUT_MS,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err) {
      const log = await readLogFallback(dir, err);
      return { ok: false, log };
    }

    const pdf = await fs.readFile(path.join(dir, "input.pdf"));
    return { ok: true, pdf };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function compileLatex(latex: string): Promise<CompileResult> {
  return limit(() => runTectonic(latex));
}
