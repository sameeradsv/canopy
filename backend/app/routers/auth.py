from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_utils import create_session, hash_password, get_user_for_token, verify_password
from app.database import get_db
from app.models import User
from app.schemas import AuthResponse, LoginRequest, RegisterRequest, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def optional_user(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> User | None:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    return get_user_for_token(db, token)


def require_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(401, "Authentication required")
    return user


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    has_users = db.scalar(select(User.id).limit(1)) is not None
    return {"has_users": has_users, "sync_ready": has_users}


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.username == data.username.strip().lower()))
    if existing:
        raise HTTPException(409, "Username already taken")
    if len(data.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    user = User(
        username=data.username.strip().lower(),
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    session = create_session(db, user)
    return AuthResponse(
        token=session.token,
        user=UserRead(id=user.id, username=user.username, created_at=user.created_at),
    )


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username.strip().lower()))
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    session = create_session(db, user)
    return AuthResponse(
        token=session.token,
        user=UserRead(id=user.id, username=user.username, created_at=user.created_at),
    )


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(require_user)):
    return UserRead(id=user.id, username=user.username, created_at=user.created_at)
