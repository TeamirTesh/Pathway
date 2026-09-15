import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import {
  api,
  ContactLink,
  ContactVariant,
  EducationEntry,
  ExperienceEntry,
  InvolvementEntry,
  ProjectEntry,
  ResearchEntry,
  ResumeProfile,
  SectionKind,
  SectionMeta,
  SkillCategory,
  SummaryVariant,
} from "@/lib/api";
import { Mono } from "@/components/mono";

type ProfileForm = Omit<ResumeProfile, "id" | "updatedAt">;

function updateAt<T>(arr: T[], i: number, value: T): T[] {
  const copy = [...arr];
  copy[i] = value;
  return copy;
}

function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, idx) => idx !== i);
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= arr.length || from < 0 || from >= arr.length) {
    return arr;
  }
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// Default section order and headings. `contact` is the resume header and is
// not part of this list. "Leadership" is the heading for the `involvement`
// section by default; every title here is editable.
const SECTION_ORDER: SectionKind[] = [
  "education",
  "experience",
  "projects",
  "skills",
  "involvement",
  "summary",
  "research",
];

const SECTION_TITLES: Record<SectionKind, string> = {
  summary: "Summary",
  education: "Education",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  involvement: "Leadership",
  research: "Research",
};

// The stored `sections` array may be empty (new profile), stale, or missing
// kinds. Produce a complete, de-duplicated, ordered list: honor whatever order
// and settings are stored, then append any kinds that weren't listed in the
// default order.
function normalizeSections(raw: SectionMeta[] | undefined | null): SectionMeta[] {
  const known = new Set<SectionKind>(SECTION_ORDER);
  const seen = new Set<SectionKind>();
  const result: SectionMeta[] = [];

  for (const s of raw ?? []) {
    if (s && known.has(s.kind) && !seen.has(s.kind)) {
      seen.add(s.kind);
      result.push({
        kind: s.kind,
        title: typeof s.title === "string" && s.title.trim() ? s.title : SECTION_TITLES[s.kind],
        visible: s.visible !== false,
      });
    }
  }
  for (const kind of SECTION_ORDER) {
    if (!seen.has(kind)) {
      result.push({ kind, title: SECTION_TITLES[kind], visible: true });
    }
  }
  return result;
}

