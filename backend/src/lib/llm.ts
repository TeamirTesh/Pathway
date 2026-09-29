import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ResumeProfileData } from "./resumeSchemas";
import { importedProfileSchema, ImportedProfile } from "./resumeImportSchema";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export class LlmGenerationError extends Error {}

const SYSTEM_PROMPT = `You are a resume tailoring assistant. You are given three things:
1. A user's full resume content as JSON (the "profile").
2. A job description.
3. A LaTeX resume template — a complete, compilable .tex document with placeholder content.

Your job: produce a COMPLETE LaTeX document that looks exactly like the template but contains the user's real content, selected and ordered for this specific job.

TEMPLATE FIDELITY
- Keep the template's \\documentclass, every \\usepackage, the whole preamble, and every custom \\newcommand / \\renewcommand EXACTLY as given. Do not add or remove packages or macros.
- Build each entry with the same custom commands the template uses (e.g. \\resumeSubheading, \\resumeProjectHeading, \\resumeItem, the itemize wrappers). Match its structure for the header, section headings, and spacing.
- The output must compile with pdflatex with no changes.

STRUCTURAL CONSISTENCY — the same field must look the same everywhere
- Once you decide how to lay out a piece of repeatable, optional data within one entry of a section, use that EXACT same layout for every other entry in that section that has the same data. Never improvise a different arrangement for a later entry of the same kind.
- Concrete example: say you place a degree's GPA at the right edge of the same row as the school/degree line — right-aligned, on the same line, without pushing the left-aligned school/degree text onto a new line. If the profile has two degrees and both have a GPA, the second (e.g. a Master's, even if it comes first or second in the list) must use that identical right-aligned-same-line placement too — not a bullet point, not a new line, not omitted. Whatever pattern you invent for the first instance of a field is now the pattern for every instance of that field in that section.
- This applies to every optional/repeated field across parallel entries, not just GPA: honors, coursework, dates, location, tech stack, links, etc. Pick one structural treatment per field per section and repeat it verbatim.

LENGTH — fill one page, never overflow
- The document must render to exactly one page. You will not see the compiled output, so this is the single most important constraint to self-check before finishing: mentally estimate how much vertical space your selected content will take at the template's own font size and margins, and cut content if you're not confident it fits.
- A one-page resume that looks sparse is a worse outcome than a tight one, but overflowing to a second page is the worse failure of the two — if you're unsure whether something fits, lean toward including one fewer bullet or entry rather than risking overflow.
- When the profile has enough relevant material and there's room, use the higher end of the ranges in SELECTION GUIDANCE (more bullets, more entries) so the page reads as full and substantial rather than sparse; use the lower end when there isn't.
- Never shrink the font size, margins, or any spacing command the template defines to force more content onto the page — control length by choosing how much content to include, not by altering the template's layout.

CONTENT RULES — never invent facts
- Every company, role, title, date, school, degree, project name, and bullet fact must come from the profile. Do not invent, embellish, or change numbers.
- You may omit, reorder, and lightly condense. You may NOT add.
- The ONLY prose you may write freely is the summary/objective: a fresh 1-3 sentence summary tailored to the job description. If the template has no summary area and the profile's section list doesn't include a visible "summary", skip it.
- Contact details (name, email, phone, location, links) come from the chosen contact variant — pick whichever contact variant's title/framing best fits the job. Render every link in profile.contact.links in the template's header style.

SELECTION GUIDANCE
- experience: keep the 3-5 most relevant roles, 2-4 bullets each — the ones that match the job.
- projects: the 2-3 most relevant. Each has { name, techStack, links, bullets } — do not merge these into
  a paragraph. Render techStack next to the name the way the template's project heading already does
  (e.g. "\\textbf{name} $|$ \\emph{techStack}"), render each link the same way the template renders
  contact links, and drop each bullet in as its own \\resumeItem — select the most relevant few, but
  don't rewrite their wording.
- skills: only categories and items relevant to the job.
- research: include only if the job relates to research/security/policy/academia.
- involvement / leadership: include only if relevant.
- education: normally include all of it.

SECTION ORDER, TITLES, VISIBILITY
- profile.sections is an ordered list of { kind, title, visible }.
- Emit sections in that order. Skip any with visible === false.
- Use each section's "title" as the \\section{...} heading text (e.g. title "Leadership" for kind "involvement").
- Map kind -> profile data: summary -> the tailored summary; education -> profile.education; experience -> profile.experience; projects -> profile.projects; skills -> profile.skills; involvement -> profile.involvement; research -> profile.research.
- If profile.sections is empty, use a sensible default order: Education, Experience, Projects, Skills, then the rest.
- The contact block is always the header, regardless of the section list.

LATEX SAFETY
- Escape LaTeX special characters in all content: & % $ # _ ~ ^ (e.g. "R&D" -> "R\\&D", "20%" -> "20\\%"). Leave URLs inside \\href untouched.

OUTPUT FORMAT
- Line 1 exactly: ROLE: <a 2-5 word label for the target role, e.g. "Backend Engineer" or "Security Engineer, Stripe" — no quotes, no trailing period>
- From line 2 on: the complete LaTeX document, starting with \\documentclass and ending with \\end{document}.
- No markdown code fences. No commentary before or after.`;

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : "";
}

function stripFences(s: string): string {
  const t = s.trim();
  if (t.startsWith("```")) {
    return t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  }
  return t;
}

