import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Fully mocks the subprocess boundary so these run without a real Tectonic
// install and stay fast/deterministic — they verify our wiring (the shared
// limiter, graceful failure handling), not the compiler itself.
vi.mock("node:child_process", () => ({ execFile: vi.fn() }));

const ORIGINAL_ENV = { ...process.env };
const MINIMAL_LATEX = "\\documentclass{article}\\begin{document}x\\end{document}";

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  vi.clearAllMocks();
});

describe("compileLatex concurrency limiter", () => {
  it("never runs more compiles at once than RESUME_COMPILE_CONCURRENCY allows", async () => {
    process.env.RESUME_COMPILE_CONCURRENCY = "2";
    vi.resetModules();
    const { compileLatex } = await import("../lib/latexCompile.ts");
    const { execFile } = await import("node:child_process");

    let active = 0;
    let maxActive = 0;
    (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_file: string, _args: string[], options: { cwd: string }, callback: (err: unknown) => void) => {
        active++;
        maxActive = Math.max(maxActive, active);
        setTimeout(() => {
          fs.writeFileSync(path.join(options.cwd, "input.pdf"), "%PDF-1.4 fake");
          active--;
          callback(null);
        }, 50);
      },
    );

    await Promise.all(
      Array.from({ length: 6 }, () => compileLatex(MINIMAL_LATEX)),
    );

    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBeGreaterThan(1); // sanity: tasks did overlap, limiter isn't accidentally serializing everything
  });

  it("returns { ok: false } instead of hanging or throwing when the compiler process fails", async () => {
    process.env.RESUME_COMPILE_CONCURRENCY = "4";
    vi.resetModules();
    const { compileLatex } = await import("../lib/latexCompile.ts");
    const { execFile } = await import("node:child_process");

    (execFile as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (_file: string, _args: string[], _options: unknown, callback: (err: unknown) => void) => {
        const err = Object.assign(new Error("Error: ETIMEDOUT"), { killed: true, signal: "SIGKILL" });
        callback(err);
      },
    );

    const result = await compileLatex(MINIMAL_LATEX);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.log.length).toBeGreaterThan(0);
    }
  });
});
