"""
Challenge Progress Tracking Service

This service handles the calculation and updating of user progress
for all challenges in the rewards system.
"""

from sqlalchemy.orm import Session
from sqlalchemy import select, func
from models import (
    User, UserChallenge, Challenge, Review, Place, ReviewVote, Reward
)
from typing import Dict
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


# ============================================================================
# Individual Challenge Progress Calculators
# ============================================================================

def calc_progress_first_review(user_id: int, db: Session) -> int:
    """
    Challenge ID 1: "Primera Reseña"
    Target: 1 review
    Returns: Count of reviews written by user
    """
    count = db.scalar(
        select(func.count(Review.id)).where(Review.user_id == user_id)
    ) or 0
    return count


def calc_progress_five_star_review(user_id: int, db: Session) -> int:
    """
    Challenge ID 3: "Coleccionista de Estrellas"
    Target: 1 (has at least one 5-star review)
    Returns: 1 if user has any 5-star review, 0 otherwise
    """
    has_five_star = db.scalar(
        select(func.count(Review.id))
        .where(Review.user_id == user_id)
        .where(Review.rating == 5)
    ) or 0
    return 1 if has_five_star > 0 else 0


def calc_progress_publish_first_place(user_id: int, db: Session) -> int:
    """
    Challenge ID 4: "Anfitrión Debutante"
    Target: 1 place
    Returns: Count of places owned by user
    """
    count = db.scalar(
        select(func.count(Place.id)).where(Place.owner_id == user_id)
    ) or 0
    return count


def calc_progress_get_5_reviews(user_id: int, db: Session) -> int:
    """
    Challenge ID 5: "Host Popular"
    Target: 5 reviews on user's places (total across all places)
    Returns: Count of all reviews on places owned by user
    """
    count = db.scalar(
        select(func.count(Review.id))
        .join(Place, Review.place_id == Place.id)
        .where(Place.owner_id == user_id)
    ) or 0
    return count


def calc_progress_complete_profile(user_id: int, db: Session) -> int:
    """
    Challenge ID 8: "Guía Local"
    Target: 1 (100% profile completion)
    Returns: 1 if profile is complete, 0 otherwise

    Profile is complete when all these fields are filled:
    - full_name (not None/empty)
    - bio (not None/empty)
    - is_owner (set to True or False, doesn't matter which)
    - photo_url (not default avatar)
    """
    from constants import DEFAULT_AVATAR_URL

    user = db.scalar(select(User).where(User.id == user_id))
    if not user:
        return 0

    # Check all required fields
    is_complete = all([
        user.full_name and len(user.full_name.strip()) > 0,
        user.bio and len(user.bio.strip()) > 0,
        user.photo_url != DEFAULT_AVATAR_URL
    ])

    return 1 if is_complete else 0


def calc_progress_10_reviews(user_id: int, db: Session) -> int:
    """
    Challenge ID 9: "Crítico Constante"
    Target: 10 reviews
    Returns: Count of reviews written by user
    """
    count = db.scalar(
        select(func.count(Review.id)).where(Review.user_id == user_id)
    ) or 0
    return count


def calc_progress_review_5_restaurants(user_id: int, db: Session) -> int:
    """
    Challenge ID 10: "Gourmet Viajero"
    Target: 5 distinct restaurants
    Returns: Count of distinct restaurants reviewed by user
    """
    count = db.scalar(
        select(func.count(func.distinct(Place.id)))
        .join(Review, Review.place_id == Place.id)
        .where(Review.user_id == user_id)
        .where(Place.category == 'restaurante')
    ) or 0
    return count


def calc_progress_review_3_hotels(user_id: int, db: Session) -> int:
    """
    Challenge ID 11: "Expert en Hoteles"
    Target: 3 distinct hotels
    Returns: Count of distinct hotels reviewed by user
    """
    count = db.scalar(
        select(func.count(func.distinct(Place.id)))
        .join(Review, Review.place_id == Place.id)
        .where(Review.user_id == user_id)
        .where(Place.category == 'hotel')
    ) or 0
    return count


def calc_progress_review_5_lodgings(user_id: int, db: Session) -> int:
    """
    Challenge ID 32: "Viajero Ahorrador"
    Target: 5 distinct lodgings (alojamientos)
    Returns: Count of distinct lodgings reviewed by user
    """
    count = db.scalar(
        select(func.count(func.distinct(Place.id)))
        .join(Review, Review.place_id == Place.id)
        .where(Review.user_id == user_id)
        .where(Place.category == "alojamiento")
    ) or 0
    return count