export function ResumeProfileEditor() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["resumeProfile"],
    queryFn: api.resumeProfile.get,
  });

  const [form, setForm] = useState<ProfileForm | null>(null);
  const loadedRef = useRef(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data && !loadedRef.current) {
      const { id: _id, updatedAt: _updatedAt, ...rest } = data;
      setForm({ ...rest, sections: normalizeSections(rest.sections) });
      loadedRef.current = true;
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (body: ProfileForm) => api.resumeProfile.update(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumeProfile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading || !form) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Mono dim>Loading…</Mono>
      </div>
    );
  }

  const sections = form.sections;

  const setSectionMeta = (i: number, patch: Partial<SectionMeta>) =>
    setForm({ ...form, sections: updateAt(sections, i, { ...sections[i], ...patch }) });
  const moveSection = (from: number, to: number) =>
    setForm({ ...form, sections: move(sections, from, to) });

  return (
    <div className="min-h-screen">
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-3">
          <Link to="/app/resume" className="text-text-secondary hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <h1 className="text-base font-semibold tracking-tight">Resume Profile</h1>
        </div>
        <button
          onClick={() => save.mutate(form)}
          disabled={save.isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {save.isPending ? "Saving…" : saved ? "Saved!" : "Save changes"}
        </button>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <p className="text-xs text-text-secondary">
          This is the master list of everything you might put on a resume. Reorder sections with the
          arrows, rename a section to change its heading, and hide the ones you don't want on a
          generated resume. Add multiple entries to a section and reorder those too. When you tailor
          a resume, content is never invented — only selected and reordered.
        </p>

        <Section title="Contact">
          <ContactVariantsEditor contact={form.contact} onChange={(contact) => setForm({ ...form, contact })} />
        </Section>

        {sections.map((meta, idx) => (
          <SectionCard
            key={meta.kind}
            meta={meta}
            index={idx}
            count={sections.length}
            onTitle={(title) => setSectionMeta(idx, { title })}
            onToggle={() => setSectionMeta(idx, { visible: !meta.visible })}
            onMove={moveSection}
          >
            {meta.kind === "summary" && (
              <SummaryVariantsEditor
                summary={form.summary}
                onChange={(summary) => setForm({ ...form, summary })}
              />
            )}
            {meta.kind === "education" && (
              <EducationEditor
                education={form.education}
                onChange={(education) => setForm({ ...form, education })}
              />
            )}
            {meta.kind === "experience" && (
              <ExperienceEditor
                experience={form.experience}
                onChange={(experience) => setForm({ ...form, experience })}
              />
            )}
            {meta.kind === "projects" && (
              <NameDescriptionEditor
                entryLabel="project"
                entries={form.projects}
                onChange={(projects) => setForm({ ...form, projects })}
              />
            )}
            {meta.kind === "skills" && (
              <SkillsEditor skills={form.skills} onChange={(skills) => setForm({ ...form, skills })} />
            )}
            {meta.kind === "involvement" && (
              <NameDescriptionEditor
                entryLabel="entry"
                entries={form.involvement}
                onChange={(involvement) => setForm({ ...form, involvement })}
              />
            )}
            {meta.kind === "research" && (
              <ResearchEditor
                research={form.research}
                onChange={(research) => setForm({ ...form, research })}
              />
            )}
          </SectionCard>
        ))}
      </div>

      <style>{`.input { background: var(--background); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; font-size: 13px; outline: none; color: var(--foreground); }
      .input:focus { border-color: var(--border-strong); }
      .chip { display: inline-flex; align-items: center; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; font-size: 12px; }
      .chip button { color: var(--text-tertiary); display: flex; }
      .chip button:hover { color: var(--foreground); }
      .icon-btn { color: var(--text-tertiary); padding: 4px; border-radius: 6px; }
      .icon-btn:hover { color: var(--foreground); background: var(--surface); }
      .icon-btn:disabled { opacity: 0.25; pointer-events: none; }
      .add-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-secondary); border: 1px dashed var(--border); border-radius: 6px; padding: 6px 10px; }
      .add-btn:hover { color: var(--foreground); border-color: var(--border-strong); }`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

// A reorderable, retitleable, hideable section shell. The `title` becomes the
// heading on the generated resume; `visible` controls whether it's included.
function SectionCard({
  meta,
  index,
  count,
  onTitle,
  onToggle,
  onMove,
  children,
}: {
  meta: SectionMeta;
  index: number;
  count: number;
  onTitle: (title: string) => void;
  onToggle: () => void;
  onMove: (from: number, to: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border bg-surface p-5 ${meta.visible ? "border-border" : "border-dashed border-border"}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            className="icon-btn"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label="Move section up"
          >
            <ChevronUp className="size-4" />
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={index === count - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label="Move section down"
          >
            <ChevronDown className="size-4" />
          </button>
        </div>
        <input
          className="input flex-1 text-sm font-semibold"
          value={meta.title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Section heading"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={meta.visible}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:border-border-strong"
        >
          {meta.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {meta.visible ? "Shown" : "Hidden"}
        </button>
      </div>
      <div className={meta.visible ? "" : "opacity-60"}>{children}</div>
    </div>
  );
}

// Reorder-up / reorder-down / delete cluster for a single entry within a section.
function EntryControls({
  index,
  count,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        className="icon-btn"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        aria-label="Move entry up"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        className="icon-btn"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        aria-label="Move entry down"
      >
        <ChevronDown className="size-3.5" />
      </button>
      <button type="button" onClick={onRemove} className="icon-btn" aria-label="Remove entry">
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function TagInput({ onAdd, placeholder }: { onAdd: (value: string) => void; placeholder: string }) {
  const [value, setValue] = useState("");
  return (
    <input
      className="input mt-2 w-full"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (value.trim()) {
            onAdd(value.trim());
            setValue("");
          }
        }
      }}
    />
  );
}

function SkillsEditor({
  skills,
  onChange,
}: {
  skills: SkillCategory[];
  onChange: (skills: SkillCategory[]) => void;
}) {
  const addCategory = () => onChange([...skills, { category: "", items: [] }]);
  const updateCategory = (i: number, category: string) =>
    onChange(updateAt(skills, i, { ...skills[i], category }));
  const removeCategory = (i: number) => onChange(removeAt(skills, i));
  const moveCategory = (from: number, to: number) => onChange(move(skills, from, to));
  const addItem = (i: number, item: string) =>
    onChange(updateAt(skills, i, { ...skills[i], items: [...skills[i].items, item] }));
  const removeItem = (i: number, j: number) =>
    onChange(updateAt(skills, i, { ...skills[i], items: skills[i].items.filter((_, idx) => idx !== j) }));

  return (
    <div className="space-y-3">
      {skills.map((cat, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-center gap-2">
            <input
              className="input flex-1"
              placeholder="Category (e.g. Languages)"
              value={cat.category}
              onChange={(e) => updateCategory(i, e.target.value)}
            />
            <EntryControls
              index={i}
              count={skills.length}
              onMove={moveCategory}
              onRemove={() => removeCategory(i)}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cat.items.map((item, j) => (
              <span key={j} className="chip">
                {item}
                <button onClick={() => removeItem(i, j)}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
          <TagInput onAdd={(v) => addItem(i, v)} placeholder="Add skill, press Enter" />
        </div>
      ))}
      <button onClick={addCategory} className="add-btn">
        <Plus className="size-3.5" /> Add category
      </button>
    </div>
  );
}

function ContactVariantsEditor({
  contact,
  onChange,
}: {
  contact: ContactVariant[];
  onChange: (contact: ContactVariant[]) => void;
}) {
  const addVariant = () =>
    onChange([
      ...contact,
      { key: "", name: "", email: "", phone: "", links: [], location: "", title: "" },
    ]);
  const updateVariant = (i: number, patch: Partial<ContactVariant>) =>
    onChange(updateAt(contact, i, { ...contact[i], ...patch }));
  const removeVariant = (i: number) => onChange(removeAt(contact, i));
  const moveVariant = (from: number, to: number) => onChange(move(contact, from, to));

  const links = (i: number): ContactLink[] => contact[i].links ?? [];
  const addLink = (i: number) => updateVariant(i, { links: [...links(i), { url: "", label: "" }] });
  const updateLink = (i: number, li: number, patch: Partial<ContactLink>) =>
    updateVariant(i, { links: updateAt(links(i), li, { ...links(i)[li], ...patch }) });
  const removeLink = (i: number, li: number) =>
    updateVariant(i, { links: removeAt(links(i), li) });
  const moveLink = (i: number, from: number, to: number) =>
    updateVariant(i, { links: move(links(i), from, to) });

  return (
    <div className="space-y-4">
      {contact.map((c, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Variant key (e.g. tech, research, ops)"
                value={c.key}
                onChange={(e) => updateVariant(i, { key: e.target.value })}
              />
              <input
                className="input"
                placeholder="Title (e.g. Software Engineer)"
                value={c.title}
                onChange={(e) => updateVariant(i, { title: e.target.value })}
              />
              <input
                className="input"
                placeholder="Name"
                value={c.name}
                onChange={(e) => updateVariant(i, { name: e.target.value })}
              />
              <input
                className="input"
                placeholder="Email"
                value={c.email}
                onChange={(e) => updateVariant(i, { email: e.target.value })}
              />
              <input
                className="input"
                placeholder="Phone"
                value={c.phone}
                onChange={(e) => updateVariant(i, { phone: e.target.value })}
              />
              <input
                className="input"
                placeholder="Location"
                value={c.location}
                onChange={(e) => updateVariant(i, { location: e.target.value })}
              />
            </div>
            <EntryControls
              index={i}
              count={contact.length}
              onMove={moveVariant}
              onRemove={() => removeVariant(i)}
            />
          </div>

          <div className="mt-3 space-y-1.5">
            <Mono dim>Links</Mono>
            {(c.links ?? []).map((lnk, li) => (
              <div key={li} className="flex items-center gap-1.5">
                <input
                  className="input flex-1"
                  placeholder="URL (e.g. https://github.com/you)"
                  value={lnk.url}
                  onChange={(e) => updateLink(i, li, { url: e.target.value })}
                />
                <input
                  className="input flex-1"
                  placeholder="Display text (e.g. github.com/you)"
                  value={lnk.label}
                  onChange={(e) => updateLink(i, li, { label: e.target.value })}
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={li === 0}
                    onClick={() => moveLink(i, li, li - 1)}
                    aria-label="Move link up"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    disabled={li === (c.links ?? []).length - 1}
                    onClick={() => moveLink(i, li, li + 1)}
                    aria-label="Move link down"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeLink(i, li)}
                    aria-label="Remove link"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => addLink(i)} className="add-btn">
              <Plus className="size-3" /> Add link
            </button>
          </div>
        </div>
      ))}
      <button onClick={addVariant} className="add-btn">
        <Plus className="size-3.5" /> Add contact variant
      </button>
    </div>
  );
}

function SummaryVariantsEditor({
  summary,
  onChange,
}: {
  summary: SummaryVariant[];
  onChange: (summary: SummaryVariant[]) => void;
}) {
  const addVariant = () => onChange([...summary, { key: "", label: "", text: "" }]);
  const updateVariant = (i: number, patch: Partial<SummaryVariant>) =>
    onChange(updateAt(summary, i, { ...summary[i], ...patch }));
  const removeVariant = (i: number) => onChange(removeAt(summary, i));
  const moveVariant = (from: number, to: number) => onChange(move(summary, from, to));

  return (
    <div className="space-y-4">
      {summary.map((s, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="input"
                  placeholder="Variant key (e.g. tech, ops)"
                  value={s.key}
                  onChange={(e) => updateVariant(i, { key: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Label (for your own reference)"
                  value={s.label}
                  onChange={(e) => updateVariant(i, { label: e.target.value })}
                />
              </div>
              <textarea
                className="input w-full"
                rows={2}
                placeholder="Summary text — a starting point the AI can riff on, not a strict source of truth"
                value={s.text}
                onChange={(e) => updateVariant(i, { text: e.target.value })}
              />
            </div>
            <EntryControls
              index={i}
              count={summary.length}
              onMove={moveVariant}
              onRemove={() => removeVariant(i)}
            />
          </div>
        </div>
      ))}
      <button onClick={addVariant} className="add-btn">
        <Plus className="size-3.5" /> Add summary variant
      </button>
    </div>
  );
}

function ExperienceEditor({
  experience,
  onChange,
}: {
  experience: ExperienceEntry[];
  onChange: (experience: ExperienceEntry[]) => void;
}) {
  const addEntry = () => onChange([...experience, { org: "", location: "", role: "", date: "", bullets: [] }]);
  const updateEntry = (i: number, patch: Partial<ExperienceEntry>) =>
    onChange(updateAt(experience, i, { ...experience[i], ...patch }));
  const removeEntry = (i: number) => onChange(removeAt(experience, i));
  const moveEntry = (from: number, to: number) => onChange(move(experience, from, to));
  const addBullet = (i: number) => updateEntry(i, { bullets: [...experience[i].bullets, ""] });
  const updateBullet = (i: number, j: number, value: string) =>
    updateEntry(i, { bullets: updateAt(experience[i].bullets, j, value) });
  const removeBullet = (i: number, j: number) =>
    updateEntry(i, { bullets: experience[i].bullets.filter((_, idx) => idx !== j) });

  return (
    <div className="space-y-4">
      {experience.map((entry, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Role"
                value={entry.role}
                onChange={(e) => updateEntry(i, { role: e.target.value })}
              />
              <input
                className="input"
                placeholder="Organization"
                value={entry.org}
                onChange={(e) => updateEntry(i, { org: e.target.value })}
              />
              <input
                className="input"
                placeholder="Location"
                value={entry.location}
                onChange={(e) => updateEntry(i, { location: e.target.value })}
              />
              <input
                className="input"
                placeholder="Dates (e.g. 2023 – Present)"
                value={entry.date}
                onChange={(e) => updateEntry(i, { date: e.target.value })}
              />
            </div>
            <EntryControls
              index={i}
              count={experience.length}
              onMove={moveEntry}
              onRemove={() => removeEntry(i)}
            />
          </div>

          <div className="mt-2 space-y-1.5">
            {entry.bullets.map((b, j) => (
              <div key={j} className="flex items-center gap-1.5">
                <input
                  className="input flex-1"
                  placeholder="Bullet"
                  value={b}
                  onChange={(e) => updateBullet(i, j, e.target.value)}
                />
                <button onClick={() => removeBullet(i, j)} className="icon-btn">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <button onClick={() => addBullet(i)} className="add-btn">
              <Plus className="size-3" /> Add bullet
            </button>
          </div>
        </div>
      ))}
      <button onClick={addEntry} className="add-btn">
        <Plus className="size-3.5" /> Add role
      </button>
    </div>
  );
}

function ResearchEditor({
  research,
  onChange,
}: {
  research: ResearchEntry[];
  onChange: (research: ResearchEntry[]) => void;
}) {
  const addEntry = () => onChange([...research, { org: "", location: "", role: "", title: "", description: "" }]);
  const updateEntry = (i: number, patch: Partial<ResearchEntry>) =>
    onChange(updateAt(research, i, { ...research[i], ...patch }));
  const removeEntry = (i: number) => onChange(removeAt(research, i));
  const moveEntry = (from: number, to: number) => onChange(move(research, from, to));

  return (
    <div className="space-y-4">
      {research.map((entry, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="Title (e.g. talk / paper title)"
                value={entry.title}
                onChange={(e) => updateEntry(i, { title: e.target.value })}
              />
              <input
                className="input"
                placeholder="Role (e.g. Speaker)"
                value={entry.role}
                onChange={(e) => updateEntry(i, { role: e.target.value })}
              />
              <input
                className="input"
                placeholder="Organization / venue"
                value={entry.org}
                onChange={(e) => updateEntry(i, { org: e.target.value })}
              />
              <input
                className="input"
                placeholder="Location"
                value={entry.location}
                onChange={(e) => updateEntry(i, { location: e.target.value })}
              />
            </div>
            <EntryControls
              index={i}
              count={research.length}
              onMove={moveEntry}
              onRemove={() => removeEntry(i)}
            />
          </div>
          <textarea
            className="input mt-2 w-full"
            rows={2}
            placeholder="Description"
            value={entry.description}
            onChange={(e) => updateEntry(i, { description: e.target.value })}
          />
        </div>
      ))}
      <button onClick={addEntry} className="add-btn">
        <Plus className="size-3.5" /> Add entry
      </button>
    </div>
  );
}

function NameDescriptionEditor({
  entryLabel,
  entries,
  onChange,
}: {
  entryLabel: string;
  entries: (ProjectEntry | InvolvementEntry)[];
  onChange: (entries: (ProjectEntry | InvolvementEntry)[]) => void;
}) {
  const addEntry = () => onChange([...entries, { name: "", description: "" }]);
  const updateEntry = (i: number, patch: Partial<ProjectEntry>) =>
    onChange(updateAt(entries, i, { ...entries[i], ...patch }));
  const removeEntry = (i: number) => onChange(removeAt(entries, i));
  const moveEntry = (from: number, to: number) => onChange(move(entries, from, to));

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <input
              className="input flex-1"
              placeholder="Name"
              value={entry.name}
              onChange={(e) => updateEntry(i, { name: e.target.value })}
            />
            <EntryControls
              index={i}
              count={entries.length}
              onMove={moveEntry}
              onRemove={() => removeEntry(i)}
            />
          </div>
          <textarea
            className="input mt-2 w-full"
            rows={2}
            placeholder="Description"
            value={entry.description}
            onChange={(e) => updateEntry(i, { description: e.target.value })}
          />
        </div>
      ))}
      <button onClick={addEntry} className="add-btn">
        <Plus className="size-3.5" /> Add {entryLabel}
      </button>
    </div>
  );
}

function EducationEditor({
  education,
  onChange,
}: {
  education: EducationEntry[];
  onChange: (education: EducationEntry[]) => void;
}) {
  const addEntry = () =>
    onChange([...education, { school: "", location: "", degree: "", date: "", gpa: "", honors: "", coursework: "" }]);
  const updateEntry = (i: number, patch: Partial<EducationEntry>) =>
    onChange(updateAt(education, i, { ...education[i], ...patch }));
  const removeEntry = (i: number) => onChange(removeAt(education, i));
  const moveEntry = (from: number, to: number) => onChange(move(education, from, to));

  return (
    <div className="space-y-4">
      {education.map((entry, i) => (
        <div key={i} className="rounded-md border border-border bg-background p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <input
                className="input"
                placeholder="School"
                value={entry.school}
                onChange={(e) => updateEntry(i, { school: e.target.value })}
              />
              <input
                className="input"
                placeholder="Location"
                value={entry.location}
                onChange={(e) => updateEntry(i, { location: e.target.value })}
              />
              <input
                className="input"
                placeholder="Degree"
                value={entry.degree}
                onChange={(e) => updateEntry(i, { degree: e.target.value })}
              />
              <input
                className="input"
                placeholder="Dates (e.g. 2024 – 2026)"
                value={entry.date}
                onChange={(e) => updateEntry(i, { date: e.target.value })}
              />
              <input
                className="input"
                placeholder="GPA (optional)"
                value={entry.gpa}
                onChange={(e) => updateEntry(i, { gpa: e.target.value })}
              />
              <input
                className="input"
                placeholder="Honors (optional)"
                value={entry.honors}
                onChange={(e) => updateEntry(i, { honors: e.target.value })}
              />
              <input
                className="input col-span-2"
                placeholder="Coursework (optional)"
                value={entry.coursework}
                onChange={(e) => updateEntry(i, { coursework: e.target.value })}
              />
            </div>
            <EntryControls
              index={i}
              count={education.length}
              onMove={moveEntry}
              onRemove={() => removeEntry(i)}
            />
          </div>
        </div>
      ))}
      <button onClick={addEntry} className="add-btn">
        <Plus className="size-3.5" /> Add education
      </button>
    </div>
  );
}
