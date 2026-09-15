import { z } from "zod";

export const contactLinkSchema = z.object({
  url: z.string().default(""),
  label: z.string().default(""),
});

// Accept the legacy single-link shape ({ link, linkDisplay }) and fold it into
// the `links` array so old stored profiles keep their link after this change.
const contactVariantRawSchema = z.object({
  key: z.string().min(1),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  links: z.array(contactLinkSchema).default([]),
  link: z.string().nullable().optional(),
  linkDisplay: z.string().optional(),
  location: z.string(),
  title: z.string(),
});

export const contactVariantSchema = contactVariantRawSchema.transform((c) => {
  const { link, linkDisplay, links, ...rest } = c;
  const merged = [...links];
  if (link && !merged.some((l) => l.url === link)) {
    merged.push({ url: link, label: linkDisplay ?? "" });
  }
  return { ...rest, links: merged };
});

export const summaryVariantSchema = z.object({
  key: z.string().min(1),
  label: z.string().default(""),
  text: z.string(),
});

export const skillCategorySchema = z.object({
  category: z.string(),
  items: z.array(z.string()),
});

export const experienceEntrySchema = z.object({
  org: z.string(),
  location: z.string(),
  role: z.string(),
  date: z.string(),
  bullets: z.array(z.string()),
});

// Single description, no bullets — matches base.tex's Research section.
export const researchEntrySchema = z.object({
  org: z.string(),
  location: z.string(),
  role: z.string(),
  title: z.string(),
  description: z.string(),
});

// No dates/org/location — matches base.tex's Projects section.
export const projectEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
});

// Same minimal shape as projects.
export const involvementEntrySchema = z.object({
  name: z.string(),
  description: z.string(),
});

export const educationEntrySchema = z.object({
  school: z.string(),
  location: z.string(),
  degree: z.string(),
  date: z.string(),
  gpa: z.string().optional().default(""),
  honors: z.string().optional().default(""),
  coursework: z.string().optional().default(""),
});

// Section kinds that can be reordered, retitled, and hidden. `contact` is the
// resume header and is intentionally excluded.
export const SECTION_KINDS = [
  "summary",
  "education",
  "experience",
  "projects",
  "skills",
  "involvement",
  "research",
] as const;

export const sectionMetaSchema = z.object({
  kind: z.enum(SECTION_KINDS),
  // Heading text used on the generated LaTeX resume. Empty falls back to the
  // client's default title for that kind.
  title: z.string().default(""),
  visible: z.boolean().default(true),
});

export const profileSchema = z.object({
  contact: z.array(contactVariantSchema).default([]),
  summary: z.array(summaryVariantSchema).default([]),
  skills: z.array(skillCategorySchema).default([]),
  experience: z.array(experienceEntrySchema).default([]),
  research: z.array(researchEntrySchema).default([]),
  projects: z.array(projectEntrySchema).default([]),
  involvement: z.array(involvementEntrySchema).default([]),
  education: z.array(educationEntrySchema).default([]),
  sections: z.array(sectionMetaSchema).default([]),
});

// Content sections only — used to decide whether a profile is "empty" enough
// to block resume generation. Excludes `sections` (metadata) and `contact`.
export const PROFILE_CONTENT_KEYS = [
  "summary",
  "skills",
  "experience",
  "research",
  "projects",
  "involvement",
  "education",
] as const;

export type ContactLink = z.infer<typeof contactLinkSchema>;
export type ContactVariant = z.infer<typeof contactVariantSchema>;
export type SummaryVariant = z.infer<typeof summaryVariantSchema>;
export type SkillCategory = z.infer<typeof skillCategorySchema>;
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;
export type ResearchEntry = z.infer<typeof researchEntrySchema>;
export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type InvolvementEntry = z.infer<typeof involvementEntrySchema>;
export type EducationEntry = z.infer<typeof educationEntrySchema>;
export type SectionKind = (typeof SECTION_KINDS)[number];
export type SectionMeta = z.infer<typeof sectionMetaSchema>;
export type ResumeProfileData = z.infer<typeof profileSchema>;
