import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Send, UserCog, Code2, Save, LayoutTemplate, Trash2, Plus } from "lucide-react";
import { api, ResumeVersion, ResumeTemplate } from "@/lib/api";
import { Mono } from "@/components/mono";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ChatMessage = { role: "user" | "assistant"; content: string; pending?: boolean };

const TEMPLATE_STORAGE_KEY = "pathway.resumeTemplateId";

const WELCOME_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Paste a full job posting in the box below — title, team, responsibilities, requirements, all of it — and I'll draft a resume tailored to it, formatted to match your selected template (pick one under \"Templates\" up top). It pulls only from what's in your Resume Profile; nothing gets invented, only selected and reordered to match the role.",
};

export function Resume() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editedLatex, setEditedLatex] = useState("");
  const [isSavingLatex, setIsSavingLatex] = useState(false);
  const [latexSaved, setLatexSaved] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<ResumeTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplSource, setTplSource] = useState("");
  const [savingTpl, setSavingTpl] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);

  const activeVersionData = versions.find((v) => v.id === activeVersion) ?? null;
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // What the right-hand pane renders: the active saved version if there is one,
  // otherwise the currently selected template as-is.
  const previewLatex = activeVersionData?.latexSource ?? selectedTemplate?.latexSource ?? null;

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const list = await api.resume.templates.list();
      setTemplates(list);
    } catch {
      // non-fatal; selector just stays empty
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  // Once templates load, settle on a selection: keep the current one if valid,
  // else the last-used one from storage, else the first template.
  useEffect(() => {
    if (templates.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(TEMPLATE_STORAGE_KEY) : null;
    setSelectedTemplateId((cur) => {
      if (cur && templates.some((t) => t.id === cur)) return cur;
      if (stored && templates.some((t) => t.id === stored)) return stored;
      return templates[0].id;
    });
  }, [templates]);

  useEffect(() => {
    if (selectedTemplateId && typeof window !== "undefined") {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, selectedTemplateId);
    }
  }, [selectedTemplateId]);

  useEffect(() => {
    let cancelled = false;

    async function loadVersions() {
      setVersionsLoading(true);
      setVersionsError(null);
      try {
        const fetched = await api.resume.list();
        if (cancelled) return;
        setVersions(fetched);
        if (fetched.length > 0) setActiveVersion(fetched[fetched.length - 1].id);
      } catch (err) {
        if (!cancelled) {
          setVersionsError(err instanceof Error ? err.message : "Failed to load resume versions");
        }
      } finally {
        if (!cancelled) setVersionsLoading(false);
      }
    }

    loadVersions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeVersionData) setEditedLatex(activeVersionData.latexSource);
  }, [activeVersionData]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function doRender() {
      if (!previewLatex) {
        setPdfUrl(null);
        return;
      }

      setIsRendering(true);
      setRenderError(null);
      try {
        const blob = await api.resume.renderPdf(previewLatex);
        if (cancelled) return;

        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setRenderError(err instanceof Error ? err.message : "Failed to render PDF");
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }

    doRender();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewLatex]);

  const replaceLastMessage = (content: string) => {
    setMessages((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { role: "assistant", content };
      return copy;
    });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    if (!selectedTemplateId) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Pick a template first — use the Template selector at the top right." },
      ]);
      return;
    }

    const jobDescription = input;
    setInput("");
    setIsGenerating(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: jobDescription },
      {
        role: "assistant",
        content: `Reading your profile and this job posting, then writing a resume in the ${
          selectedTemplate?.name ?? "selected"
        } template's style — this takes a few seconds…`,
        pending: true,
      },
    ]);

    try {
      const { warnings, ...version } = await api.resume.generate({
        jobDescription,
        templateId: selectedTemplateId,
      });
      setVersions((prev) => [...prev, version]);
      setActiveVersion(version.id);
      const warningNote =
        warnings.length > 0 ? ` Heads up — ${warnings.join("; ")}` : "";
      replaceLastMessage(
        `Done — drafted ${version.label}. Check the preview on the right; download it once it looks good, or click "Edit LaTeX" to fine-tune anything by hand.${warningNote}`,
      );
    } catch (err) {
      replaceLastMessage(`Couldn't draft a new version: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl || !activeVersion) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `resume-${activeVersion}.pdf`;
    a.click();
  };

  const handleReRender = async () => {
    setIsRendering(true);
    setRenderError(null);
    try {
      const blob = await api.resume.renderPdf(editedLatex);
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Failed to render PDF");
    } finally {
      setIsRendering(false);
    }
  };

  const handleSaveLatex = async () => {
    if (!activeVersion) return;
    setIsSavingLatex(true);
    try {
      const updated = await api.resume.update(activeVersion, { latexSource: editedLatex });
      setVersions((prev) => prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
      setLatexSaved(true);
      setTimeout(() => setLatexSaved(false), 2000);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "Failed to save edits");
    } finally {
      setIsSavingLatex(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSavingTpl(true);
    setTplError(null);
    try {
      const created = await api.resume.templates.create({ name: tplName.trim(), latexSource: tplSource });
      await loadTemplates();
      setSelectedTemplateId(created.id);
      setTplName("");
      setTplSource("");
    } catch (err) {
      setTplError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    setTplError(null);
    try {
      await api.resume.templates.remove(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSelectedTemplateId((cur) => (cur === id ? "" : cur));
    } catch (err) {
      setTplError(err instanceof Error ? err.message : "Failed to delete template");
    }
  };

  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <h1 className="text-base font-semibold tracking-tight">Resume Workshop</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
            <span className="text-text-secondary">Template</span>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={templatesLoading || templates.length === 0}
              className="max-w-[10rem] bg-transparent text-xs outline-none disabled:opacity-50"
            >
              {templates.length === 0 && (
                <option value="">{templatesLoading ? "Loading…" : "None"}</option>
              )}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.builtin ? "" : " (custom)"}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setTemplatesDialogOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-border-strong"
          >
            <LayoutTemplate className="size-3.5 text-text-tertiary" /> Templates
          </button>
          <Link
            to="/app/resume/profile"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-border-strong"
          >
            <UserCog className="size-3.5 text-text-tertiary" /> Edit profile
          </Link>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[380px_1fr] overflow-hidden">
        <div className="flex min-h-0 flex-col border-r border-border">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-md bg-primary/15 px-3 py-2 text-sm">
                    {m.content}
                  </div>
                ) : (
                  <div>
                    <Mono dim>Copilot</Mono>
                    <div
                      className={`mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed ${m.pending ? "animate-pulse text-text-tertiary" : "text-text-primary"}`}
                    >
                      {m.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={send} className="space-y-2 border-t border-border p-3">
            <div className="flex items-baseline justify-between">
              <Mono dim>Job description</Mono>
              <span className="text-[11px] text-text-tertiary">
                Formatting to match: {selectedTemplate?.name ?? "—"}
              </span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste the full job posting here — title, team, responsibilities, requirements, everything…"
              rows={7}
              disabled={isGenerating}
              className="w-full resize-none rounded-md border border-border bg-surface p-2.5 text-sm outline-none placeholder:text-text-tertiary focus:border-border-strong disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isGenerating || !input.trim() || !selectedTemplateId}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              <Send className="size-3.5" />
              {isGenerating ? "Drafting…" : "Generate tailored resume"}
            </button>
          </form>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2 overflow-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveVersion(null);
                  setEditorOpen(false);
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${!activeVersion ? "border-primary bg-primary/10" : "border-border hover:border-border-strong"}`}
              >
                <Plus className="size-3.5" /> New
              </button>
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => setActiveVersion(v.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-xs ${activeVersion === v.id ? "border-primary bg-primary/10" : "border-border hover:border-border-strong"}`}
                >
                  <Mono>v{i + 1}</Mono>
                  <span className="text-text-secondary">{v.label.split("—")[1]?.trim() ?? v.label}</span>
                </button>
              ))}
              {!activeVersion && (
                <span className="shrink-0 text-xs text-text-tertiary">
                  New resume · previewing{" "}
                  <span className="text-text-secondary">{selectedTemplate?.name ?? "no template"}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditorOpen((o) => !o)}
                disabled={!activeVersion}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs disabled:opacity-40 ${editorOpen ? "border-primary bg-primary/10" : "border-border bg-surface hover:border-border-strong"}`}
              >
                <Code2 className="size-3.5" /> Edit LaTeX
              </button>
              <button
                onClick={handleDownload}
                disabled={!pdfUrl || !activeVersion}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-border-strong disabled:opacity-40"
              >
                <Download className="size-3.5" /> Download PDF
              </button>
            </div>
          </div>

          <div className={`min-h-0 flex-1 overflow-hidden ${editorOpen ? "grid grid-cols-2" : "flex"}`}>
            {editorOpen && (
              <div className="flex min-h-0 flex-col border-r border-border">
                <textarea
                  value={editedLatex}
                  onChange={(e) => setEditedLatex(e.target.value)}
                  spellCheck={false}
                  className="flex-1 resize-none bg-background p-4 font-mono text-xs leading-relaxed outline-none"
                />
                <div className="flex items-center gap-2 border-t border-border p-3">
                  <button
                    onClick={handleReRender}
                    disabled={isRendering}
                    className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-border-strong disabled:opacity-40"
                  >
                    {isRendering ? "Rendering…" : "Re-render"}
                  </button>
                  <button
                    onClick={handleSaveLatex}
                    disabled={isSavingLatex}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
                  >
                    <Save className="size-3.5" /> {isSavingLatex ? "Saving…" : latexSaved ? "Saved!" : "Save"}
                  </button>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto bg-background/40 p-8">
              {isRendering && (
                <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
                  Rendering…
                </div>
              )}
              {!isRendering && renderError && (
                <div className="flex h-full items-center justify-center whitespace-pre-wrap px-6 text-center text-sm text-red-500">
                  {renderError}
                </div>
              )}
              {!isRendering && !renderError && !pdfUrl && (
                <div className="flex h-full items-center justify-center text-center text-sm text-text-tertiary">
                  {versionsLoading || templatesLoading
                    ? "Loading…"
                    : versionsError
                      ? versionsError
                      : "Select a template to preview it, or paste a job posting to draft your first tailored version."}
                </div>
              )}
              {!isRendering && !renderError && pdfUrl && (
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  title="Resume preview"
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Resume templates</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              Every generated resume is written to match the selected template's layout and macros.
              Import your own by pasting its full LaTeX source.
            </p>

            <div className="space-y-1.5">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${t.id === selectedTemplateId ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(t.id);
                      setTemplatesDialogOpen(false);
                    }}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                      {t.builtin ? "Built-in" : "Custom"}
                    </span>
                  </button>
                  {!t.builtin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(t.id)}
                      className="text-text-tertiary hover:text-foreground"
                      aria-label={`Delete ${t.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {templates.length === 0 && (
                <p className="text-xs text-text-tertiary">
                  {templatesLoading ? "Loading templates…" : "No templates available."}
                </p>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <Mono dim>Import a template</Mono>
              <input
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                placeholder="Template name (e.g. My CV)"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-border-strong"
              />
              <textarea
                value={tplSource}
                onChange={(e) => setTplSource(e.target.value)}
                spellCheck={false}
                placeholder="Paste the full .tex source — \documentclass … \begin{document} … \end{document}"
                rows={8}
                className="w-full resize-none rounded-md border border-border bg-background p-2.5 font-mono text-xs outline-none focus:border-border-strong"
              />
              {tplError && <p className="text-xs text-destructive">{tplError}</p>}
              <button
                type="button"
                onClick={handleSaveTemplate}
                disabled={savingTpl || !tplName.trim() || !tplSource.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                {savingTpl ? "Saving…" : "Save template"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
