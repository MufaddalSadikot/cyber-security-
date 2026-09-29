# 3-Minute Judge Demo Script

> Goal: show the privacy boundary is real and enforced **on-device**, end to end.

## Setup (before judges arrive)
1. Backend running (`uvicorn app.main:app --port 8000`), seeded (`python -m app.db.seed`).
2. Frontend running (`npm run dev`) → open `http://localhost:5173`.
3. Log in as `demo@pvcc.demo` / `demo123`.

## Act 1 — The pipeline (≈90s) · "the happy path"
1. Go to **Demo Workspace**.
2. Scenario: **E-commerce — Order tracking**. Task: **“Find my order status”**. Click **Run pipeline**.
3. Narrate the live stages on the right + the animated pipeline:
   - **LOCAL PERCEPTION** — DOM + text read on device.
   - **PII DETECTION** — email, phone, address (and name) detected locally; the left browser panel
     shows **red redaction boxes** appear in place.
   - **CONTEXT COMPILATION** — “reduced ~XX%”.
   - **SERVER REQUEST** — expand **“Context sent to server”**: point out it contains only
     `order_reference: "REDACTED"`, `status`, `delivery_estimate` — **no raw email/phone/address**.
   - **REMOTE AI** proposes `CLICK "Order details"`.
   - **LOCAL POLICY** → **ALLOW** → the button highlights and “action executed”.
4. Point to the **byte comparison**: naive baseline ~240 KB vs PVCC ~1–2 KB, **0 raw values sent**.

## Act 2 — The security boundary (≈60s) · "the wow moment"
1. Scenario: **Bank — OTP / payment (danger)**. Task: **“Read the OTP and continue”**. Run.
2. Narrate: the page contains an **OTP (482913)**, a **card number**, and a **password field** — all
   flagged **CRITICAL** and dropped/masked locally.
3. The **remote AI proposes `REVEAL_CREDENTIAL`** …
4. … but the **LOCAL POLICY ENGINE returns BLOCK** — the browser panel shows a full-screen
   **⛔ ACTION BLOCKED LOCALLY** overlay. The action is **never executed**.
5. Key line: *“The remote model asked to expose the OTP. The decision to refuse was made on the
   device — we never trust the server with that boundary.”*

## Act 3 — Depth for scoring (≈30s)
- **Privacy Inspector** — three panels (Raw / Sanitized / Transmitted) + a live detection table with
  type, confidence, location, action, reason. Edit the raw text to show detection updating live.
- **Context Compiler** — Raw→Compiled JSON and the *removed / retained / sanitized* buckets.
- **Action Policy** — the simulator; flip the action to `SUBMIT` (CONFIRM) vs `REVEAL_CREDENTIAL` (BLOCK).
- **Evaluation** — charts mapped to the 5 official criteria (clearly labeled synthetic).
- **Audit Log** — filter by PRIVACY / AI / ACTION; every run left a structured trail.

## Optional — Extension
`npm run build:ext`, load unpacked, open any page, run a task in the popup: the **same packages**
redact the live DOM and enforce policy on a real webpage.
