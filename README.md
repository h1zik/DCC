<div align="center">

# 🛡️ Dominatus Control Center

### One command center for operations, brand intelligence, SEO & market research.

DCC unifies company operations, finance, workspaces, brand strategy, content planning, SEO intelligence and AI-powered market research in a single real-time Next.js workspace.

<br/>

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-DB-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## ✨ Overview

**Dominatus Control Center** is a private internal platform for running the operating rhythm of Dominatus. It combines role-based team workspaces, finance operations, logistics/master data, brand & creative research, SEO workflows, content ideation, and AI-assisted market intelligence.

The application is built on a single **Next.js 16 App Router** codebase backed by **PostgreSQL + Prisma**. It also includes an optional **MCP read-only bridge** so external AI agents can query selected DCC intelligence endpoints programmatically.

> [!NOTE]
> This is a proprietary internal product. Keep `.env`, credentials, API keys, uploads and production data out of source control.

---

## 🚀 Features

### 🧭 Operations & Workspaces

- **Executive Overview** — high-level KPI dashboard for CEO monitoring.
- **Home / My Work / Projects** — personal task focus, project pipelines and work summaries.
- **Workspaces & Rooms** — room-based collaboration with members, tasks, documents, wiki-style views and content planning.
- **Kanban Tasks** — drag-and-drop task boards powered by `dnd-kit`, including room-level task organization.
- **Schedule** — shared calendar and meeting/task reminders.
- **Attendance** — employee check-in with face recognition via `@vladmandic/face-api`, plus attendance reports/export.
- **Approvals** — operational and finance approval flows.
- **Messages** — direct chat, room chat, unread counters, GIF support and presence APIs.
- **Notifications** — web push via VAPID and optional WhatsApp integration.
- **Changelog** — internal “what’s new” area for users.

### 💰 Finance & Commercial Control

- **Financial Overview** — finance dashboard and summary insights.
- **Chart of Accounts** — structured accounting master data.
- **Journals & General Ledger** — journal entries, ledgers and posting flows.
- **Bank Reconciliation** — bank/cash matching workflows.
- **Exchange Rates** — currency support for finance operations.
- **Cash & Treasury** — treasury movement and cash position tracking.
- **AP & AR** — payables/receivables aging and operational views.
- **Brand & Costing** — brand-level cost tracking and costing visibility.
- **Budget vs Actual** — budget control and variance tracking.
- **Expense Approvals, Reports & Fixed Assets** — finance governance and reporting modules.

### 📦 Logistics & Master Data

- **Brands** — brand master data and ownership context.
- **Products & SKU** — product catalog and SKU management.
- **Inventory** — stock visibility and inventory alerts.
- **Vendors / Contract Manufacturers** — supplier and manufacturing partner records.

### 🔬 Research Hub

- **Product Discovery** — discover promising products across marketplaces.
- **Competitor Tracker** — track competitors by URL/category with product, price and sales history.
- **Review Intelligence** — scrape and analyze buyer reviews for sentiment, complaints, demographics and opportunities.
- **Keyword Intel** — search-volume and marketplace keyword research using DataForSEO and trend signals.
- **Trend Radar & Social Listening** — RSS, Google Trends, TikTok/Instagram/Pinterest-style signal collection and digesting.
- **USP Analyzer, Concept Lab & Product Innovation** — convert market evidence into positioning and product strategy.
- **Research Reports** — citation-backed reports with PDF/DOCX-oriented export flows.

### 🎨 Brand & Creative Hub

- **Brand Strategy** — evidence-backed strategy generation and brand research readers.
- **Audience Research** — audience insights and positioning support.
- **Creative Guideline** — creative direction and brand communication support.
- **Visual Trend & Visual Library** — moodboards, visual references and inspiration workflows.
- **Ad Library** — competitor ad monitoring and scoring.
- **Brand-level Review, Keyword, Competitor, USP, Trend and Social modules** — brand-focused versions of core research workflows.

### 📈 SEO Toolkit

- **Keyword Research** — clustering, opportunity analysis and DataForSEO-backed keyword data.
- **Rank Tracker** — rank checks and rank-change analysis.
- **Content Briefs & Drafts** — SEO content planning, scoring and draft workflows.
- **Marketplace SEO** — marketplace listing analysis and rules.
- **On-page Audit** — page audit rules and recommendations.
- **Crawler** — crawl jobs and crawl result views.
- **Backlinks** — backlink gap analysis and profile detail pages.
- **SEO Reports** — report pages with DOCX export route support.

### ✍️ Content Studio

- **Idea Generation** — content ideas grounded in brand/research context.
- **Content Planning** — room-level content planning and download/export flows.
- **Studio Workflow Support** — routes and permissions for studio/project-manager teams.

