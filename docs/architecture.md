# StudioFlow AI — System Architecture

This document specifies the technical architecture for **StudioFlow AI Milestone 1**.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Web Frontend                     │
│                         (apps/web)                          │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST Requests
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express TypeScript API                    │
│                         (apps/api)                          │
└────────┬─────────────────────┬──────────────────────┬───────┘
         │                     │                      │
         │ REST Calls          │ GCP Client SDK       │ GCP Client SDK
         ▼                     ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Google ADK Agent│  │  Google Cloud    │  │  Google Cloud    │
│(packages/agents) │  │  Firestore DB    │  │  Storage Bucket  │
└────────┬─────────┘  └──────────────────┘  └──────────────────┘
         │ Gemini API
         ▼
┌──────────────────┐
│  Google Gemini   │
└──────────────────┘
```

---

## Data Flow Sequences

### 1. Backend Connectivity & Health Check
1. Next.js app sends HTTP GET request to `http://localhost:4000/health`.
2. Backend responds with `{ "status": "ok" }`.
3. Next.js app queries `http://localhost:4000/api/status`.
4. API verifies Firestore & Storage status and updates connection status indicators in real-time.

### 2. Project Creation & Video Upload
1. User submits project name via Next.js `/projects/new` form.
2. Web client calls `POST /api/projects` with `{ "name": "..." }`.
3. Backend generates unique project ID, saves document in Firestore, and returns the project entity.
4. User selects a video file and submits the upload form.
5. Web client sends multipart request to `POST /api/projects/:projectId/media`.
6. Backend processes file stream via `multer`, uploads video binary to Cloud Storage bucket, persists media metadata in Firestore, and returns the media asset record.

### 3. Google ADK Agent Execution
1. User enters prompt on home page (e.g. *"Hello StudioFlow"*).
2. Web client calls `POST /api/agent/test` with payload `{ "message": "..." }`.
3. Backend invokes `@studioflow/agents` `rootAgent.processMessage()`.
4. Root Agent queries Google Gemini model via `@google/genai` SDK.
5. Gemini response is returned through Express API to the Next.js UI display widget.
