from __future__ import annotations

from typing import Optional, List, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pathlib import Path
from urllib.parse import urlencode, urljoin
from sqlalchemy import func, select, case
from sqlalchemy.orm import Session, joinedload

from auth import get_current_user
from constants import DEFAULT_AVATAR_URL
from database import get_session
from models import Place, Review as ReviewModel, ReviewVote, User
from services.review_photo_storage import delete_review_photo, open_review_photo, save_review_photo
from services.challenge_service import check_and_update_user_challenges, update_challenge_for_place_owner
from services.email_service import get_email_service
from constants import ALLOWED_PLACE_PHOTO_EXTENSIONS

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    place_id: int = Field(..., ge=1)
    rating: int = Field(..., ge=1, le=5)
    title: str = Field(..., min_length=1, max_length=255)
    comment: str = Field(..., min_length=1)


def _validate_review_photo_extension(upload: UploadFile) -> None:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_PLACE_PHOTO_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_PLACE_PHOTO_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de imagen no soportado. Extensiones permitidas: {allowed}",
        )


def _store_review_photo(upload: UploadFile, review_id: int) -> str:
    _validate_review_photo_extension(upload)
    filename = upload.filename or f"review_{review_id}_photo"
    return save_review_photo(upload.file, filename, upload.content_type)


def _build_review_photo_url(request: Request, review_id: int, photo_id: int, file_id: str) -> str:
    relative_path = f"api/reviews/{review_id}/photos/{photo_id}"
    query = urlencode({"v": file_id})
    return urljoin(str(request.base_url), f"{relative_path}?{query}")


class ReviewUpdate(BaseModel):
    place_id: int = Field(..., ge=1)
    rating: int = Field(..., ge=1, le=5)
    title: str = Field(..., min_length=1, max_length=255)
    comment: str = Field(..., min_length=1)


class ReviewResponse(BaseModel):
    id: int
    place_id: int
    author_id: int
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    photos: List[str] = Field(default_factory=list)
    author_name: str
    author_photo_url: str
    created_at: str
    place_name: str
    place_rating_avg: Optional[float] = None
    place_photo_url: Optional[str] = None
    helpful_votes: int = 0
    not_helpful_votes: int = 0
    user_vote: Optional[str] = None


def _normalize_text(value: str) -> str:
    return value.strip()


def _recalculate_place_rating(db: Session, place_id: int) -> None:
    place = db.get(Place, place_id)
    if not place:
        return
    avg_rating = db.scalar(
        select(func.avg(ReviewModel.rating)).where(ReviewModel.place_id == place_id)
    )
    place.rating_avg = float(avg_rating or 0)
    db.add(place)


def _build_review_response(
    review: ReviewModel,
    *,
    helpful_votes: int = 0,
    not_helpful_votes: int = 0,
    user_vote: Optional[str] = None,
) -> ReviewResponse:
    place = review.place
    author_photo = review.user.photo_url if review.user else DEFAULT_AVATAR_URL
    return ReviewResponse(
        id=review.id,
        place_id=review.place_id,
        author_id=review.user_id,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        photos=[p.url for p in review.photos],
        author_name=review.author_name,
        author_photo_url=author_photo,
        created_at=review.created_at.isoformat(),
        place_name=place.name if place else "",
        place_rating_avg=float(place.rating_avg) if place and place.rating_avg is not None else None,
        place_photo_url=place.photos[0].url if place and place.photos else None,
        helpful_votes=helpful_votes,
        not_helpful_votes=not_helpful_votes,
        user_vote=user_vote,
    )


def _get_vote_totals(db: Session, review_id: int) -> tuple[int, int]:
    totals_stmt = (
        select(
            func.sum(
                case((ReviewVote.is_helpful.is_(True), 1), else_=0)
            ).label("helpful_votes"),
            func.sum(
                case((ReviewVote.is_helpful.is_(False), 1), else_=0)
            ).label("not_helpful_votes"),
        )
        .where(ReviewVote.review_id == review_id)
    )
    totals = db.execute(totals_stmt).one()
    helpful = int(totals.helpful_votes or 0)
    not_helpful = int(totals.not_helpful_votes or 0)
    return helpful, not_helpful