### 🤖 AI & Automation

- **In-app AI Agent** — chat-style assistant panel/module connected to DCC data APIs.
- **AI read APIs** — guarded `/api/ai/*` endpoints for summaries, research, finance, SEO, tasks, rooms and organization data.
- **LLM Providers** — Gemini by default, with Groq package support and Ollama/Ollama Cloud-style provider configuration for research tiers.
- **Research Jobs & Cron** — scheduled sync endpoints for research, SEO and task workflows.
- **Marketplace Data Pipeline** — custom VPS scraper API for Shopee/Tokopedia/Lazada-style data, with Apify fallback actors.
- **MCP Server** — optional read-only MCP bridge for external AI/agent access.

---

## 👥 Role-Based Access

DCC is organized around role-aware navigation and route access. Main role areas include:

| Role / Area | Typical Access |
|---|---|
| **CEO** | Executive overview, approvals, projects, tasks, rooms, attendance, schedule and AI agent monitoring |
| **Administrator** | Home, workspaces, brands, users, roles/access, app branding, tasks, rooms and support areas |
| **Finance** | Finance modules, attendance and finance-specific approvals/reports |
| **Logistics** | Inventory, products/SKUs, vendors, schedule and attendance |
| **Studio / Project Manager** | Home, Content Studio, workspaces, projects, schedule, attendance and AI agent |
| **Market Analyst** | Research Hub, SEO Toolkit, Content Studio, workspaces and market intelligence flows |
| **Brand Manager** | Brand & Creative Hub, Research Hub, SEO Toolkit, Content Studio and brand workflows |

---

## 🧱 Tech Stack

| Layer | Technologies |
|---|---|
| **Framework** | Next.js 16 App Router, React 19, TypeScript 5 |
| **Styling / UI** | Tailwind CSS 4, Base UI, shadcn-style components, `lucide-react`, `next-themes`, `sonner` |
| **Database / ORM** | PostgreSQL, Prisma 6.19.x, 100 Prisma models and 71 enums |
| **Auth** | NextAuth v5 beta + Prisma adapter, `bcryptjs` |
| **AI / LLM** | Google Generative AI / Gemini, Groq SDK, Ollama/Ollama Cloud-style research provider config |
| **Research / Scraping** | Custom scraper API, Apify, `cheerio`, `rss-parser`, `google-trends-api`, DataForSEO |
| **Charts / Tables** | ECharts, Recharts, TanStack Table |
| **Editor / Docs** | TipTap, `html-to-docx`, `jspdf`, `pdf-parse`, `pdfjs-dist`, `react-markdown` |
| **Media** | `sharp`, `fluent-ffmpeg`, ffmpeg/ffprobe installers |
| **Realtime / Notify** | Presence APIs, Web Push, optional WhatsApp/Fonnte integration |
| **Validation / Forms** | `zod`, `react-hook-form` |
| **Testing / Tooling** | ESLint 9, Vitest 3, `tsx`, Prisma CLI |

---

## 🏁 Getting Started

### Prerequisites

- **Node.js 20+**
- **PostgreSQL 14+** or another reachable PostgreSQL-compatible database
- A package manager; this repo uses npm scripts by default
- Optional integration credentials for Gemini, DataForSEO, Apify, scraper API, Web Push and Fonnte

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env
```

At minimum, local development usually needs:

- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL`
- `DEFAULT_CEO_PASSWORD` if you want seed/bootstrap to create the CEO account

### 3. Set up the database

```bash
npm run db:push
npm run db:seed
```

> [!IMPORTANT]
> Database scripts are guarded against data loss: `db:migrate`/`db:deploy` run `prisma db push` **without** `--accept-data-loss`, so Prisma refuses destructive schema changes instead of silently dropping data. Before deploying schema changes to production, run `npm run db:backup` (pg_dump) and `npm run db:diff` to preview the exact SQL that will be applied. Destructive helper scripts (e.g. `db:clear-projects`) refuse to run against a non-localhost database unless `FORCE_DESTRUCTIVE_DB=1` is set explicitly.

### 4. Run the dev server

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**.

---