// Split the "ROLE: <label>" preamble line off the model's output.
function splitRoleAndLatex(raw: string): { jobTitle: string; latexSource: string } {
  const text = stripFences(raw);
  const match = text.match(/^\s*ROLE:\s*(.+?)\s*\r?\n/);
  if (match) {
    return { jobTitle: match[1].trim(), latexSource: text.slice(match[0].length).trim() };
  }
  return { jobTitle: "Tailored resume", latexSource: text };
}

function assertUsableLatex(latex: string): void {
  if (!latex.includes("\\documentclass") || !latex.includes("\\end{document}")) {
    throw new LlmGenerationError("The model did not return a complete LaTeX document.");
  }
}

export async function generateTailoredResume(input: {
  profile: ResumeProfileData;
  jobDescription: string;
  templateSource: string;
  targetRole?: string;
}): Promise<{ latexSource: string; jobTitle: string }> {
  const userContent = [
    `PROFILE (JSON):\n${JSON.stringify(input.profile, null, 2)}`,
    `JOB DESCRIPTION:\n${input.jobDescription}`,
    input.targetRole ? `TARGET ROLE (context): ${input.targetRole}` : null,
    `LATEX TEMPLATE:\n${input.templateSource}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") {
    throw new LlmGenerationError("The model declined to generate a resume for this job description.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new LlmGenerationError("The generated resume was too long to finish. Try a shorter job description or template.");
  }

  const { jobTitle, latexSource } = splitRoleAndLatex(extractText(response));
  assertUsableLatex(latexSource);
  return { jobTitle, latexSource };
}

const IMPORT_SYSTEM_PROMPT = `You extract structured resume data from raw pasted text (copied from a PDF, Word doc, or plain-text resume/CV). You will also be told whether the source is a "holistic" CV (meant to list everything the person has done) or a "one-page" resume (already trimmed down to their most relevant highlights for one target role).

Rules:
- Extract only what is actually written. Never invent a company, title, date, school, number, or bullet that isn't in the source text.
- Do not summarize or shorten bullets — carry them over close to verbatim, only cleaning up obvious copy/paste artifacts (stray line breaks, bullet glyphs, page numbers).
- If a field isn't present in the source (e.g. no GPA, no phone number), leave it as an empty string rather than guessing.
- Group flat skill lists into sensible categories (e.g. "Languages", "Frameworks", "Tools") based on how they're presented; if the source already has categories, keep them.
- contact: extract exactly one contact entry from the source (name, email, phone, location, title/headline if present, and every link — LinkedIn, GitHub, portfolio, etc. — each as its own { url, label } in "links").
- summary: if the source has an objective/summary paragraph, include it verbatim as one entry with key "main" and label "Summary". If there isn't one, return an empty array — do not invent one.
- projects: split each into { name, techStack, links, bullets } — don't leave it as one paragraph. "techStack" is usually the tech list next to the project name (often after a "|" or in italics/parentheses) as a single comma-separated line; "links" is any GitHub/demo/live-site link attached to that project; "bullets" is each distinct point about the project as its own array entry, not one merged description.
- Every array field defaults to empty if that section isn't present in the source. Return every section key even if empty.`;

export async function importResumeText(input: {
  rawText: string;
  mode: "holistic" | "one-page";
}): Promise<ImportedProfile> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(importedProfileSchema) },
    system: IMPORT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `This is a ${input.mode === "holistic" ? "holistic CV meant to list everything the person has done" : "one-page resume already trimmed to one target role — it likely does not represent everything the person has done"}. Extract its content.\n\nRAW TEXT:\n${input.rawText}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new LlmGenerationError("The model declined to read this document.");
  }
  if (!response.parsed_output) {
    throw new LlmGenerationError("Couldn't extract structured data from that text — try pasting it again.");
  }
  return response.parsed_output;
}

const REPAIR_SYSTEM_PROMPT =`You are a LaTeX repair tool. You are given a resume .tex document that failed to compile with pdflatex, plus the compiler log. Return a corrected version of the COMPLETE document that compiles cleanly. Change as little as possible — fix only what the log points at. Do not alter the wording of resume content. Output only the LaTeX document, starting with \\documentclass, no code fences, no commentary.`;

export async function repairResumeLatex(input: {
  latexSource: string;
  compileLog: string;
}): Promise<{ latexSource: string }> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: REPAIR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `COMPILER LOG:\n${input.compileLog.slice(0, 6000)}\n\nDOCUMENT:\n${input.latexSource}`,
      },
    ],
  });

  const latexSource = stripFences(extractText(response));
  assertUsableLatex(latexSource);
  return { latexSource };
}

const TRIM_SYSTEM_PROMPT = `You are given a resume .tex document that compiled successfully but rendered onto more than one page — it must fit exactly one. Shorten it until it fits:
- Cut whole bullets or whole entries (the least job-relevant ones) before you touch wording. Only tighten a bullet's wording as a last resort, and only if it doesn't change any fact.
- Do not change \\documentclass, the \\usepackage list, margins, font size, or any \\newcommand/\\renewcommand — the layout itself must stay identical to the input; only the amount of content changes.
- Do not invent content to pad anything back out.
- Keep every structural pattern (e.g. how optional fields like GPA are positioned) exactly as it already is in the input for the entries you keep.
Output only the complete corrected LaTeX document, starting with \\documentclass, no code fences, no commentary.`;

export async function trimResumeToOnePage(input: {
  latexSource: string;
  pageCount: number;
}): Promise<{ latexSource: string }> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: TRIM_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `This document currently renders as ${input.pageCount} pages. Cut it down to fit exactly 1 page.\n\nDOCUMENT:\n${input.latexSource}`,
      },
    ],
  });

  const latexSource = stripFences(extractText(response));
  assertUsableLatex(latexSource);
  return { latexSource };
}
