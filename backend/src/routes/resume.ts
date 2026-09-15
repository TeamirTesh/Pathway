import { Router, Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthRequest } from "../middleware/requireAuth";
import { profileSchema, PROFILE_CONTENT_KEYS } from "../lib/resumeSchemas";
import { generateTailoredResume, repairResumeLatex, LlmGenerationError } from "../lib/llm";
import {
  BUILTIN_TEMPLATES,
  getBuiltinTemplate,
  isBuiltinTemplateId,
} from "../lib/resumeTemplates";

export const resumeRouter = Router();
resumeRouter.use(requireAuth);

const createSchema = z.object({
  label: z.string().min(1),
  latexSource: z.string().min(1),
  targetRole: z.string().optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  latexSource: z.string().min(1).optional(),
  targetRole: z.string().optional(),
});

const generateSchema = z.object({
  jobDescription: z.string().min(1),
  templateId: z.string().min(1),
  targetRole: z.string().optional(),
  label: z.string().optional(),
});

const EMPTY_PROFILE = {
  id: null,
  contact: [],
  summary: [],
  skills: [],
  experience: [],
  research: [],
  projects: [],
  involvement: [],
  education: [],
  sections: [],
  updatedAt: null,
};

// --- LaTeX compile service ---------------------------------------------------

const COMPILE_URL = "https://latex.ytotech.com/builds/sync";

type CompileResult = { ok: true; pdf: Buffer } | { ok: false; log: string };

async function compileLatex(latex: string): Promise<CompileResult> {
  const compileRes = await fetch(COMPILE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compiler: "pdflatex",
      resources: [{ main: true, content: latex }],
    }),
  });

  if (!compileRes.ok) {
    const log = await compileRes.text().catch(() => "");
    return { ok: false, log };
  }
  return { ok: true, pdf: Buffer.from(await compileRes.arrayBuffer()) };
}

// --- Profile ---------------------------------------------------------------

resumeRouter.get("/profile", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const profile = await prisma.resumeProfile.findUnique({ where: { userId } });
  res.json(profile ?? EMPTY_PROFILE);
});

resumeRouter.put("/profile", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const profile = await prisma.resumeProfile.upsert({
    where: { userId },
    create: { userId, ...parsed.data },
    update: { ...parsed.data },
  });
  res.json(profile);
});

// --- Templates -----------------------------------------------------------------

const templateBodySchema = z.object({
  name: z.string().trim().min(1, "Give the template a name"),
  latexSource: z.string().min(1, "Paste the template's LaTeX source"),
});

function looksLikeLatexDoc(s: string): boolean {
  return (
    s.includes("\\documentclass") &&
    s.includes("\\begin{document}") &&
    s.includes("\\end{document}")
  );
}

const NOT_A_DOC =
  "That doesn't look like a full LaTeX document — it needs \\documentclass and a \\begin{document} … \\end{document} body.";

function templateJson(row: { id: string; name: string; latexSource: string }) {
  return { id: row.id, name: row.name, latexSource: row.latexSource, builtin: false };
}

resumeRouter.get("/templates", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const rows = await prisma.resumeTemplate.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  res.json([...BUILTIN_TEMPLATES, ...rows.map(templateJson)]);
});

resumeRouter.post("/templates", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const parsed = templateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  if (!looksLikeLatexDoc(parsed.data.latexSource)) {
    res.status(400).json({ error: NOT_A_DOC });
    return;
  }
  const row = await prisma.resumeTemplate.create({ data: { userId, ...parsed.data } });
  res.status(201).json(templateJson(row));
});

resumeRouter.patch("/templates/:id", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  if (isBuiltinTemplateId(req.params.id)) {
    res.status(403).json({ error: "Built-in templates can't be edited." });
    return;
  }
  const parsed = templateBodySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  if (parsed.data.latexSource !== undefined && !looksLikeLatexDoc(parsed.data.latexSource)) {
    res.status(400).json({ error: NOT_A_DOC });
    return;
  }
  const existing = await prisma.resumeTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const row = await prisma.resumeTemplate.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(templateJson(row));
});