## 📜 Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Generate Prisma client and build the production app |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite |
| `npm run postinstall` | Generate Prisma client after install |
| `npm run db:push` | Push the Prisma schema to the database (refuses destructive changes) |
| `npm run db:diff` | Preview the SQL needed to bring the database in sync with the Prisma schema (read-only) |
| `npm run db:backup` | Back up the database to `./backups/` via `pg_dump` (requires PostgreSQL client tools) |
| `npm run db:migrate` | Run Kanban schema evolution scripts, then Prisma db push (refuses destructive changes) |
| `npm run db:deploy` | Preview pending SQL, run Kanban evolution, Prisma db push (refuses destructive changes), then Kanban backfill |
| `npm run db:evolve-kanban` | Run Kanban-related schema evolution scripts |
| `npm run db:evolve-kanban-position` | Execute task Kanban position SQL evolution |
| `npm run db:evolve-room-kanban-columns` | Execute room Kanban columns SQL evolution |
| `npm run db:evolve-pipeline-enum` | Execute pipeline stage enum SQL evolution |
| `npm run db:backfill-kanban` | Backfill hybrid Kanban data |
| `npm run db:verify-kanban` | Verify Kanban migration state |
| `npm run db:clear-projects` | Delete ALL projects (dev helper; blocked on remote databases unless `FORCE_DESTRUCTIVE_DB=1`) |
| `npm run db:seed` | Seed initial database data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run eval:research` | Run review-analysis evaluation script |

---

## 🔐 Environment Variables

Use `.env.example` as the source of truth for local setup. The most important groups are summarized below.

### Core / App

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth session secret |
| `NEXTAUTH_URL` | Canonical app URL for auth callbacks |
| `DEFAULT_CEO_PASSWORD` | Bootstrap password for the seeded CEO account; empty means no automatic CEO creation |
| `CRON_SECRET` | Shared secret for cron endpoints |
| `ALLOW_DEMO_DATA` | Allows synthetic demo scrape data when scrapers are unconfigured; should stay disabled in production unless intentionally needed |

### Notifications & Media

| Variable | Description |
|---|---|
| `FONNTE_API_KEY` | Optional WhatsApp notification provider key |
| `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` | VAPID public key for browser push |
| `WEB_PUSH_PRIVATE_KEY` | VAPID private key |
| `WEB_PUSH_SUBJECT` | VAPID subject, usually `mailto:...` |
| `GIPHY_API_KEY` | GIF picker support for chat |

### AI / LLM

| Variable | Description |
|---|---|
| `RESEARCH_LLM_PROVIDER` | Default research provider, e.g. `gemini` or `ollama-cloud` |
| `RESEARCH_LLM_PROVIDER_PRO` | Optional provider override for pro/report-grade tasks |
| `RESEARCH_LLM_PROVIDER_FLASH` | Optional provider override for flash/bulk tasks |
| `GEMINI_API_KEY` / `GOOGLE_AI_API_KEY` | Google Gemini credentials |
| `AGENT_LLM_MODEL` | Model used by the in-app AI Agent |
| `GEMINI_MODEL` | Optional Gemini flash-tier override |
| `GEMINI_MODEL_PRO` | Optional Gemini pro-tier override |
| `OLLAMA_API_KEY` | Ollama/Ollama Cloud API key |
| `OLLAMA_BASE_URL` | Ollama-compatible API base URL |
| `RESEARCH_OLLAMA_MODEL_FLASH` | Ollama model for flash-tier research tasks |
| `RESEARCH_OLLAMA_MODEL_PRO` | Ollama model for pro-tier research tasks |
| `RESEARCH_OLLAMA_THINK_FLASH` / `RESEARCH_OLLAMA_THINK_PRO` | Optional reasoning/think controls for Ollama research tiers |

### Scraping & Research

| Variable | Description |
|---|---|
| `SCRAPER_API_URL` / `SCRAPER_API_KEY` | Internal VPS scraper API endpoint and key |
| `SCRAPER_SHOPEE_DISCOVER_DETAILS` | Controls Shopee discovery hydration behavior |
| `APIFY_API_TOKEN` | Apify API token for fallback scrapers |
| `APIFY_ACTOR_TOKOPEDIA_*` | Tokopedia scraping actors |
| `APIFY_ACTOR_TIKTOK_*` | TikTok Shop, trends and comments actors |
| `APIFY_ACTOR_SHOPEE_*` | Shopee product/review/autocomplete actors |
| `APIFY_ACTOR_INSTAGRAM` | Instagram scraping actor |
| `APIFY_ACTOR_PINTEREST` | Pinterest scraping actor |
| `APIFY_ACTOR_META_AD_LIBRARY` | Meta ad library scraping actor |
| `BRAND_PINTEREST_MAX_PINS_PER_KEYWORD` | Pinterest visual research limit per keyword |
| `TREND_RSS_FEEDS` | Comma-separated RSS feeds for Trend Radar |

### DataForSEO & SEO Toolkit

| Variable | Description |
|---|---|
| `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD` | DataForSEO API credentials |
| `DATAFORSEO_LOCATION_CODE` | Default search location code |
| `DATAFORSEO_LANGUAGE_CODE` | Default search language code |
| `DATAFORSEO_MAX_KEYWORDS` | Keyword retrieval cap |
| `DATAFORSEO_CACHE_TTL_HOURS` | Response cache TTL in hours to control API cost |

### AI Read API / MCP Bridge

| Variable | Description |
|---|---|
| `AI_READ_API_TOKEN` | Token for guarded read-only AI API access |
| `AI_READ_API_ROLE` | Server-bound effective role for AI read API access |
| `AI_READ_API_ALLOW_ROLE_HEADER` | Development-only override to honor `x-dcc-role`; keep disabled in production |
| `MCP_PORT` / `MCP_SERVER_URL` | Optional MCP server host/port |
| `MCP_CLIENT_ID` / `MCP_CLIENT_SECRET` | Optional MCP client auth values |

---

## 🗂️ Project Structure

```text
DCC/
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Role-based app modules: finance, brand-hub, seo, rooms, tasks, etc.
│   │   ├── api/               # Route handlers: auth, ai, cron, chat, attendance, uploads, push, etc.
│   │   └── uploads/           # Protected upload serving route
│   ├── actions/               # Server actions for domain workflows
│   ├── components/            # UI components, layout, nav, dashboards and feature shells
│   └── lib/                   # Core business logic and integrations
│       ├── ai-api/            # AI API readers/query helpers
│       ├── apify/             # Apify actors and normalization
│       ├── brand-research/    # Brand Hub research, strategy and visual intelligence
│       ├── content-studio/    # Content ideation and grounding logic
│       ├── research/          # Research Hub jobs, analysis, evidence and scoring
│       ├── scraper-api/       # Custom marketplace scraper API integration
│       └── seo/               # SEO Toolkit logic: content, crawler, rank, backlinks, DataForSEO
├── mcp-server/                # Read-only MCP bridge package
├── prisma/                    # Prisma schema, seed and SQL/TS migration helper scripts
├── public/                    # Static assets
└── scripts/                   # Maintenance, evaluation and diagnostic scripts
```

---

## 🧪 Quality & Testing

Current quality tooling includes:

- **ESLint** for static analysis.
- **Vitest** for unit tests around research scoring, SEO rules, scraper normalization, DataForSEO parsing, content scoring, strategy citation validation and related business logic.
- **Prisma generate/validation workflows** through build and database scripts.

Recommended local health check before larger changes:

```bash
npm run lint
npm run test
npm run build
npx prisma validate
```

---

## 🔌 MCP Server

DCC ships with a separate MCP package in `mcp-server/` named **`dcc-odysseus-mcp`**. It acts as a **read-only bridge** from external agents to selected DCC AI/read endpoints, rather than a second full application backend.

Basic MCP package commands:

```bash
cd mcp-server
npm install
npm run build
npm run start
```

Configure both the main DCC app and MCP package with the appropriate `AI_READ_API_*` and `MCP_*` environment variables.

---

## 🚢 Deployment

The app is prepared for Railway-style deployment and persistent upload/media handling. Production builds run:

```bash
npm run build
npm run start
```

Deployment notes:

- Set all required environment variables in the hosting provider.
- Ensure PostgreSQL is reachable from the app runtime.
- Before applying schema changes to production: run `npm run db:backup` (or use your database host's backup feature), then `npm run db:diff` to review the pending SQL, then `npm run db:deploy`. If Prisma warns about possible data loss, STOP — write a manual evolution SQL script (see `prisma/scripts/`) instead of forcing the push.
- Never pass `--accept-data-loss` against production; the npm scripts intentionally omit it so Prisma fails loudly instead of dropping data.
- Native/media packages such as `sharp`, `fluent-ffmpeg`, ffmpeg and ffprobe are configured as external server packages in `next.config.ts`.
- Upload/server-action body limits are configured at **300 MB**. Keep this aligned with hosting limits and storage capacity.
- Global security headers include HSTS, frame protection, content-type protection, referrer policy and a restrictive permissions policy.

---

## 🧭 Development Notes

- This repository uses a newer Next.js version with active API and convention changes. When changing framework behavior, check the local Next.js docs in `node_modules/next/dist/docs/`.
- Prefer existing components and domain helpers before introducing new abstractions.
- Keep route access, server actions and `/api/*` handlers aligned with the role model.
- Keep `.env.example` updated whenever adding or renaming environment variables.
- Avoid committing generated artifacts, local uploads, credentials or dependency folders.

---

## 📄 License

Proprietary — © Dominatus. All rights reserved. Internal use only.

<div align="center">
<br/>
<sub>Built with Next.js · React · Prisma · PostgreSQL</sub>
</div>
