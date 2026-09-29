# Architecture — Privacy-Aware Visual Context Compiler

## The privacy boundary (the whole point)

```
┌──────────────────────────── ON DEVICE (browser / extension) ────────────────────────────┐
│                                                                                          │
│  RAW WEBPAGE                                                                              │
│      │  DOM + visible text (+ screenshot/OCR seam)                                        │
│      ▼                                                                                    │
│  LOCAL PERCEPTION            packages/…  (extension: src/perceive.ts, dashboard: pipeline)│
│      ▼                                                                                    │
│  LOCAL PRIVACY ENGINE        packages/privacy-engine   → detect + redact PII/OTP/cards…   │
│      ▼                                                                                    │
│  TASK-AWARE CONTEXT COMPILER packages/context-compiler → intent + relevance + minimize    │
│      ▼                                                                                    │
│  SANITIZED MINIMAL CONTEXT   assertNoRawPII() guards the outbound payload                 │
│      │                                                                                    │
└──────┼───────────────────────────────────────────────────────────────────────────────── ┘
       │  HTTPS — sanitized JSON only (no raw values, no screenshot)
       ▼
┌──────────────── SERVER ────────────────┐
│  REMOTE AI REASONING                    │  apps/api  POST /agent/reason
│  AIProvider → MockProvider|RealProvider │  returns a single structured action
└──────┬─────────────────────────────────┘
       │  proposed action
       ▼
┌──────────────────────────── ON DEVICE ────────────────────────────┐
│  LOCAL ACTION POLICY   packages/action-policy → ALLOW/CONFIRM/BLOCK │
│      ▼                                                              │
│  BROWSER EXECUTION     (only if ALLOW; dangerous actions BLOCKED)   │
└────────────────────────────────────────────────────────────────── ┘
```

**Key invariant:** the security decision is made **locally**. Even if the remote model proposes
`REVEAL_CREDENTIAL`, the on-device `ActionPolicyEngine` blocks it. Trust is not delegated to the server.

## Monorepo layout

| Path | Responsibility |
|------|----------------|
| `packages/shared` | Domain types (`SensitiveEntity`, `CompiledContext`, `AgentAction`, `PolicyDecision`, …) and demo scenarios. |
| `packages/privacy-engine` | `Detector` registry + `PrivacyEngine`. Regex/heuristic detectors with per-type sensitivity, redaction action, confidence and reason. Luhn validation for cards; context-gated OTP/DOB; conservative name/address heuristics. |
| `packages/context-compiler` | `classifyIntent()` + `ContextCompiler`. Scores elements by task relevance, redacts residual sensitive text, extracts structured fields, emits minimal JSON + reduction stats. |
| `packages/action-policy` | `ActionPolicyEngine`. Ordered rule set — hard blocks first (credential/OTP/password/payment), then confirmations (submit/purchase/settings/download), then allows (navigation/public fill/select). |
| `apps/web-dashboard` | React UI. `src/lib/pipeline.ts` orchestrates the on-device flow and calls the API only with sanitized context. |
| `apps/browser-extension` | MV3 extension. `perceive.ts` (DOM), `service-worker.ts` (runs the same packages), `content-script.ts` (overlay + execution), `popup.ts` (UI). |
| `apps/api` | FastAPI. Auth (JWT+bcrypt), typed schemas, SQLAlchemy models + seed, AI provider factory, server-side mirrors of privacy/compiler/policy for the extension & tests. |

## Pluggable model seams (mock → real)

| Seam | Interface | Mock (now) | Real (later) |
|------|-----------|------------|--------------|
| Reasoning | `AIProvider.reason()` | `MockProvider` (deterministic) | `RealProvider` → LLM/VLM |
| PII / NER | `Detector` (`packages/privacy-engine`) | regex/heuristic detectors | ONNX/WASM NER detector registered alongside |
| OCR | `OCRProvider` (see below) | DOM-text fallback | Tesseract WASM / small ONNX OCR |
| Vision | `VisionProvider` | none | on-device detector for canvas/image regions |
| DOM | `DOMAnalyzer` | `perceivePage()` | richer accessibility-tree analysis |

Interface contracts for OCR/Vision (to implement):

```ts
interface OCRProvider   { recognize(image: ImageData): Promise<{ text: string; box: BoundingBox }[]>; }
interface VisionProvider{ detect(image: ImageData): Promise<PerceivedElement[]>; }
interface DOMAnalyzer   { perceive(): PagePerception; }
```

## Data model (SQLAlchemy — Postgres-compatible)

`User`, `BrowserSession`, `AgentTask`, `WebPageContext`, `SensitiveEntity`, `SanitizationEvent`,
`CompiledContext`, `AgentAction`, `PolicyDecision`, `AuditEvent`, `BenchmarkRun`.

> `SensitiveEntity` stores only **type/placeholder/confidence/action/reason/detector** — never the
> raw value. `CompiledContext.payload` stores the exact sanitized payload that was transmitted.

## Security

- bcrypt password hashing, stateless JWT, role-based route guards (`admin` / `demo`).
- CORS middleware, in-memory token-bucket rate limiter (Redis-swap seam).
- Pydantic validation on every request; the `POST /tasks/:id/run` endpoint strips any `value` field
  from entities before persistence.
- Client-side `assertNoRawPII()` fails closed if a raw value would ever be transmitted.