def calc_progress_visit_3_cities(user_id: int, db: Session) -> int:
    """
    Challenge ID 12: "Viajero Frecuente"
    Target: 3 review votes/interactions
    Returns: Count of review votes made by user
    """
    count = db.scalar(
        select(func.count(ReviewVote.id)).where(ReviewVote.user_id == user_id)
    ) or 0
    return count


def calc_progress_review_5_countries(user_id: int, db: Session) -> int:
    """
    Challenge ID 13: "Explorador Global"
    Target: Reseñar lugares en 5 países distintos
    Returns: Count of distinct countries the user has reviewed in
    """
    count = db.scalar(
        select(func.count(func.distinct(Place.country)))
        .join(Review, Review.place_id == Place.id)
        .where(Review.user_id == user_id)
        .where(Place.country.isnot(None))
    ) or 0
    return count


def calc_progress_review_argentina(user_id: int, db: Session) -> int:
    """
    Challenge ID 14: "Orgullo Local"
    Target: 3 reseñas en establecimientos de Argentina
    Returns: Count of reviews written on places in Argentina
    """
    count = db.scalar(
        select(func.count(Review.id))
        .join(Place, Review.place_id == Place.id)
        .where(Review.user_id == user_id)
        .where(func.lower(Place.country) == "argentina")
    ) or 0
    return count


def calc_progress_review_8_restaurants(user_id: int, db: Session) -> int:
    """
    Challenge ID 15: "Foodie Aventurero"
    Target: 8 reseñas de restaurantes (no necesariamente distintos)
    Returns: Count of restaurant reviews by user
    """
    count = db.scalar(
        select(func.count(Review.id))
        .join(Place, Review.place_id == Place.id)
        .where(Review.user_id == user_id)
        .where(Place.category == "restaurante")
    ) or 0
    return count


def calc_progress_review_5_hotels(user_id: int, db: Session) -> int:
    """
    Challenge ID 16: "Hotel Hunter"
    Target: 5 hoteles distintos reseñados
    Returns: Count of distinct hotels reviewed by user
    """
    count = db.scalar(
        select(func.count(func.distinct(Place.id)))
        .join(Review, Review.place_id == Place.id)
        .where(Review.user_id == user_id)
        .where(Place.category == "hotel")
    ) or 0
    return count


def calc_progress_helpful_votes(user_id: int, db: Session) -> int:
    """
    Challenge ID 17: "Crítico Apreciado"
    Target: 10 votos de 'útil' recibidos en tus reseñas
    Returns: Count of helpful votes across user's reviews
    """
    count = db.scalar(
        select(func.count(ReviewVote.id))
        .join(Review, ReviewVote.review_id == Review.id)
        .where(Review.user_id == user_id)
        .where(ReviewVote.is_helpful.is_(True))
    ) or 0
    return count


def calc_progress_vote_15_reviews(user_id: int, db: Session) -> int:
    """
    Challenge ID 18: "Comunidad Activa"
    Target: 15 votos emitidos en reseñas de otros usuarios
    Returns: Count of review votes made by the user
    """
    count = db.scalar(
        select(func.count(ReviewVote.id)).where(ReviewVote.user_id == user_id)
    ) or 0
    return count


def calc_progress_publish_3_places(user_id: int, db: Session) -> int:
    """
    Challenge ID 19: "Portafolio en Marcha"
    Target: 3 lugares publicados
    """
    count = db.scalar(select(func.count(Place.id)).where(Place.owner_id == user_id)) or 0
    return count


def calc_progress_publish_5_places(user_id: int, db: Session) -> int:
    """
    Challenge ID 20: "Portafolio Activo"
    Target: 5 lugares publicados
    """
    count = db.scalar(select(func.count(Place.id)).where(Place.owner_id == user_id)) or 0
    return count


def calc_progress_publish_10_places(user_id: int, db: Session) -> int:
    """
    Challenge ID 21: "Red de Anfitrión"
    Target: 10 lugares publicados
    """
    count = db.scalar(select(func.count(Place.id)).where(Place.owner_id == user_id)) or 0
    return count


def calc_progress_get_10_reviews(user_id: int, db: Session) -> int:
    """
    Challenge ID 22: "Host Súper Popular"
    Target: 10 reseñas en tus lugares
    """
    count = db.scalar(
        select(func.count(Review.id))
        .join(Place, Review.place_id == Place.id)
        .where(Place.owner_id == user_id)
    ) or 0
    return count


def calc_progress_get_20_reviews(user_id: int, db: Session) -> int:
    """
    Challenge ID 23: "Host Leyenda"
    Target: 20 reseñas en tus lugares
    """
    count = db.scalar(
        select(func.count(Review.id))
        .join(Place, Review.place_id == Place.id)
        .where(Place.owner_id == user_id)
    ) or 0
    return count


