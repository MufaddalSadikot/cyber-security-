"""Authentication routes: register, login, me, logout."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import AuditEvent, User
from app.db.session import get_db
from app.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email,
        name=body.name,
        role=body.role,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    db.add(AuditEvent(user_id=user.id, category="SYSTEM", code="USER_REGISTER",
                      message=f"User registered: {body.email}", ok=True))
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    db.add(AuditEvent(user_id=user.id, category="SYSTEM", code="USER_LOGIN",
                      message=f"User login: {user.email}", ok=True))
    db.commit()
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/logout")
def logout(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    # Stateless JWT: logout is client-side token disposal. We log the event.
    db.add(AuditEvent(user_id=user.id, category="SYSTEM", code="USER_LOGOUT",
                      message=f"User logout: {user.email}", ok=True))
    db.commit()
    return {"ok": True}
