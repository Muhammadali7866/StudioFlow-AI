# StudioFlow AI — Production-Ready Monorepo Foundation

StudioFlow AI is an automated, AI-driven video production pipeline built on Next.js, Express, Google ADK, Google Cloud Firestore, Cloud Storage, and Docker.

---

## Architecture Overview

```
Next.js Frontend (apps/web)
       │
       ▼
Node.js + Express API (apps/api)
       │
       ├─────────────────────┐
       ▼                     ▼
Google ADK (packages/agents)   Google Cloud Services
       │                     ├─ Firestore (Metadata DB)
       ▼                     └─ Cloud Storage (Media Bucket)
Google Gemini Model
```

---

## Monorepo Structure

```
studioflow-ai/
├── apps/
│   ├── web/            # Next.js App Router (TypeScript, Tailwind CSS)
│   └── api/            # Express TypeScript API Backend
├── packages/
│   ├── agents/         # Google ADK & Gemini Agent Integration
│   ├── shared/         # Common TypeScript Domain Contracts & DTOs
│   └── config/         # Environment Validation & Runtime Configuration
├── infra/              # Deployment manifests & infrastructure configs
├── docs/               # Architecture diagrams and system specifications
│   └── architecture.md # Detailed vertical slice flow documentation
├── .env.example        # Environment variable templates
├── .gitignore          # Git ignore rules
├── docker-compose.yml  # Local multi-container development environment
├── package.json        # Workspace orchestrator scripts
└── README.md           # Getting started guide
```

---

## Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher (Workspace support enabled)
- **Docker**: Optional, for container deployment

---

## Environment Variables

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

| Key | Description | Default |
| --- | --- | --- |
| `PORT` | API backend server port | `4000` |
| `NEXT_PUBLIC_API_URL` | Frontend API target URL | `http://localhost:4000` |
| `GOOGLE_CLOUD_PROJECT_ID` | GCP Project ID | `studioflow-ai-dev` |
| `GOOGLE_CLOUD_REGION` | GCP Region | `us-central1` |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Service Account JSON key | `./keys/gcp-service-account.json` |
| `FIRESTORE_DATABASE_ID` | Target Firestore Database ID | `(default)` |
| `GOOGLE_CLOUD_STORAGE_BUCKET` | Target Cloud Storage Bucket Name | `studioflow-ai-media-dev` |
| `GEMINI_API_KEY` | Google Gemini API Key | `your-gemini-api-key-here` |
| `GEMINI_MODEL` | Target Gemini Model ID | `gemini-2.5-flash` |

*Note: If GCP credentials or Gemini API keys are omitted during initial local development, the backend automatically operates in fallback mode while keeping all APIs and endpoints fully operational.*

---

## Quick Start & Local Execution

### 1. Install Dependencies

Install all dependencies across the entire monorepo from the root:

```bash
npm install
```

### 2. Development Mode

Launch all workspaces concurrently (Web App on `:3000`, Express API on `:4000`):

```bash
npm run dev
```

Or launch specific workspaces individually:

```bash
# Start API only
npm run dev:api

# Start Web Frontend only
npm run dev:web
```

---

## Workspace Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Runs Express API and Next.js Frontend in watch mode |
| `npm run build` | Builds all packages (`packages/*`) and application bundles (`apps/*`) |
| `npm run lint` | Runs ESLint checks across all TypeScript files |
| `npm run typecheck` | Validates TypeScript types across all workspace packages |

---

## Docker Execution

To spin up the entire application stack using Docker Compose:

```bash
docker compose up --build
```

Access services:
- **Web App**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000](http://localhost:4000)

---

## Milestone 1 Implementation Status

- [x] Monorepo workspace foundation with `npm`
- [x] Shared TypeScript contracts (`packages/shared`)
- [x] Environment configuration validation (`packages/config`)
- [x] Google ADK package & Root Agent (`packages/agents`)
- [x] Express API backend with health checks & status reporting (`apps/api`)
- [x] Firestore & Storage service wrappers with local fallback
- [x] Project creation and video asset upload endpoints
- [x] Gemini connectivity test endpoint (`POST /api/agent/test`)
- [x] Next.js App Router UI with status badge & video upload flow (`apps/web`)
- [x] First Vertical Architecture Slice end-to-end integration (Create → Upload → Gemini → Display)
- [x] Unified error handling and response formatting
- [x] Cloud Run compatible Dockerfiles & Docker Compose setup
