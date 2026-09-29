// zod/v4, not the top-level "zod" (v3) used elsewhere: @anthropic-ai/sdk's
// zodOutputFormat() calls the v4-only z.toJSONSchema() internally and throws
// on a v3 schema object. This file's only job is being an LLM structured-
// output contract, so it's scoped to v4 in isolation (see resumeSchemas.ts
// for the v3 schemas this shape is otherwise kept in sync with).
import { z } from "zod/v4";

const contactLink = z.object({
  url: z.string().default(""),
  label: z.string().default(""),
});

const contact = z.object({
  key: z.string().default("main"),
  name: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  links: z.array(contactLink).default([]),
  location: z.string().default(""),
  title: z.string().default(""),
});

const summary = z.object({
  key: z.string().default("main"),
  label: z.string().default("Summary"),
  text: z.string().default(""),
});

const skillCategory = z.object({
  category: z.string(),
  items: z.array(z.string()).default([]),
});

const experience = z.object({
  org: z.string(),
  location: z.string().default(""),
  role: z.string(),
  date: z.string().default(""),
  bullets: z.array(z.string()).default([]),
});

const research = z.object({
  org: z.string().default(""),
  location: z.string().default(""),
  role: z.string().default(""),
  title: z.string().default(""),
  description: z.string().default(""),
});

const project = z.object({
  name: z.string(),
  techStack: z.string().default(""),
  links: z.array(contactLink).default([]),
  bullets: z.array(z.string()).default([]),
});

const involvement = z.object({
  name: z.string(),
  description: z.string().default(""),
});

const education = z.object({
  school: z.string(),
  location: z.string().default(""),
  degree: z.string().default(""),
  date: z.string().default(""),
  gpa: z.string().default(""),
  honors: z.string().default(""),
  coursework: z.string().default(""),
});

export const importedProfileSchema = z.object({
  contact: z.array(contact).default([]),
  summary: z.array(summary).default([]),
  skills: z.array(skillCategory).default([]),
  experience: z.array(experience).default([]),
  research: z.array(research).default([]),
  projects: z.array(project).default([]),
  involvement: z.array(involvement).default([]),
  education: z.array(education).default([]),
});

export type ImportedProfile = z.infer<typeof importedProfileSchema>;
