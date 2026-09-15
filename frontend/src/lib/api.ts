import type { Application } from "@/lib/mock-data";
import { getIncomingCookieHeader } from "@/lib/ssr-cookie";
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  const cookie = getIncomingCookieHeader();
  if (cookie) headers.cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> | undefined) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export interface User {
  id: string;
  email: string;
  name: string;
  hasPassword: boolean;
  gmailConnected: boolean;
  ghostedThresholdDays: number;
  createdAt: string;
}

export interface ResumeVersion {
  id: string;
  userId: string;
  label: string;
  latexSource: string;
  targetRole: string | null;
  jobDescription: string | null;
  selectionDescriptor: unknown;
  templateId?: string | null;
  templateName?: string | null;
  createdAt: string;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  latexSource: string;
  builtin: boolean;
}

export interface ContactLink {
  url: string;
  label: string;
}

export interface ContactVariant {
  key: string;
  name: string;
  email: string;
  phone: string;
  links: ContactLink[];
  location: string;
  title: string;
}

export interface SummaryVariant {
  key: string;
  label: string;
  text: string;
}

export interface SkillCategory {
  category: string;
  items: string[];
}

export interface ExperienceEntry {
  org: string;
  location: string;
  role: string;
  date: string;
  bullets: string[];
}

export interface ResearchEntry {
  org: string;
  location: string;
  role: string;
  title: string;
  description: string;
}

export interface ProjectEntry {
  name: string;
  description: string;
}

export interface InvolvementEntry {
  name: string;
  description: string;
}

export interface EducationEntry {
  school: string;
  location: string;
  degree: string;
  date: string;
  gpa: string;
  honors: string;
  coursework: string;
}

export type SectionKind =
  | "summary"
  | "education"
  | "experience"
  | "projects"
  | "skills"
  | "involvement"
  | "research";

export interface SectionMeta {
  kind: SectionKind;
  /** Heading text shown on the generated resume. */
  title: string;
  visible: boolean;
}

export interface ResumeProfile {
  id: string | null;
  contact: ContactVariant[];
  summary: SummaryVariant[];
  skills: SkillCategory[];
  experience: ExperienceEntry[];
  research: ResearchEntry[];
  projects: ProjectEntry[];
  involvement: InvolvementEntry[];
  education: EducationEntry[];
  sections: SectionMeta[];
  updatedAt: string | null;
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; name: string }) =>
      request<{ user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),

    login: (body: { email: string; password: string }) =>
      request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),

    logout: () =>
      request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),

    me: () =>
      request<User>("/api/auth/me"),

    googleUrl: () => `${BASE}/api/auth/google`,
  },

  gmail: {
    connectUrl: () => `${BASE}/api/gmail/connect`,
    disconnect: () =>
      request<{ ok: boolean }>("/api/gmail/disconnect", { method: "DELETE" }),
  },

  users: {
    updateMe: (body: { name?: string; ghostedThresholdDays?: number }) =>
      request<User>("/api/users/me", { method: "PATCH", body: JSON.stringify(body) }),

    changePassword: (body: { currentPassword?: string; newPassword: string }) =>
      request<{ ok: boolean }>("/api/users/me/password", { method: "PATCH", body: JSON.stringify(body) }),

    deleteMe: () =>
      request<{ ok: boolean }>("/api/users/me", { method: "DELETE" }),
  },
  
  applications: {
    list: (params?: { search?: string; stage?: string }) => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.stage && params.stage !== "all") qs.set("stage", params.stage);
      return request<Application[]>(`/api/applications?${qs}`);
    },

    create: (body: {
      company: string;
      position: string;
      location?: string;
      stage?: string;
      salary?: string;
      notes?: string;
    }) =>
      request<Application>("/api/applications", {
        method: "POST",
        body: JSON.stringify(body),
      }),

    update: (id: string, body: Partial<Application>) =>
      request<Application>(`/api/applications/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    remove: (id: string) =>
      request<{ ok: boolean }>(`/api/applications/${id}`, {
        method: "DELETE",
      }),
  },

  resume: {
    list: () => request<ResumeVersion[]>("/api/resume"),

    create: (body: { label: string; latexSource: string; targetRole?: string }) =>
      request<ResumeVersion>("/api/resume", { method: "POST", body: JSON.stringify(body) }),

    update: (id: string, body: Partial<{ label: string; latexSource: string; targetRole: string }>) =>
      request<ResumeVersion>(`/api/resume/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

    remove: (id: string) =>
      request<{ ok: boolean }>(`/api/resume/${id}`, { method: "DELETE" }),

    templates: {
      list: () => request<ResumeTemplate[]>("/api/resume/templates"),

      create: (body: { name: string; latexSource: string }) =>
        request<ResumeTemplate>("/api/resume/templates", { method: "POST", body: JSON.stringify(body) }),

      update: (id: string, body: Partial<{ name: string; latexSource: string }>) =>
        request<ResumeTemplate>(`/api/resume/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

      remove: (id: string) =>
        request<{ ok: boolean }>(`/api/resume/templates/${id}`, { method: "DELETE" }),
    },

    generate: (body: { jobDescription: string; templateId: string; targetRole?: string; label?: string }) =>
      request<ResumeVersion & { warnings: string[] }>("/api/resume/generate", { method: "POST", body: JSON.stringify(body) }),

    renderPdf: async (latex: string): Promise<Blob> => {
      const cookie = getIncomingCookieHeader();
      const res = await fetch(`${BASE}/api/resume/render-pdf`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
        body: JSON.stringify({ latex }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Render failed (${res.status}): ${text || res.statusText}`);
      }
      return res.blob();
    },
  },

  resumeProfile: {
    get: () => request<ResumeProfile>("/api/resume/profile"),

    update: (body: Omit<ResumeProfile, "id" | "updatedAt">) =>
      request<ResumeProfile>("/api/resume/profile", { method: "PUT", body: JSON.stringify(body) }),
  },
};
