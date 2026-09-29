# API Reference

Base URL (dev): `http://localhost:8000` · via dashboard proxy: `/api`
Interactive docs: `GET /docs` (Swagger) · `GET /redoc`

All non-auth routes require `Authorization: Bearer <token>`.

## Auth

### `POST /auth/register`
```json
{ "email": "you@demo", "name": "You", "password": "secret6", "role": "demo" }
```
→ `201 { access_token, token_type, user }`

### `POST /auth/login`
```json
{ "email": "demo@pvcc.demo", "password": "demo123" }
```
→ `200 { access_token, token_type, user }`

### `GET /auth/me` → current `user`
### `POST /auth/logout` → `{ ok: true }` (client disposes token)

## Privacy engine

### `POST /privacy/analyze`  (also `/privacy/sanitize`)
```json
{ "text": "Email: a@b.com  OTP: 482913", "elements": [] }
```
→
```json
{
  "entities": [ { "type": "EMAIL", "placeholder": "[REDACTED:EMAIL]", "confidence": 0.99,
                  "sensitivity": "MEDIUM", "action": "REDACT", "reason": "...", "detector": "regex.email" } ],
  "sanitized_text": "Email: [REDACTED:EMAIL]  OTP: [removed]",
  "counts": { "EMAIL": 1, "OTP": 1 }
}
```

## Context compiler

### `POST /context/compile`
```json
{ "task": "Find my order status", "scenario_id": "ecommerce_order",
  "perception": { "pageType": "...", "rawText": "...", "elements": [ ... ] },
  "entities": [ ... ] }
```
→ `{ "compiled": { intent, pageType, visibleElements, fields, actionableTargets }, "stats": { rawChars, compiledChars, reductionPct, ... } }`

## Agent

### `POST /agent/reason`  — remote reasoning (sanitized context only)
```json
{ "task": "Find my order status", "scenario_id": "ecommerce_order",
  "compiled_context": { "intent": "track_order", "actionableTargets": [...] } }
```
→ `{ "action": { "type": "CLICK", "target_label": "Order details", "rationale": "..." },
     "provider": "mock", "result_summary": "..." }`

### `POST /agent/action/validate`  — local policy mirror
```json
{ "action": { "type": "REVEAL_CREDENTIAL" },
  "entities": [ { "type": "OTP", "sensitivity": "CRITICAL", "value": "482913" } ],
  "elements": [] }
```
→ `{ "decision": "BLOCK", "rule": "block.reveal_credential", "reason": "..." }`

## Tasks

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/tasks` | list (own tasks; admin sees all) |
| `POST` | `/tasks` | create `{ scenario_id, instruction }` |
| `GET`  | `/tasks/{id}` | fetch one |
| `POST` | `/tasks/{id}/run` | persist a completed pipeline run (sanitized data only) |
| `GET`  | `/tasks/{id}/events` | audit events for a task |

## Reporting

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/benchmarks` | all benchmark runs (synthetic, labeled) |
| `GET` | `/audit-events?category=PRIVACY\|AI\|ACTION\|ERROR\|ALL&limit=` | filterable audit log |
| `GET` | `/policy/catalogue` | the full ALLOW/CONFIRM/BLOCK rule catalogue |
| `GET` | `/dashboard/stats` | aggregate dashboard metrics |

## System
| `GET` | `/health` | liveness + configured AI provider |
