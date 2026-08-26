# Privacy-Aware Visual Context Compiler (PVCC)

**Smart India Hackathon 2026 · Problem SIH26171 — On-device Visual Perception for Light-weight Browser Agents · ISRO / Department of Space**

> **Core principle:** *Maximum useful browser-agent capability with minimum unnecessary disclosure.*

Browser agents need visual/contextual understanding of a webpage to act. Sending raw
screenshots and DOM — including passwords, OTPs, cards, and identity data — to a remote model is a
privacy problem. PVCC perceives, detects and redacts **locally in the browser**, then transmits only
a **sanitized, task-aware minimal context** to the reasoning layer. Every AI-proposed action is
re-checked by a **local action-policy engine** before it can touch the page.

```
RAW WEBPAGE → LOCAL PERCEPTION → LOCAL PII DETECTION → TASK-AWARE SANITIZATION
→ MINIMAL CONTEXT → REMOTE REASONING → LOCAL ACTION POLICY → BROWSER ACTION
```

This pipeline is the heart of the product and is **visible end-to-end** in the Demo Workspace.

---

## 1. Project structure

```
/
├── apps
│   ├── web-dashboard      # React + TS + Vite + Tailwind (the judge-facing UI)
│   ├── browser-extension  # Chrome Manifest V3, TypeScript (same pipeline on real pages)
│   └── api                # FastAPI + SQLAlchemy backend
├── packages               # Shared, framework-agnostic pipeline (runs ON DEVICE)
│   ├── shared             # Domain types + demo scenarios
│   ├── privacy-engine     # PII/OTP/card/Aadhaar/PAN/credential detection + redaction
│   ├── context-compiler   # Intent classification + task-aware minimal context
│   └── action-policy      # Local ALLOW / CONFIRM / BLOCK security boundary
└── docs                   # Architecture, API reference, demo script, limitations
```

The **`packages/`** are the technical differentiator: the exact same TypeScript code runs in the
dashboard AND the browser extension, guaranteeing the privacy boundary is enforced on-device.

---

## 2. Prerequisites

- **Node.js ≥ 20** and npm
- **Python ≥ 3.11**

> **Database note:** the default dev database is **SQLite** (zero setup — runs instantly).
> The ORM is written to be **PostgreSQL-compatible**; switch by setting `DATABASE_URL`
> (see `apps/api/.env.example`). This sandbox has no PostgreSQL available, which is why SQLite is
> the default; nothing in the code assumes SQLite.

---

## 3. Install

```bash
# JS workspaces (dashboard, extension, shared packages)
npm install

# Python backend
cd apps/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

---

## 4. Run the database + load demo data

The tables are created automatically on API startup. Seed synthetic demo data:

```bash
cd apps/api
source .venv/bin/activate
python -m app.db.seed
```

Seeds **5 users, 10 sessions, 20 tasks, 50 audit events, 30 sensitive entities,
20 policy decisions, 10 benchmark runs** — all clearly synthetic.

Demo logins:

| Role  | Email             | Password   |
|-------|-------------------|------------|
| Admin | `admin@pvcc.demo` | `admin123` |
| Demo  | `demo@pvcc.demo`  | `demo123`  |

---

## 5. Run the backend

```bash
cd apps/api
source .venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- Health: `http://localhost:8000/health`
- Interactive API docs (Swagger): `http://localhost:8000/docs`

---

## 6. Run the frontend

```bash
npm run dev          # from repo root → http://localhost:5173
```

The Vite dev server proxies `/api/*` to the FastAPI backend, so the browser only ever calls
relative URLs (works behind any preview proxy).

---

## 7. Build & load the browser extension

```bash
npm run build:ext    # outputs apps/browser-extension/dist
```

In Chrome:
1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `apps/browser-extension/dist`
4. Pin **PVCC Agent**, open any webpage, click the icon, enter a task, run.

The extension perceives the live DOM, redacts locally, sends only sanitized context to
`/agent/reason`, and enforces the local policy before executing.

---

## 8. Exact demo steps (~3 minutes)

See **[`docs/DEMO.md`](docs/DEMO.md)** for the full script. Short version:

1. Open **Demo Workspace**.
2. Pick **E-commerce — Order tracking**, task *“Find my order status”* → **Run pipeline**.
3. Watch: local perception → PII detected & redacted (email, phone, address) → minimal context
   compiled → sanitized payload shown → remote AI proposes `CLICK "Order details"` → **local policy
   ALLOW** → action executed. Note the payload is ~98% smaller with **0 raw values sent**.
4. **Second wow moment:** pick **Bank — OTP / payment (danger)**, task *“Read the OTP and
   continue”* → **Run pipeline**. The remote AI **proposes** `REVEAL_CREDENTIAL`, but the
   **local policy engine BLOCKS it** before execution — the boundary is enforced on-device, not
   trusted to the server.
5. Show **Privacy Inspector**, **Context Compiler**, **Evaluation**, and **Audit Log**.

---

## 9. API documentation

Full reference in **[`docs/API.md`](docs/API.md)**; live Swagger at `/docs`. Key routes:

```
POST /auth/register           POST /privacy/analyze        POST /context/compile
POST /auth/login              POST /privacy/sanitize        POST /agent/reason
GET  /auth/me                                               POST /agent/action/validate
GET  /tasks   POST /tasks     GET /tasks/:id   POST /tasks/:id/run   GET /tasks/:id/events
GET  /benchmarks              GET /audit-events             GET /dashboard/stats
```

---

## 10. Architecture explanation

See **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**. Highlights:

- **On-device pipeline** (`packages/*`) is pure TypeScript, dependency-free, and shared between the
  dashboard and the extension → the same code enforces privacy everywhere.
- **Pluggable model seams**: `Detector` (privacy-engine), `classifyIntent` (context-compiler),
  `AIProvider` (`MockProvider` / `RealProvider`), and OCR/Vision/DOMAnalyzer interfaces. Swap in real
  ML/NER/OCR/VLM models without touching the pipeline.
- **Server never receives raw PII.** The client asserts this before every transmission
  (`assertNoRawPII`), and the API deliberately does **not** persist raw sensitive values.

---

## 11. Known limitations

See **[`docs/LIMITATIONS.md`](docs/LIMITATIONS.md)**. In brief:

- Detection is **rule/regex-based** (lightweight, on-device) — not a production ML model. Name and
  address detection are conservative heuristics.
- The reasoning layer is a **deterministic MockProvider**, not a real LLM/VLM.
- OCR/Vision are **interface stubs** with a DOM-text fallback; no real screenshot OCR runs yet.
- Benchmark numbers are **synthetic demo data**, clearly labeled — they illustrate methodology, not
  validated results.
- Auth uses stateless JWT; logout is client-side token disposal.

---

## 12. Next steps — replacing the mock AI / OCR / vision

1. **Reasoning:** implement `apps/api/app/ai/real_provider.py::reason()` against an on-prem VLM or
   hosted API; set `AI_PROVIDER=real`.
2. **PII/NER:** register an ML `Detector` in `packages/privacy-engine` (e.g. a WASM/ONNX NER model)
   alongside the regex detectors.
3. **OCR/Vision:** implement `OCRProvider` / `VisionProvider` (see `docs/ARCHITECTURE.md`) with an
   on-device model (Tesseract WASM, a small ONNX detector) to perceive canvas/image regions.
4. **DB:** point `DATABASE_URL` at PostgreSQL and adopt Alembic migrations (documented).

---

*All personal data in this repository is synthetic and fabricated for demonstration. No real
identities, cards, OTPs, or documents are used.*
