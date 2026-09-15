import Anthropic from "@anthropic-ai/sdk";
import { ResumeProfileData } from "./resumeSchemas";

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

CONTENT RULES — never invent facts
- Every company, role, title, date, school, degree, project name, and bullet fact must come from the profile. Do not invent, embellish, or change numbers.
- You may omit, reorder, and lightly condense. You may NOT add.
- The ONLY prose you may write freely is the summary/objective: a fresh 1-3 sentence summary tailored to the job description. If the template has no summary area and the profile's section list doesn't include a visible "summary", skip it.
- Contact details (name, email, phone, location, links) come from the chosen contact variant — pick whichever contact variant's title/framing best fits the job. Render every link in profile.contact.links in the template's header style.

SELECTION GUIDANCE
- experience: keep the 3-5 most relevant roles, 2-4 bullets each — the ones that match the job.
- projects: the 2-3 most relevant.
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

const REPAIR_SYSTEM_PROMPT = `You are a LaTeX repair tool. You are given a resume .tex document that failed to compile with pdflatex, plus the compiler log. Return a corrected version of the COMPLETE document that compiles cleanly. Change as little as possible — fix only what the log points at. Do not alter the wording of resume content. Output only the LaTeX document, starting with \\documentclass, no code fences, no commentary.`;

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
