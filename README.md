# Pathway

**Your job search, on autopilot.**

Pathway is a job application tracker that reads your Gmail inbox with AI to automatically detect and log every application update, thank-you replies, online assessment invites, interview scheduling, offers, and rejections, so you never have to update a spreadsheet by hand again. It pairs that with a full analytics dashboard and an AI-powered resume workshop that tailors a LaTeX resume to a specific role in seconds.

## Features

### Automatic email tracking
Connect your Gmail account and Pathway scans your inbox for application-related email. A two-stage pipeline keeps this fast and cheap: a free, deterministic Gmail search narrows the inbox down to likely candidates (known ATS platforms like Greenhouse and Lever, generic hiring-sender patterns like `careers@`/`recruiting@` on any domain, and application-related keywords), and only that narrowed set is sent to Claude for classification. Claude extracts the company, position, and stage (applied, OA, interview, offer, rejected) for each match, and Pathway matches it against your existing applications or creates a new one. An initial calibration scan lets you choose how far back to look; every scan after that automatically picks up only what's new since the last sync.

### Dashboard
A Kanban board and table view of every application, searchable and filterable by stage. Add applications manually, or let Gmail sync do it for you, either way, click into any application to see its full status history and add notes.

### Analytics
Live-computed stats from your real application data: response rate, average time to first response, a funnel from applied through offer/rejected, average time spent in each stage, and a running count of ghosted applications.

### Resume Workshop
An AI copilot that drafts a tailored LaTeX resume for a specific role, compiles it to a downloadable PDF, and keeps a version history so you can go back to any previous draft.

### Accounts & security
Sign up with email and password or Google, and use either method interchangeably on the same account. Sessions are httpOnly cookies over HTTPS, passwords are bcrypt-hashed, and Gmail refresh tokens are encrypted at rest.

## Tech Stack

**Frontend**
- React 19 + TanStack Start/Router (SSR)
- TypeScript
- Tailwind CSS + Radix UI/shadcn components
- TanStack Query
- Recharts
- Zod

**Backend**
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL

**AI & External Services**
- Anthropic Claude API (email classification and resume generation, via tool-use/function calling for reliable structured output)
- Google Gmail API
- Google OAuth 2.0
- Tectonic (LaTeX → PDF compilation)

**Auth & Security**
- JWT sessions in httpOnly cookies
- bcrypt password hashing
- AES-256-GCM encryption for stored Gmail refresh tokens

## Project Structure

```
.
├── frontend/               React + TanStack Start app
│   └── src/
│       ├── routes/         Page routes (landing, auth, onboarding, dashboard, analytics, resume, settings)
│       ├── components/     Shared UI components
│       ├── hooks/          Data-fetching hooks
│       └── lib/            API client and utilities
│
└── backend/                Express API
    ├── prisma/             Database schema and migrations
    └── src/
        ├── routes/         auth, applications, status-events, users, gmail, resume
        ├── lib/             Gmail scanning pipeline, Claude client, LaTeX compilation, encryption, Prisma client
        └── middleware/      Auth middleware
```

## Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database
- A Google Cloud OAuth client (for login and Gmail access)
- An Anthropic API key
- [Tectonic](https://tectonic-typesetting.github.io/en-US/install.html) (LaTeX compiler used by the resume workshop) — install via the official installer:
  ```bash
  curl --proto '=https' --tlsv1.2 -fsSL https://drop-sh.fullyjustified.net | sh
  ```
  or your OS package manager (`brew install tectonic` on macOS), then confirm it resolves: `tectonic --version`. Only needed for local dev if you want working resume PDF previews — everything else runs without it. Not required if you're running the backend via the provided `backend/Dockerfile`, which bundles it.

### Backend setup

```bash
cd backend
npm install
```

Create a `.env` file (see `backend/.env.example` for the full list, including optional LaTeX-compile tuning vars):

```
DATABASE_URL=postgresql://...
JWT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
GMAIL_TOKEN_SECRET=          # 64 hex characters
ANTHROPIC_API_KEY=
CLIENT_URL=http://localhost:8080
PORT=3000
```

```bash
npx prisma migrate dev
npm run dev
```

### Frontend setup

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:8080` by default, talking to the backend at `http://localhost:3000`.

## Team

Built by Group 4: Teamir Teshome, Amanda Baker, Yu Ting "Michael" Kuo, and Amon Garner-Poston.
