from fastapi import APIRouter, Depends, status, HTTPException, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from auth import get_current_user
from database import get_session
from models import Reward, UserReward, User, Challenge, UserChallenge, Place, Review
from services.challenge_service import check_and_update_user_challenges
from services.email_service import get_email_service

router = APIRouter(prefix="/api/rewards", tags=["Rewards"])

class RewardResponse(BaseModel):
    id: int
    title: str
    description: str
    image_url: Optional[str] = None
    # Reward type classification
    reward_type: str = "discount"  # "discount", "user_badge", or "place_badge"
    badge_icon: Optional[str] = None  # For badge types: e.g., "popular", "new", "first_review"
    badge_display_name: Optional[str] = None  # For badge types: display text
    # Challenge progress fields
    challenge_title: str
    challenge_description: str
    challenge_target: int
    current_progress: int = 0
    progress_percentage: float = 0.0
    is_completed: bool = False  # Challenge completed
    # Reward claim fields
    is_claimable: bool = False  # Can claim reward (completed but not claimed)
    is_claimed: bool = False    # Reward has been claimed
    is_used: bool = False       # Reward has been used/redeemed

    class Config:
        from_attributes = True

@router.get("", response_model=List[RewardResponse])
def get_user_rewards(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Devuelve la lista de todas las recompensas disponibles con progreso real del usuario.
    """
    try:
        # Update all challenge progress for the current user
        check_and_update_user_challenges(current_user.id, db)

        # Query rewards with challenges, user challenge progress, and user rewards
        stmt = (
            select(Reward, Challenge, UserChallenge, UserReward)
            .join(Challenge, Reward.challenge_id == Challenge.id)
            .outerjoin(UserChallenge, (UserChallenge.challenge_id == Challenge.id) & (UserChallenge.user_id == current_user.id))
            .outerjoin(UserReward, (UserReward.reward_id == Reward.id) & (UserReward.user_id == current_user.id))
        )
        results = db.execute(stmt).all()

        response_list = []
        for reward, challenge, user_challenge, user_reward in results:
            # Get challenge progress from UserChallenge
            if user_challenge:
                current_progress = user_challenge.current_progress
                is_completed = user_challenge.is_completed
            else:
                # No progress yet (shouldn't happen after check_and_update_user_challenges)
                current_progress = 0
                is_completed = False

            # Get reward claim status from UserReward
            is_claimed = user_reward is not None
            is_used = user_reward.is_used if user_reward else False

            # Determine if reward is claimable (completed but not yet claimed)
            is_claimable = is_completed and not is_claimed

            # Calculate progress percentage
            progress_percentage = (current_progress / challenge.target_value * 100.0) if challenge.target_value > 0 else 0.0
            # Cap at 100%
            progress_percentage = min(progress_percentage, 100.0)

            response_list.append(
                RewardResponse(
                    id=reward.id,
                    title=reward.title,
                    description=reward.description,
                    image_url=reward.image_url,
                    reward_type=reward.reward_type,
                    badge_icon=reward.badge_icon,
                    badge_display_name=reward.badge_display_name,
                    challenge_title=challenge.title,
                    challenge_description=challenge.description,
                    challenge_target=challenge.target_value,
                    current_progress=current_progress,
                    progress_percentage=progress_percentage,
                    is_completed=is_completed,
                    is_claimable=is_claimable,
                    is_claimed=is_claimed,
                    is_used=is_used
                )
            )

        return response_list

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fallo en la consulta de recompensas. Causa: {str(e)}"
        )

class ClaimRewardRequest(BaseModel):
    place_id: Optional[int] = None  # Required for place_badge rewards


def send_reward_email_background(user_email: str, user_name: str, reward_title: str, reward_description: str):
    """Background task to send reward notification email."""
    try:
        email_service = get_email_service()
        email_service.send_reward_notification(
            user_email=user_email,
            user_name=user_name,
            reward_title=reward_title,
            reward_description=reward_description
        )
    except Exception as e:
        # No fallar si el email no se puede enviar
        import logging
        logging.warning(
            f"Failed to send reward notification email: {str(e)}"
        )


@router.post("/{reward_id}/claim", status_code=status.HTTP_200_OK)
def claim_reward(
    reward_id: int,
    request: ClaimRewardRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Permite a un usuario reclamar una recompensa.
    Solo se puede reclamar si el desafío está completado y no ha sido reclamado antes.
    Para recompensas de tipo place_badge, se requiere especificar el place_id.

    Special cases:
    - "Nuevo establecimiento" (reward_id=4): Auto-assigns to user's first published place
    - "Host Verificado" (reward_id=5): Auto-assigns to the place that reached 5 reviews
    """
    # Verify the reward exists and get its challenge
    reward = db.scalar(
        select(Reward)
        .where(Reward.id == reward_id)
    )
    if not reward or not reward.challenge_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recompensa no encontrada."
        )

    # Handle place_badge rewards with special logic
    place_id = request.place_id
    if reward.reward_type == "place_badge":
        # Special case: "Nuevo establecimiento" (first published place)
        if reward.id == 4:
            # Find the user's first published place (oldest by created_at)
            first_place = db.scalar(
                select(Place)
                .where(Place.owner_id == current_user.id)
                .order_by(Place.created_at.asc())
                .limit(1)
            )
            if not first_place:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No tienes establecimientos publicados."
                )
            place_id = first_place.id

        # Special case: "Host Verificado" (place that reached 5 reviews)
        elif reward.id == 5:
            # Find the place owned by user that has 5+ reviews
            place_with_5_reviews = db.execute(
                select(Place.id, func.count(Review.id).label('review_count'))
                .join(Review, Review.place_id == Place.id)
                .where(Place.owner_id == current_user.id)
                .group_by(Place.id)
                .having(func.count(Review.id) >= 5)
                .order_by(func.count(Review.id).desc())
                .limit(1)
            ).first()

            if not place_with_5_reviews:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Ninguno de tus establecimientos ha alcanzado 5 reseñas aún."
                )
            place_id = place_with_5_reviews[0]

        # For other place_badge rewards, require manual selection
        else:
            if not place_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Debes especificar un lugar (place_id) para este tipo de recompensa."
                )

            # Verify the place exists and belongs to the user
            place = db.scalar(
                select(Place)
                .where(Place.id == place_id, Place.owner_id == current_user.id)
            )
            if not place:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Lugar no encontrado o no te pertenece."
                )

    # Check if the challenge is completed
    user_challenge = db.scalar(
        select(UserChallenge)
        .where(
            UserChallenge.user_id == current_user.id,
            UserChallenge.challenge_id == reward.challenge_id
        )
    )

    if not user_challenge or not user_challenge.is_completed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No has completado el desafío para esta recompensa todavía."
        )

    # Check if already claimed
    existing_user_reward = db.scalar(
        select(UserReward)
        .where(
            UserReward.user_id == current_user.id,
            UserReward.reward_id == reward_id
        )
    )

    if existing_user_reward:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta recompensa ya fue reclamada."
        )

    # Create UserReward record (claiming the reward)
    user_reward = UserReward(
        user_id=current_user.id,
        reward_id=reward_id,
        place_id=place_id,  # Will be None for non-place_badge rewards
        is_used=False
    )
    db.add(user_reward)
    db.commit()

    # Enviar notificación por email al usuario en background
    # user_name = current_user.full_name or current_user.username
    # background_tasks.add_task(
    #     send_reward_email_background,
    #     user_email=current_user.email,
    #     user_name=user_name,
    #     reward_title=reward.title,
    #     reward_description=reward.description
    # )

    return {
        "message": "¡Recompensa reclamada con éxito!",
        "reward_title": reward.title
    }