def _send_review_notification_email(
    owner_email: str,
    owner_name: str,
    place_name: str,
    reviewer_name: str,
    rating: int,
    review_title: str,
) -> None:
    """Background task to send review notification email."""
    try:
        email_service = get_email_service()
        email_service.send_review_notification(
            owner_email=owner_email,
            owner_name=owner_name,
            place_name=place_name,
            reviewer_name=reviewer_name,
            rating=rating,
            review_title=review_title
        )
    except Exception as e:
        import logging
        logging.warning(
            f"Failed to send review notification email: {str(e)}"
        )


@router.post("", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    payload: ReviewCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ReviewResponse:
    place = db.get(Place, payload.place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lugar no encontrado")

    review = ReviewModel(
        place_id=payload.place_id,
        user_id=current_user.id,
        rating=payload.rating,
        title=_normalize_text(payload.title),
        comment=_normalize_text(payload.comment),
        author_name=current_user.full_name or current_user.username,
    )

    db.add(review)
    db.flush()

    _recalculate_place_rating(db, payload.place_id)

    db.commit()
    db.refresh(review)
    db.refresh(review, attribute_names=["place", "user"])

    # Update challenges for the reviewer (challenges 1, 3, 9, 10, 11)
    check_and_update_user_challenges(current_user.id, db)

    # Update challenges for the place owner (challenge 5)
    update_challenge_for_place_owner(payload.place_id, db)

    # Enviar notificación por email al propietario del lugar en segundo plano
    if place.owner and place.owner.email:
        owner_name = place.owner.full_name or place.owner.username
        reviewer_name = current_user.full_name or current_user.username
        # background_tasks.add_task(
        #     _send_review_notification_email,
        #     owner_email=place.owner.email,
        #     owner_name=owner_name,
        #     place_name=place.name,
        #     reviewer_name=reviewer_name,
        #     rating=payload.rating,
        #     review_title=review.title or "Sin título"
        # )

    return _build_review_response(review)


@router.put("/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int,
    payload: ReviewUpdate,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ReviewResponse:
    review = (
        db.execute(
            select(ReviewModel)
            .where(ReviewModel.id == review_id)
            .options(
                joinedload(ReviewModel.place).joinedload(Place.photos),
                joinedload(ReviewModel.user),
            )
        )
        .unique()
        .scalar_one_or_none()
    )
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")
    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes editar esta reseña",
        )

    new_place = db.get(Place, payload.place_id)
    if not new_place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lugar no encontrado")

    old_place_id = review.place_id if review.place_id != payload.place_id else None

    review.place_id = payload.place_id
    review.rating = payload.rating
    review.title = _normalize_text(payload.title)
    review.comment = _normalize_text(payload.comment)
    review.author_name = current_user.full_name or current_user.username

    db.add(review)
    db.flush()

    _recalculate_place_rating(db, payload.place_id)
    if old_place_id:
        _recalculate_place_rating(db, old_place_id)

    db.commit()
    db.refresh(review)
    db.refresh(review, attribute_names=["place", "user"])

    check_and_update_user_challenges(current_user.id, db)
    update_challenge_for_place_owner(payload.place_id, db)
    if old_place_id:
        update_challenge_for_place_owner(old_place_id, db)

    helpful_votes, not_helpful_votes = _get_vote_totals(db, review.id)
    return _build_review_response(
        review,
        helpful_votes=helpful_votes,
        not_helpful_votes=not_helpful_votes,
    )


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> Response:
    review = db.get(ReviewModel, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")
    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes eliminar esta reseña",
        )

    place_id = review.place_id
    owner_id = None
    if review.place:
        owner_id = review.place.owner_id

    db.delete(review)
    db.flush()
    _recalculate_place_rating(db, place_id)
    db.commit()
    check_and_update_user_challenges(current_user.id, db)
    if owner_id:
        check_and_update_user_challenges(owner_id, db)

    return Response(status_code=status.HTTP_204_NO_CONTENT)



@router.post("/{review_id}/photos", status_code=201)
def upload_review_photos(
    review_id: int,
    request: Request,
    photos: List[UploadFile] = File(...),
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    # Verify review exists and belongs to user
    review = db.get(ReviewModel, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")

    if review.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes subir fotos a esta reseña")

    try:
        photo_responses = []
        for upload in photos:
            file_id = _store_review_photo(upload, review_id)
            from models import ReviewPhoto

            rp = ReviewPhoto(review_id=review_id, url="")
            db.add(rp)
            db.flush()
            photo_url = _build_review_photo_url(request, review_id, rp.id, file_id)
            rp.url = photo_url
            rp.photo_file_id = file_id
            db.add(rp)
            photo_responses.append({"id": rp.id, "url": photo_url})

        db.commit()

        return {"message": f"{len(photos)} fotos subidas exitosamente", "photos": photo_responses}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al subir las fotos: {str(e)}")


@router.get("/{review_id}/photos/{photo_id}")
def get_review_photo(review_id: int, photo_id: int, db: Session = Depends(get_session)):
    review = db.get(ReviewModel, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")

    from models import ReviewPhoto

    photo = db.get(ReviewPhoto, photo_id)
    if not photo or photo.review_id != review_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    file_id = getattr(photo, "photo_file_id", None)
    if not file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no disponible")

    photo_stream = open_review_photo(file_id)
    if photo_stream is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    metadata = photo_stream.metadata or {}
    content_type = metadata.get("contentType", "application/octet-stream")
    headers = {"Cache-Control": "public, max-age=86400", "ETag": file_id}

    def _stream_file(grid_out):
        try:
            chunk_size = 1024 * 256
            while True:
                chunk = grid_out.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            grid_out.close()

    return StreamingResponse(_stream_file(photo_stream), media_type=content_type, headers=headers)


@router.delete("/{review_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review_photo_endpoint(
    review_id: int,
    photo_id: int,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    review = db.get(ReviewModel, review_id)
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")

    if review.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes eliminar fotos de esta reseña")

    from models import ReviewPhoto

    photo = db.get(ReviewPhoto, photo_id)
    if not photo or photo.review_id != review_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    try:
        file_id = getattr(photo, "photo_file_id", None)
        if file_id:
            delete_review_photo(file_id)

        db.delete(photo)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error al eliminar la foto: {str(e)}")


class ReviewVoteRequest(BaseModel):
    vote: Literal["helpful", "not_helpful", "clear"]


class ReviewVoteResponse(BaseModel):
    review_id: int
    helpful_votes: int
    not_helpful_votes: int
    user_vote: Optional[str] = None


@router.post("/{review_id}/vote", response_model=ReviewVoteResponse)
def vote_review(
    review_id: int,
    payload: ReviewVoteRequest,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ReviewVoteResponse:
    review = (
        db.execute(
            select(ReviewModel)
            .where(ReviewModel.id == review_id)
            .options(joinedload(ReviewModel.user))
        )
        .unique()
        .scalar_one_or_none()
    )
    if not review:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reseña no encontrada")
    if review.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No puedes votar tu propia reseña",
        )

    vote_stmt = select(ReviewVote).where(
        ReviewVote.review_id == review_id,
        ReviewVote.user_id == current_user.id,
    )
    existing_vote = db.execute(vote_stmt).scalar_one_or_none()

    if payload.vote == "clear":
        if existing_vote:
            db.delete(existing_vote)
    else:
        is_helpful = payload.vote == "helpful"
        if existing_vote:
            existing_vote.is_helpful = is_helpful
            db.add(existing_vote)
        else:
            vote = ReviewVote(
                review_id=review_id,
                user_id=current_user.id,
                is_helpful=is_helpful,
            )
            db.add(vote)

    db.flush()
    helpful_votes, not_helpful_votes = _get_vote_totals(db, review_id)
    db.commit()

    # Update challenges for the voter (votes emitidos) y para el autor (votos recibidos)
    check_and_update_user_challenges(current_user.id, db)
    if review.user_id:
        check_and_update_user_challenges(review.user_id, db)

    user_vote = None if payload.vote == "clear" else payload.vote

    return ReviewVoteResponse(
        review_id=review_id,
        helpful_votes=helpful_votes,
        not_helpful_votes=not_helpful_votes,
        user_vote=user_vote,
    )