def calc_progress_20_reviews_written(user_id: int, db: Session) -> int:
    """
    Challenge ID 24: "Cronista"
    Target: 20 reseñas escritas
    """
    count = db.scalar(select(func.count(Review.id)).where(Review.user_id == user_id)) or 0
    return count


def calc_progress_30_reviews_written(user_id: int, db: Session) -> int:
    """
    Challenge ID 25: "Cronista Incansable"
    Target: 30 reseñas escritas
    """
    count = db.scalar(select(func.count(Review.id)).where(Review.user_id == user_id)) or 0
    return count


def calc_progress_vote_30_reviews(user_id: int, db: Session) -> int:
    """
    Challenge ID 26: "Votante Serial"
    Target: 30 votos emitidos
    """
    count = db.scalar(select(func.count(ReviewVote.id)).where(ReviewVote.user_id == user_id)) or 0
    return count


def calc_progress_vote_10_helpful_given(user_id: int, db: Session) -> int:
    """
    Challenge ID 27: "Apoyo Constructivo"
    Target: 10 votos de 'útil' emitidos
    """
    count = db.scalar(
        select(func.count(ReviewVote.id))
        .where(ReviewVote.user_id == user_id)
        .where(ReviewVote.is_helpful.is_(True))
    ) or 0
    return count


def calc_progress_vote_5_not_helpful_given(user_id: int, db: Session) -> int:
    """
    Challenge ID 28: "Ojo Crítico"
    Target: 5 votos de 'no útil' emitidos
    """
    count = db.scalar(
        select(func.count(ReviewVote.id))
        .where(ReviewVote.user_id == user_id)
        .where(ReviewVote.is_helpful.is_(False))
    ) or 0
    return count


def calc_progress_helpful_votes_received_25(user_id: int, db: Session) -> int:
    """
    Challenge ID 29: "Crítico Referente"
    Target: 25 votos de 'útil' recibidos en tus reseñas
    """
    count = db.scalar(
        select(func.count(ReviewVote.id))
        .join(Review, ReviewVote.review_id == Review.id)
        .where(Review.user_id == user_id)
        .where(ReviewVote.is_helpful.is_(True))
    ) or 0
    return count


def calc_progress_owner_replies_3(user_id: int, db: Session) -> int:
    """
    Challenge ID 30: "Anfitrión Responde"
    Target: 3 respuestas a reseñas en tus lugares
    """
    count = db.scalar(
        select(func.count(Review.id))
        .join(Place, Review.place_id == Place.id)
        .where(Place.owner_id == user_id)
        .where(Review.reply_text.isnot(None))
    ) or 0
    return count


def calc_progress_owner_replies_10(user_id: int, db: Session) -> int:
    """
    Challenge ID 31: "Anfitrión Atento"
    Target: 10 respuestas a reseñas en tus lugares
    """
    count = db.scalar(
        select(func.count(Review.id))
        .join(Place, Review.place_id == Place.id)
        .where(Place.owner_id == user_id)
        .where(Review.reply_text.isnot(None))
    ) or 0
    return count


# ============================================================================
# Challenge Calculator Mapping
# ============================================================================

# Map challenge IDs to their calculator functions
CHALLENGE_CALCULATORS = {
    1: calc_progress_first_review,
    3: calc_progress_five_star_review,
    4: calc_progress_publish_first_place,
    5: calc_progress_get_5_reviews,
    8: calc_progress_complete_profile,
    9: calc_progress_10_reviews,
    10: calc_progress_review_5_restaurants,
    11: calc_progress_review_3_hotels,
    12: calc_progress_visit_3_cities,
    13: calc_progress_review_5_countries,
    14: calc_progress_review_argentina,
    15: calc_progress_review_8_restaurants,
    16: calc_progress_review_5_hotels,
    17: calc_progress_helpful_votes,
    18: calc_progress_vote_15_reviews,
    19: calc_progress_publish_3_places,
    20: calc_progress_publish_5_places,
    21: calc_progress_publish_10_places,
    22: calc_progress_get_10_reviews,
    23: calc_progress_get_20_reviews,
    24: calc_progress_20_reviews_written,
    25: calc_progress_30_reviews_written,
    26: calc_progress_vote_30_reviews,
    27: calc_progress_vote_10_helpful_given,
    28: calc_progress_vote_5_not_helpful_given,
    29: calc_progress_helpful_votes_received_25,
    30: calc_progress_owner_replies_3,
    31: calc_progress_owner_replies_10,
    32: calc_progress_review_5_lodgings,
}


