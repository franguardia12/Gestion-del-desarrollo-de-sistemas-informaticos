"""Authentication routes for signup, login, and logout."""

from __future__ import annotations

from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import authenticate_user, create_access_token, hash_password
from database import get_session
from models import User
from settings import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _cookie_policy() -> dict[str, object]:
    """Return cookie flags depending on whether frontend runs over HTTPS."""
    is_secure = settings.frontend_origin.startswith("https://")
    samesite = "none" if is_secure else "lax"
    return {"secure": is_secure, "samesite": samesite}


class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    is_owner: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

#
class AuthUser(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    is_owner: bool # ¡CRUCIAL para saber si puedes editar!

    class Config:
        from_attributes = True
#

class AuthResponse(BaseModel):
    message: str
    user: AuthUser



@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(request: SignupRequest, db: Session = Depends(get_session)):
    """Create a new user account."""
    # Check if username already exists
    stmt = select(User).where(User.username == request.username)
    existing_user = db.scalar(stmt)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    # Check if email already exists
    stmt = select(User).where(User.email == request.email)
    existing_email = db.scalar(stmt)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create new user
    new_user = User(
        username=request.username,
        email=request.email,
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        is_owner=request.is_owner,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {
        "message": "User created successfully",
        "user": {
            "id": new_user.id,
            "username": new_user.username,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "is_owner": new_user.is_owner,
        },
    }


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, response: Response, db: Session = Depends(get_session)):
    """Authenticate user and create access token."""
    user = authenticate_user(db, request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Create access token
    access_token = create_access_token(
        email=user.email,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )

    # Set cookie
    cookie_policy = _cookie_policy()
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        samesite=cookie_policy["samesite"],
        secure=cookie_policy["secure"],
        path="/",
    )

    return {
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_owner": user.is_owner,
        },
    }


@router.post("/logout")
def logout(response: Response):
    """Clear the authentication cookie."""
    cookie_policy = _cookie_policy()
    response.delete_cookie(
        key="access_token",
        samesite=cookie_policy["samesite"],
        secure=cookie_policy["secure"],
        path="/",
    )
    return {"message": "Logout successful"}


@router.get("/me")
def get_me(request: Request, db: Session = Depends(get_session)):
    """Obtiene la información del usuario autenticado desde la cookie."""
    from auth import decode_access_token

    access_token = request.cookies.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )


    email = decode_access_token(access_token)
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    stmt = select(User).where(User.email == email)
    user = db.scalar(stmt)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # 🔹 Devolver solo los datos necesarios en formato dict
    return {
        "message": "User fetched successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_owner": user.is_owner,
        },
    }
