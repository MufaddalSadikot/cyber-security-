"""Seed the database with realistic SYNTHETIC demo data.

Run with:  python -m app.db.seed

Creates: 5 users, 10 browser sessions, 20 tasks, 50 audit events,
30 sensitive entities, 20 policy decisions, 10 benchmark runs.

ALL DATA IS SYNTHETIC / DEMO. No real personal data.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from app.core.security import hash_password
from app.db.models import (
    AgentActionRow,
    AgentTask,
    AuditEvent,
    BenchmarkRun,
    BrowserSession,
    CompiledContextRow,
    PolicyDecisionRow,
    SanitizationEvent,
    SensitiveEntityRow,
    User,
    WebPageContext,
)
from app.db.session import Base, SessionLocal, engine

random.seed(42)

SCENARIOS = ["ecommerce_order", "public_form", "sensitive_profile", "bank_otp", "public_safe"]
TASKS = [
    "Find my order status", "Open order details", "Fill this public registration form",
    "Open the settings page", "Navigate to the profile section", "Find the cheapest flight option",
    "Complete the payment", "Read the OTP and continue", "Track the shipment", "Go to the next step",
]
ENTITY_TYPES = [
    ("EMAIL", "MEDIUM", "REDACT"), ("PHONE", "MEDIUM", "REDACT"), ("OTP", "CRITICAL", "DROP"),
    ("CREDIT_CARD", "CRITICAL", "MASK"), ("AADHAAR", "HIGH", "MASK"), ("PAN", "HIGH", "MASK"),
    ("PASSWORD", "CRITICAL", "DROP"), ("ADDRESS", "MEDIUM", "REDACT"),
]


def _now(days_ago=0, mins=0):
    return datetime.now(timezone.utc) - timedelta(days=days_ago, minutes=mins)


def seed() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # --- Users (5) ---
    users = [
        User(email="admin@pvcc.demo", name="Admin (ISRO Demo)", role="admin",
             password_hash=hash_password("admin123")),
        User(email="demo@pvcc.demo", name="Demo User", role="demo",
             password_hash=hash_password("demo123")),
        User(email="judge@pvcc.demo", name="Evaluator", role="demo",
             password_hash=hash_password("judge123")),
        User(email="analyst@pvcc.demo", name="Privacy Analyst", role="demo",
             password_hash=hash_password("analyst123")),
        User(email="ops@pvcc.demo", name="Operations", role="admin",
             password_hash=hash_password("ops12345")),
    ]
    db.add_all(users)
    db.flush()

    # --- Browser sessions (10) ---
    devices = ["desktop", "laptop", "tablet", "mobile"]
    sessions = []
    for i in range(10):
        u = random.choice(users)
        s = BrowserSession(user_id=u.id, device=random.choice(devices),
                           user_agent="Chrome/120 (Extension)", started_at=_now(days_ago=random.randint(0, 6)),
                           active=random.random() > 0.5)
        sessions.append(s)
    db.add_all(sessions)
    db.flush()

    # --- Tasks (20) with related rows ---
    audit_count = 0
    entity_count = 0
    policy_count = 0
    for i in range(20):
        u = random.choice(users)
        scenario = random.choice(SCENARIOS)
        instr = random.choice(TASKS)
        is_bank = scenario == "bank_otp"
        blocked = is_bank and random.random() > 0.4
        task = AgentTask(
            user_id=u.id, session_id=random.choice(sessions).id, scenario_id=scenario,
            instruction=instr, stage="BLOCKED" if blocked else "COMPLETED",
            status="blocked" if blocked else "completed",
            total_ms=random.randint(180, 640), created_at=_now(days_ago=random.randint(0, 6), mins=random.randint(0, 600)),
        )
        db.add(task)
        db.flush()

        pc = WebPageContext(
            task_id=task.id, url=f"https://demo.example/{scenario}", title=scenario.replace("_", " ").title(),
            page_type=scenario, element_count=random.randint(6, 12),
            raw_char_count=random.randint(400, 1200), elements=[],
        )
        db.add(pc)
        db.flush()

        n_ent = random.randint(1, 4)
        for _ in range(n_ent):
            if entity_count >= 30:
                break
            et, sens, act = random.choice(ENTITY_TYPES)
            db.add(SensitiveEntityRow(
                page_context_id=pc.id, type=et, placeholder=f"[REDACTED:{et}]",
                confidence=round(random.uniform(0.72, 0.99), 3), sensitivity=sens, action=act,
                reason=f"{et} detected locally", detector="regex.demo",
            ))
            entity_count += 1

        critical = 1 if blocked else 0
        db.add(SanitizationEvent(task_id=task.id, entities_detected=n_ent,
                                 entities_redacted=n_ent, critical_blocked=critical))

        reduction = round(random.uniform(55, 88), 1)
        db.add(CompiledContextRow(task_id=task.id, intent="track_order",
                                  payload={"intent": "demo", "visibleElements": []},
                                  raw_chars=pc.raw_char_count,
                                  compiled_chars=int(pc.raw_char_count * (1 - reduction / 100)),
                                  reduction_pct=reduction))

        if blocked:
            atype, dec, rule, reason = ("REVEAL_CREDENTIAL", "BLOCK", "block.reveal_credential",
                                        "Revealing OTP/password/payment credentials is prohibited by local policy.")
        else:
            atype, dec, rule, reason = ("CLICK", "ALLOW", "allow.navigation", "Public navigation / scroll is permitted.")
        db.add(AgentActionRow(task_id=task.id, type=atype, target_label="demo target",
                              rationale="demo", executed=not blocked))
        db.add(PolicyDecisionRow(task_id=task.id, decision=dec, rule=rule, reason=reason))
        policy_count += 1

        # audit events per task
        specs = [
            ("PRIVACY", "LOCAL_PERCEPTION", "Perceived elements", True),
            ("PRIVACY", "PII_DETECTION", f"{n_ent} sensitive entities detected", True),
            ("AI", "SERVER_REQUEST", "Sanitized context transmitted", True),
            ("ACTION", "ACTION_POLICY", f"{dec}: {atype}", not blocked),
        ]
        for cat, code, msg, ok in specs:
            if audit_count >= 50:
                break
            db.add(AuditEvent(task_id=task.id, user_id=u.id, ts=task.created_at,
                              category=cat, code=code, message=msg, ok=ok))
            audit_count += 1

    # top up audit + policy to required minimums
    while policy_count < 20:
        t = random.choice(db.query(AgentTask).all())
        db.add(PolicyDecisionRow(task_id=t.id, decision="CONFIRM", rule="confirm.submit",
                                 reason="Submitting a form requires explicit human confirmation."))
        policy_count += 1
    while audit_count < 50:
        db.add(AuditEvent(category="SYSTEM", code="HEARTBEAT", message="System healthy", ok=True, ts=_now()))
        audit_count += 1

    # --- Benchmark runs (10): 5 baseline + 5 ours ---
    for scenario in SCENARIOS:
        db.add(BenchmarkRun(
            label=f"Baseline — raw screenshot → cloud AI ({scenario})", system="baseline",
            scenario_id=scenario,
            visual_context_accuracy=round(random.uniform(78, 88), 1),
            pii_precision=round(random.uniform(20, 40), 1),
            pii_recall=round(random.uniform(15, 35), 1),
            redaction_precision=round(random.uniform(0, 10), 1),
            client_cpu_pct=round(random.uniform(2, 6), 1),
            client_mem_mb=round(random.uniform(40, 70), 1),
            e2e_latency_ms=round(random.uniform(900, 1600), 0),
            payload_bytes=random.randint(180_000, 420_000),
            privacy_exposure=round(random.uniform(80, 98), 1),
            sensitive_leaks=random.randint(3, 7),
            task_success=round(random.uniform(82, 92), 1), is_demo=True,
        ))
        db.add(BenchmarkRun(
            label=f"Ours — local perception → sanitized context ({scenario})", system="ours",
            scenario_id=scenario,
            visual_context_accuracy=round(random.uniform(84, 93), 1),
            pii_precision=round(random.uniform(92, 99), 1),
            pii_recall=round(random.uniform(88, 97), 1),
            redaction_precision=round(random.uniform(93, 99), 1),
            client_cpu_pct=round(random.uniform(6, 13), 1),
            client_mem_mb=round(random.uniform(70, 120), 1),
            e2e_latency_ms=round(random.uniform(280, 620), 0),
            payload_bytes=random.randint(1_200, 6_000),
            privacy_exposure=round(random.uniform(2, 12), 1),
            sensitive_leaks=0,
            task_success=round(random.uniform(85, 94), 1), is_demo=True,
        ))

    db.commit()
    print(f"Seeded: users={len(users)} sessions={len(sessions)} tasks=20 "
          f"entities={entity_count} audit={audit_count} policy={policy_count} benchmarks=10")
    print("Login: admin@pvcc.demo / admin123   |   demo@pvcc.demo / demo123")
    db.close()


if __name__ == "__main__":
    seed()