# ============================================================================
# Main Challenge Update Function
# ============================================================================

def check_and_update_user_challenges(
    user_id: int, db: Session
) -> Dict[int, int]:
    """
    Recalculates progress for ALL challenges for a specific user.
    Updates UserChallenge records with current progress and completion status.
    Sends email notification when a challenge is newly completed.

    Args:
        user_id: The user ID to update challenges for
        db: Database session

    Returns:
        Dictionary mapping challenge_id to current_progress
    """
    # Get all challenges
    stmt = select(Challenge)
    challenges = db.execute(stmt).scalars().all()

    progress_map = {}
    newly_completed_challenges = []  # Track newly completed challenges

    for challenge in challenges:
        # Get the calculator function for this challenge
        calculator = CHALLENGE_CALCULATORS.get(challenge.id)
        if not calculator:
            # Skip challenges without calculators (shouldn't happen)
            continue

        # Calculate current progress
        current_progress = calculator(user_id, db)

        # Determine if challenge is complete
        is_completed = current_progress >= challenge.target_value

        # Find or create UserChallenge record
        user_challenge = db.scalar(
            select(UserChallenge)
            .where(UserChallenge.user_id == user_id)
            .where(UserChallenge.challenge_id == challenge.id)
        )

        if not user_challenge:
            # Create new record
            user_challenge = UserChallenge(
                user_id=user_id,
                challenge_id=challenge.id,
                current_progress=current_progress,
                is_completed=is_completed,
                completed_at=datetime.now() if is_completed else None
            )
            db.add(user_challenge)
            
            # If newly created and already completed, mark for notification
            if is_completed:
                newly_completed_challenges.append(challenge.id)
        else:
            # Update existing record
            was_completed = user_challenge.is_completed
            user_challenge.current_progress = current_progress
            user_challenge.is_completed = is_completed

            # Set completed_at timestamp when first completed
            if is_completed and not was_completed:
                user_challenge.completed_at = datetime.now()
                # Track newly completed challenge for notification
                newly_completed_challenges.append(challenge.id)

        progress_map[challenge.id] = current_progress

    db.commit()

    # Send email notifications for newly completed challenges
    # if newly_completed_challenges:
    #     _send_reward_available_notifications(
    #         user_id, newly_completed_challenges, db
    #     )

    return progress_map


def _send_reward_available_notifications(
    user_id: int, challenge_ids: list[int], db: Session
) -> None:
    """
    Envía notificaciones por email cuando uno o más desafíos se completan.
    
    Args:
        user_id: ID del usuario que completó los desafíos
        challenge_ids: Lista de IDs de desafíos recién completados
        db: Sesión de base de datos
    """
    try:
        # Importar aquí para evitar circular imports
        from services.email_service import get_email_service
        
        # Obtener información del usuario
        user = db.scalar(select(User).where(User.id == user_id))
        if not user:
            logger.warning(
                f"Usuario {user_id} no encontrado para notificación"
            )
            return
        
        user_name = user.full_name or user.username
        email_service = get_email_service()
        
        # Para cada desafío completado, obtener su recompensa asociada
        for challenge_id in challenge_ids:
            # Buscar el desafío y su recompensa
            challenge = db.scalar(
                select(Challenge).where(Challenge.id == challenge_id)
            )
            if not challenge:
                continue
            
            # Buscar la recompensa asociada al desafío
            reward = db.scalar(
                select(Reward).where(Reward.challenge_id == challenge_id)
            )
            
            if reward:
                # Enviar notificación
                logger.info(
                    f"Enviando notificación de recompensa disponible "
                    f"a {user.email} para el desafío '{challenge.title}'"
                )
                
                email_service.send_reward_available_notification(
                    user_email=user.email,
                    user_name=user_name,
                    reward_title=reward.title,
                    reward_description=reward.description,
                    challenge_title=challenge.title
                )
            else:
                logger.warning(
                    f"No se encontró recompensa para el desafío "
                    f"{challenge_id} '{challenge.title}'"
                )
                
    except Exception as e:
        # No fallar el proceso principal si hay error en el envío de emails
        logger.error(
            f"Error al enviar notificaciones de recompensas "
            f"disponibles: {str(e)}"
        )


def update_challenge_for_place_owner(place_id: int, db: Session) -> None:
    """
    Helper function to update challenges for a place owner when their place receives a review.
    Used specifically for Challenge 5 (get_5_reviews).

    Args:
        place_id: The place that received a review
        db: Database session
    """
    # Get the place owner
    place = db.scalar(select(Place).where(Place.id == place_id))
    if place and place.owner_id:
        check_and_update_user_challenges(place.owner_id, db)
