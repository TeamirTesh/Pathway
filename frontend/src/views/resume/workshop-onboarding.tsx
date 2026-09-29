import { useEffect, useState } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, FileText, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import type { ResumeProfile } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Step = "ask-path" | "ask-cv-type" | "import" | "done-scratch" | "done-import";

type ContentKey =
  | "contact"
  | "summary"
  | "skills"
  | "experience"
  | "research"
  | "projects"
  | "involvement"
  | "education";

const CONTENT_KEYS: ContentKey[] = [
  "contact",
  "summary",
  "skills",
  "experience",
  "research",
  "projects",
  "involvement",
  "education",
];

function isProfileEmpty(profile: ResumeProfile): boolean {
  return CONTENT_KEYS.every((k) => profile[k].length === 0);
}

// Required first-run flow: shows purely because the Resume Profile is empty —
// there's no "seen it once" flag and no skip. It reopens every time the user
// lands on the Resume Workshop until the profile actually has content in it,
// either from importing an existing resume/CV or from adding things by hand.
export function WorkshopOnboarding() {
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["resumeProfile"],
    queryFn: api.resumeProfile.get,
  });

  const eligible = Boolean(profile && isProfileEmpty(profile));

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("ask-path");
  const [mode, setMode] = useState<"holistic" | "one-page">("holistic");
  const [rawText, setRawText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importCounts, setImportCounts] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    if (eligible) {
      setStep("ask-path");
      setOpen(true);
    }
  }, [eligible]);

  // Only reached from the two terminal screens below, both of which are
  // sending the user to go add real content to their profile.
  function closeWizard() {
    setOpen(false);
  }

  async function handleImport() {
    if (!rawText.trim() || isImporting) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const { counts, ...updatedProfile } = await api.resumeProfile.import({ rawText, mode });
      queryClient.setQueryData(["resumeProfile"], updatedProfile);
      setImportCounts(counts);
      setStep("done-import");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Couldn't import that text");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-lg"
      >
        {step === "ask-path" && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Let's set up your Resume Profile</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text-secondary">
              This is the master list everything gets tailored from — the more complete it is, the
              better a resume the AI can build for any given role. How do you want to start?
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStep("done-scratch")}
                className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left hover:border-border-strong"
              >
                <FileText className="size-5 text-primary-muted" />
                <div className="text-sm font-medium">Start from scratch</div>
                <div className="text-xs text-text-secondary">
                  Fill everything in yourself, section by section.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStep("ask-cv-type")}
                className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left hover:border-border-strong"
              >
                <Sparkles className="size-5 text-primary-muted" />
                <div className="text-sm font-medium">I already have something</div>
                <div className="text-xs text-text-secondary">
                  Paste an existing resume or CV and we'll import it.
                </div>
              </button>
            </div>
          </div>
        )}

        {step === "ask-cv-type" && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>What do you have?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text-secondary">
              Either way we'll import exactly what's on the page — this just helps us tell you
              afterward what might still be worth adding.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMode("holistic");
                  setStep("import");
                }}
                className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left hover:border-border-strong"
              >
                <div className="text-sm font-medium">A complete CV</div>
                <div className="text-xs text-text-secondary">
                  Everything you've done — every job, project, and school, not trimmed to one page.
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("one-page");
                  setStep("import");
                }}
                className="flex flex-col items-start gap-2 rounded-lg border border-border bg-surface p-4 text-left hover:border-border-strong"
              >
                <div className="text-sm font-medium">A one-page resume</div>
                <div className="text-xs text-text-secondary">
                  Already trimmed to your most relevant highlights for one role.
                </div>
              </button>
            </div>
          </div>
        )}

        {step === "import" && (
          <div className="space-y-3">
            <DialogHeader>
              <DialogTitle>Paste your {mode === "holistic" ? "CV" : "resume"}</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-text-secondary">
              Copy the text straight out of your PDF or Word doc and paste it below. We'll pull your
              contact info, experience, education, skills, and projects into your profile — nothing
              gets invented, only what's actually written.
            </p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste the full text here…"
              rows={10}
              spellCheck={false}
              className="w-full resize-none rounded-md border border-border bg-background p-2.5 text-xs outline-none focus:border-border-strong"
            />
            {importError && <p className="text-xs text-destructive">{importError}</p>}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting || !rawText.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {isImporting ? "Reading it…" : "Import"} <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {step === "done-scratch" && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>Sounds good.</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-text-secondary">
              Head to your Resume Profile and add everything you've got — every role, project, and
              school. The more it holds, the more the AI has to pull from when it tailors a resume
              to a specific job. Come back here once it's got something in it.
            </p>
            <div className="flex justify-end">
              <Link
                to="/app/resume/profile"
                onClick={closeWizard}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Resume Profile <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}

        {step === "done-import" && (
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#34D399]" /> Imported
              </DialogTitle>
            </DialogHeader>
            {importCounts && (
              <div className="flex flex-wrap gap-1.5 text-xs">
                {Object.entries(importCounts)
                  .filter(([, count]) => count > 0)
                  .map(([key, count]) => (
                    <span
                      key={key}
                      className="rounded-full border border-border bg-surface px-2 py-1"
                    >
                      {count} {key}
                    </span>
                  ))}
              </div>
            )}
            <p className="text-sm text-text-secondary">
              {mode === "one-page"
                ? "A one-page resume is trimmed down on purpose, so that's probably not everything you've done. Head to your Resume Profile and add whatever got left out — other jobs, other projects, anything else — so there's more to pull from when tailoring for different roles."
                : "Take a look at your Resume Profile and fill in anything that's missing or came through wrong."}
            </p>
            <div className="flex justify-end">
              <Link
                to="/app/resume/profile"
                onClick={closeWizard}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Go to Resume Profile <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
