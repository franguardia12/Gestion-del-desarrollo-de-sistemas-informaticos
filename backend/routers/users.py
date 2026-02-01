from __future__ import annotations

from pathlib import Path
from typing import Iterator, Optional
from urllib.parse import urlencode, urljoin

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import get_current_user
from constants import DEFAULT_AVATAR_URL
from database import get_session
from models import User
from services.avatar_storage import delete_avatar, open_avatar, save_avatar
from services.user_profile import UserProfile, build_user_profile
from services.place_service import get_owner_places
from services.place_schemas import PlaceSummarySchema
from services.challenge_service import check_and_update_user_challenges
from typing import List

router = APIRouter(prefix="/api/users", tags=["users"])

ALLOWED_AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def _normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned if cleaned else None


def _validate_avatar_extension(upload: UploadFile) -> None:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_AVATAR_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_AVATAR_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de imagen no soportado. Extensiones permitidas: {allowed}",
        )


def _delete_previous_avatar(file_id: Optional[str]) -> None:
    delete_avatar(file_id)


def _store_avatar(upload: UploadFile, user: User) -> str:
    _validate_avatar_extension(upload)
    filename = upload.filename or f"user_{user.id}_avatar"
    return save_avatar(upload.file, filename, upload.content_type)


def _build_avatar_url(request: Request, username: str, file_id: str) -> str:
    relative_path = f"api/users/{username}/avatar"
    query = urlencode({"v": file_id})
    return urljoin(str(request.base_url), f"{relative_path}?{query}")


def _stream_file(grid_out) -> Iterator[bytes]:
    try:
        chunk_size = 1024 * 256
        while True:
            chunk = grid_out.read(chunk_size)
            if not chunk:
                break
            yield chunk
    finally:
        grid_out.close()


@router.patch("/me", response_model=UserProfile)
async def update_profile(
    request: Request,
    full_name: Optional[str] = Form(None),
    bio: Optional[str] = Form(None),
    is_owner: Optional[bool] = Form(None),
    avatar: UploadFile | None = File(None),
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> UserProfile:
    db_user = db.get(User, current_user.id)
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    updates_applied = False

    if full_name is not None:
        db_user.full_name = _normalize_text(full_name)
        updates_applied = True

    if bio is not None:
        db_user.bio = _normalize_text(bio)
        updates_applied = True

    if is_owner is not None:
        db_user.is_owner = is_owner
        updates_applied = True

    if avatar is not None:
        _delete_previous_avatar(db_user.photo_file_id)
        new_file_id = _store_avatar(avatar, db_user)
        db_user.photo_file_id = new_file_id
        db_user.photo_url = _build_avatar_url(request, db_user.username, new_file_id)
        updates_applied = True

    if not updates_applied:
        return build_user_profile(db_user, db)

    if not db_user.photo_file_id and not db_user.photo_url:
        db_user.photo_url = DEFAULT_AVATAR_URL

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Update challenge 8 (complete_profile) for the user
    check_and_update_user_challenges(current_user.id, db)

    return build_user_profile(db_user, db)


@router.get("/{username}/avatar")
def get_user_avatar(username: str, db: Session = Depends(get_session)):
    stmt = select(User).where(User.username == username)
    user = db.scalar(stmt)
    if not user or not user.photo_file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar no encontrado")

    avatar_stream = open_avatar(user.photo_file_id)
    if avatar_stream is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Avatar no encontrado")

    metadata = avatar_stream.metadata or {}
    content_type = metadata.get("contentType", "application/octet-stream")
    headers = {
        "Cache-Control": "public, max-age=86400",
        "ETag": user.photo_file_id,
    }

    return StreamingResponse(
        _stream_file(avatar_stream),
        media_type=content_type,
        headers=headers,
    )

@router.get("/{user_id}/places", response_model=List[PlaceSummarySchema])
async def fetch_published_places(
    user_id: int,
    db: Session = Depends(get_session),
):
    places = get_owner_places(db, user_id)
    
    return places
