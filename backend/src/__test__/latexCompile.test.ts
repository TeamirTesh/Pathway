import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { compileLatex } from "../lib/latexCompile.ts";

function hasTectonic(): boolean {
  try {
    execFileSync(process.env.TECTONIC_BIN ?? "tectonic", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// These exercise the real `tectonic` binary end to end. Skipped on machines
// (or CI runners) that don't have it on PATH rather than failing the suite.
describe.skipIf(!hasTectonic())("compileLatex (real Tectonic)", () => {
  it("compiles a minimal valid document to a PDF", async () => {
    const result = await compileLatex(
      "\\documentclass{article}\\begin{document}Hello\\end{document}",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pdf.length).toBeGreaterThan(0);
      expect(result.pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");
    }
  });

  it("returns a non-empty compile log for a broken document", async () => {
    const result = await compileLatex(
      "\\documentclass{article}\\begin{document}\\undefinedcommand{oops}\\end{document}",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.log.length).toBeGreaterThan(0);
    }
  });
});
