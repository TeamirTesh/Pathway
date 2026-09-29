import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Download,
  Send,
  UserCog,
  Code2,
  Save,
  LayoutTemplate,
  Trash2,
  Plus,
  X,
  Files,
  Pencil,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { api, ResumeVersion, ResumeTemplate } from "@/lib/api";
import { Mono } from "@/components/mono";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WorkshopOnboarding } from "@/views/resume/workshop-onboarding";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

type ChatMessage = { role: "user" | "assistant"; content: string; pending?: boolean };

const TEMPLATE_STORAGE_KEY = "pathway.resumeTemplateId";
const CHAT_COLLAPSED_STORAGE_KEY = "pathway.workshopChatCollapsed";

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

  // Tabs open in this session (a subset of `versions`, by id) vs. the one
  // currently shown. activeVersion === null means the blank "New" tab.
  const [openTabs, setOpenTabs] = useState<string[]>([]);
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

  // Saved-resumes management (rename / delete / open)
  const [savedResumesOpen, setSavedResumesOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);
  const [pendingClose, setPendingClose] = useState<{ id: string; label: string } | null>(null);

  // Collapsible chat/composer panel. Starts open on both server and client to
  // avoid an SSR/hydration mismatch, then syncs to the stored preference.
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [chatCollapsedLoaded, setChatCollapsedLoaded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem(CHAT_COLLAPSED_STORAGE_KEY) === "1") {
      setChatCollapsed(true);
    }
    setChatCollapsedLoaded(true);
  }, []);

  useEffect(() => {
    if (chatCollapsedLoaded && typeof window !== "undefined") {
      localStorage.setItem(CHAT_COLLAPSED_STORAGE_KEY, chatCollapsed ? "1" : "0");
    }
  }, [chatCollapsed, chatCollapsedLoaded]);

  const activeVersionData = versions.find((v) => v.id === activeVersion) ?? null;
  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const openTabVersions = openTabs
    .map((id) => versions.find((v) => v.id === id))
    .filter((v): v is ResumeVersion => Boolean(v));
  const versionIndex = new Map(versions.map((v, i) => [v.id, i]));

  // The active tab counts as "dirty" only while its editor is open and the
  // draft differs from what's saved — editing only ever applies to the
  // active tab, so no other open tab can be dirty.
  const activeTabDirty = Boolean(
    activeVersion &&
    editorOpen &&
    activeVersionData &&
    editedLatex !== activeVersionData.latexSource,
  );

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
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(TEMPLATE_STORAGE_KEY) : null;
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
        // Don't auto-open anything: the workshop starts on the blank "New"
        // tab, previewing the selected template, until you open a saved
        // resume or generate one.
        setVersions(fetched);
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
        {
          role: "assistant",
          content: "Pick a template first — use the Template selector at the top right.",
        },
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
      setOpenTabs((prev) => [...prev, version.id]);
      setActiveVersion(version.id);
      const warningNote = warnings.length > 0 ? ` Heads up — ${warnings.join("; ")}` : "";
      replaceLastMessage(
        `Done — drafted ${version.label}. Check the preview on the right; download it once it looks good, or click "Edit LaTeX" to fine-tune anything by hand.${warningNote}`,
      );
    } catch (err) {
      replaceLastMessage(
        `Couldn't draft a new version: ${err instanceof Error ? err.message : "unknown error"}`,
      );
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

  // --- Tabs: open / close ----------------------------------------------------

  function openVersion(id: string) {
    setOpenTabs((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setActiveVersion(id);
    setSavedResumesOpen(false);
  }

  function closeTab(id: string) {
    const idx = openTabs.indexOf(id);
    setOpenTabs((prev) => prev.filter((x) => x !== id));
    if (activeVersion === id) {
      const fallback = openTabs[idx + 1] ?? openTabs[idx - 1] ?? null;
      setActiveVersion(fallback);
      setEditorOpen(false);
    }
  }

  function requestCloseTab(id: string, label: string) {
    if (id === activeVersion && activeTabDirty) {
      setPendingClose({ id, label });
    } else {
      closeTab(id);
    }
  }

  async function handleSaveAndClose() {
    const target = pendingClose;
    setPendingClose(null);
    if (!target) return;
    await handleSaveLatex();
    closeTab(target.id);
  }

  function handleDiscardAndClose() {
    const target = pendingClose;
    setPendingClose(null);
    if (!target) return;
    closeTab(target.id);
  }

  // --- Saved resumes: rename / delete -----------------------------------------

  function startRename(v: ResumeVersion) {
    setRenamingId(v.id);
    setRenameDraft(v.label);
  }

  async function commitRename(id: string) {
    const label = renameDraft.trim();
    setRenamingId(null);
    const original = versions.find((v) => v.id === id);
    if (!label || !original || label === original.label) return;
    try {
      const updated = await api.resume.update(id, { label });
      setVersions((prev) => prev.map((v) => (v.id === id ? { ...v, ...updated } : v)));
    } catch (err) {
      setVersionsError(err instanceof Error ? err.message : "Failed to rename resume");
    }
  }

  async function confirmDelete() {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await api.resume.remove(target.id);
      setVersions((prev) => prev.filter((v) => v.id !== target.id));
      closeTab(target.id);
    } catch (err) {
      setVersionsError(err instanceof Error ? err.message : "Failed to delete resume version");
    }
  }

  // --- Templates ---------------------------------------------------------------

  const handleSaveTemplate = async () => {
    setSavingTpl(true);
    setTplError(null);
    try {
      const created = await api.resume.templates.create({
        name: tplName.trim(),
        latexSource: tplSource,
      });
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
      <WorkshopOnboarding />
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChatCollapsed((c) => !c)}
            title={chatCollapsed ? "Show job description panel" : "Hide job description panel"}
            className="flex items-center justify-center rounded-md p-1.5 text-text-tertiary hover:bg-surface hover:text-foreground"
          >
            {chatCollapsed ? (
              <PanelLeft className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
          <h1 className="text-base font-semibold tracking-tight">Resume Workshop</h1>
        </div>
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
          <button
            type="button"
            onClick={() => setSavedResumesOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-border-strong"
          >
            <Files className="size-3.5 text-text-tertiary" /> Saved Resumes
            {versions.length > 0 && <span className="text-text-tertiary">({versions.length})</span>}
          </button>
          <Link
            to="/app/resume/profile"
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs hover:border-border-strong"
          >
            <UserCog className="size-3.5 text-text-tertiary" /> Edit profile
          </Link>
        </div>
      </header>

      <div
        className={`grid min-h-0 flex-1 overflow-hidden ${chatCollapsed ? "grid-cols-1" : "grid-cols-[380px_1fr]"}`}
      >
        {!chatCollapsed && (
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
        )}

        <div className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="tab-scroll flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveVersion(null)}
                className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${!activeVersion ? "border-primary bg-primary/10" : "border-border hover:border-border-strong"}`}
              >
                <Plus className="size-3.5" /> New
              </button>
              {openTabVersions.map((v) => (
                <div
                  key={v.id}
                  className={`flex shrink-0 items-center gap-1.5 rounded-md border py-1 pl-2.5 pr-1 text-xs ${activeVersion === v.id ? "border-primary bg-primary/10" : "border-border hover:border-border-strong"}`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveVersion(v.id)}
                    className="flex max-w-[9rem] items-center gap-1.5"
                    title={v.label}
                  >
                    <Mono>v{(versionIndex.get(v.id) ?? 0) + 1}</Mono>
                    <span className="truncate text-text-secondary">{v.label}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => requestCloseTab(v.id, v.label)}
                    className="shrink-0 rounded p-0.5 text-text-tertiary hover:bg-background hover:text-foreground"
                    aria-label={`Close ${v.label}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {!activeVersion && (
                <span className="shrink-0 text-xs text-text-tertiary">
                  New resume · previewing{" "}
                  <span className="text-text-secondary">
                    {selectedTemplate?.name ?? "no template"}
                  </span>
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
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

          <div
            className={`min-h-0 flex-1 overflow-hidden ${editorOpen ? "grid grid-cols-2" : "flex"}`}
          >
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
                    <Save className="size-3.5" />{" "}
                    {isSavingLatex ? "Saving…" : latexSaved ? "Saved!" : "Save"}
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

      {/* Templates: select / import / delete custom ones */}
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

      {/* Saved resumes: open / rename / delete every version you've generated */}
      <Dialog open={savedResumesOpen} onOpenChange={setSavedResumesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Saved resumes</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            {versionsError && <p className="text-xs text-destructive">{versionsError}</p>}
            {[...versions].reverse().map((v) => (
              <div
                key={v.id}
                className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${activeVersion === v.id ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {renamingId === v.id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename(v.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    onBlur={() => commitRename(v.id)}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-border-strong"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => openVersion(v.id)}
                    className="flex-1 truncate text-left"
                  >
                    <Mono>v{(versionIndex.get(v.id) ?? 0) + 1}</Mono>{" "}
                    <span className="text-foreground">{v.label}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => startRename(v)}
                  className="shrink-0 rounded p-1 text-text-tertiary hover:bg-background hover:text-foreground"
                  aria-label={`Rename ${v.label}`}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete({ id: v.id, label: v.label })}
                  className="shrink-0 rounded p-1 text-text-tertiary hover:bg-background hover:text-destructive"
                  aria-label={`Delete ${v.label}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {versions.length === 0 && (
              <p className="text-xs text-text-tertiary">
                {versionsLoading
                  ? "Loading…"
                  : "No saved resumes yet — generate one from the workshop."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm permanently deleting a saved resume */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{pendingDelete?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes this resume version and its LaTeX source. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={buttonVariants({ variant: "destructive" })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Closing a tab with unsaved LaTeX edits */}
      <AlertDialog
        open={pendingClose !== null}
        onOpenChange={(open) => !open && setPendingClose(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save changes to "{pendingClose?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              You've edited this resume's LaTeX in the editor and haven't saved. Save before closing
              the tab, or discard the edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <button
              type="button"
              onClick={handleDiscardAndClose}
              className={buttonVariants({ variant: "outline", className: "mt-2 sm:mt-0" })}
            >
              Discard
            </button>
            <AlertDialogAction onClick={handleSaveAndClose}>Save & close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        .tab-scroll { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .tab-scroll::-webkit-scrollbar { height: 6px; }
        .tab-scroll::-webkit-scrollbar-track { background: transparent; }
        .tab-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px; }
      `}</style>
    </div>
  );
}
