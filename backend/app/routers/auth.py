import re
from typing import Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth_utils import create_session, hash_password, verify_password
from app.database import get_db
from app.deps.auth import require_user
from app.limiter import limiter
from app.models import AuthSession, User
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    has_users = db.scalar(select(User.id).limit(1)) is not None
    return {"has_users": has_users}


@router.post("/register", response_model=AuthResponse, status_code=201)
@limiter.limit("3/minute")
def register(request: Request, data: RegisterRequest = Body(), db: Session = Depends(get_db)):
    username = data.username.strip().lower()
    if len(username) < 2:
        raise HTTPException(400, "Username must be at least 2 characters")
    if not re.fullmatch(r'[a-z0-9_.-]+', username):
        raise HTTPException(400, "Username may only contain letters, numbers, underscores, hyphens, and dots")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    if db.scalar(select(User.id).where(User.username == username)):
        raise HTTPException(409, "Username already taken")

    user = User(
        username=username,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    session = create_session(db, user)
    return AuthResponse(token=session.token, user=UserRead.model_validate(user))


@router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest = Body(), db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username.strip().lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    session = create_session(db, user)
    return AuthResponse(token=session.token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(require_user)):
    return UserRead.model_validate(user)


@router.delete("/logout", status_code=204)
def logout(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    _user: User = Depends(require_user),
):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        db.execute(delete(AuthSession).where(AuthSession.token == token))
        db.commit()


@router.delete("/account", status_code=204)
def delete_account(db: Session = Depends(get_db), user: User = Depends(require_user)):
    db.delete(user)
    db.commit()