resumeRouter.delete("/templates/:id", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  if (isBuiltinTemplateId(req.params.id)) {
    res.status(403).json({ error: "Built-in templates can't be deleted." });
    return;
  }
  const existing = await prisma.resumeTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  await prisma.resumeTemplate.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

async function resolveTemplate(
  id: string,
  userId: string,
): Promise<{ source: string; name: string } | null> {
  if (isBuiltinTemplateId(id)) {
    const b = getBuiltinTemplate(id);
    return b ? { source: b.latexSource, name: b.name } : null;
  }
  const row = await prisma.resumeTemplate.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return null;
  return { source: row.latexSource, name: row.name };
}

// --- Resume versions ---------------------------------------------------------

async function getVersionForUser(id: string, userId: string, res: Response) {
  const version = await prisma.resumeVersion.findUnique({ where: { id } });
  if (!version) {
    res.status(404).json({ error: "Resume version not found" });
    return null;
  }
  if (version.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return version;
}

resumeRouter.get("/", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const versions = await prisma.resumeVersion.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  res.json(versions);
});

resumeRouter.post("/", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const version = await prisma.resumeVersion.create({
    data: { userId, ...parsed.data },
  });
  res.status(201).json(version);
});

resumeRouter.patch("/:id", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  const existing = await getVersionForUser(req.params.id, userId, res);
  if (!existing) return;

  const version = await prisma.resumeVersion.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(version);
});

resumeRouter.delete("/:id", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const existing = await getVersionForUser(req.params.id, userId, res);
  if (!existing) return;

  await prisma.resumeVersion.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

resumeRouter.post("/generate", async (req: Request, res: Response) => {
  const { userId } = req as AuthRequest;
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { jobDescription, templateId, targetRole, label } = parsed.data;

  const profileRow = await prisma.resumeProfile.findUnique({ where: { userId } });
  const profile = profileSchema.parse(profileRow ?? {});
  const isEmpty = PROFILE_CONTENT_KEYS.every((key) => profile[key].length === 0);
  if (isEmpty) {
    res.status(422).json({ error: "Complete your resume profile before generating a tailored resume." });
    return;
  }

  const template = await resolveTemplate(templateId, userId);
  if (!template) {
    res.status(422).json({ error: "Select a template before generating a resume." });
    return;
  }

  const warnings: string[] = [];
  let latexSource: string;
  let jobTitle: string;
  try {
    ({ latexSource, jobTitle } = await generateTailoredResume({
      profile,
      jobDescription,
      templateSource: template.source,
      targetRole,
    }));
  } catch (err) {
    if (err instanceof LlmGenerationError) {
      res.status(502).json({ error: err.message });
      return;
    }
    throw err;
  }

  // Best-effort: verify the output compiles, with one AI repair attempt.
  try {
    let compiled = await compileLatex(latexSource);
    if (!compiled.ok) {
      try {
        const repaired = await repairResumeLatex({ latexSource, compileLog: compiled.log });
        latexSource = repaired.latexSource;
        compiled = await compileLatex(latexSource);
      } catch {
        // keep the pre-repair source
      }
      if (!compiled.ok) {
        warnings.push(
          'The generated LaTeX did not compile cleanly. Open "Edit LaTeX" to fix it — the compiler error shows in the preview pane.',
        );
      }
    }
  } catch {
    warnings.push("Couldn't verify that the generated LaTeX compiles (the compile service was unreachable).");
  }

  const count = await prisma.resumeVersion.count({ where: { userId } });
  const version = await prisma.resumeVersion.create({
    data: {
      userId,
      label: label ?? `v${count + 1} — ${jobTitle}`,
      latexSource,
      targetRole,
      jobDescription,
      templateId,
      templateName: template.name,
    },
  });

  res.status(201).json({ ...version, warnings });
});

const renderSchema = z.object({
  latex: z.string().min(1),
});

resumeRouter.post("/render-pdf", async (req: Request, res: Response) => {
  const parsed = renderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }

  try {
    const result = await compileLatex(parsed.data.latex);
    if (!result.ok) {
      console.error("LaTeX compile error:", result.log);
      res.status(422).json({ error: "Failed to compile LaTeX to PDF", log: result.log.slice(0, 4000) });
      return;
    }
    res.setHeader("Content-Type", "application/pdf");
    res.send(result.pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reach LaTeX compile service" });
  }
});
