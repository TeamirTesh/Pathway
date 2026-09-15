import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "@/lib/api";

describe("Scenario 5: user generates a resume", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: "v1",
          userId: "u1",
          label: "Backend Engineer — Acme",
          latexSource: "\\documentclass{article}...",
          targetRole: "Backend Engineer",
          jobDescription: "Looking for a backend engineer with Node.js experience",
          selectionDescriptor: {},
          createdAt: "2026-07-21T00:00:00.000Z",
          warnings: [],
        }),
      })
    ) as unknown as typeof fetch;
  });

  it("posts the job description and the chosen template, and creates a new resume version", async () => {
    const { warnings, ...version } = await api.resume.generate({
      jobDescription: "Looking for a backend engineer with Node.js experience",
      templateId: "builtin:jake",
    });

    const [url, options] = (global.fetch as any).mock.calls[0];
    expect(url).toContain("/api/resume/generate");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toMatchObject({
      jobDescription: "Looking for a backend engineer with Node.js experience",
      templateId: "builtin:jake",
    });
    expect(version.id).toBe("v1");
    expect(version.label).toBe("Backend Engineer — Acme");
  });

  it("passes an optional target role through to the request", async () => {
    await api.resume.generate({
      jobDescription: "Looking for a backend engineer with Node.js experience",
      templateId: "builtin:jake",
      targetRole: "Backend Engineer",
    });

    const [, options] = (global.fetch as any).mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({ targetRole: "Backend Engineer" });
  });

  it("surfaces selection warnings returned alongside the new version", async () => {
    (global.fetch as any) = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          id: "v2",
          userId: "u1",
          label: "Backend Engineer — Acme",
          latexSource: "\\documentclass{article}...",
          targetRole: "Backend Engineer",
          jobDescription: "Looking for a backend engineer",
          selectionDescriptor: {},
          createdAt: "2026-07-21T00:00:00.000Z",
          warnings: ["The generated LaTeX did not compile cleanly."],
        }),
      })
    );

    const { warnings } = await api.resume.generate({
      jobDescription: "Looking for a backend engineer",
      templateId: "builtin:jake",
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("did not compile");
  });
});
