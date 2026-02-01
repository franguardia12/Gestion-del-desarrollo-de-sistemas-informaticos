from __future__ import annotations

from datetime import date, datetime
from typing import Iterable, Optional

from pydantic import BaseModel
from sqlalchemy import select, func

from constants import DEFAULT_AVATAR_URL
from models import User, UserAchievement, UserReward, Reward

MONTHS_ES = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
]


def _calculate_age(birthdate: date | None) -> Optional[int]:
    if not birthdate:
        return None
    today = date.today()
    years = today.year - birthdate.year
    has_had_birthday = (today.month, today.day) >= (birthdate.month, birthdate.day)
    return years if has_had_birthday else years - 1


def _format_joined_at(joined_at: datetime | None) -> Optional[str]:
    if not joined_at:
        return None
    month_index = joined_at.month - 1
    month_name = MONTHS_ES[month_index] if 0 <= month_index < len(MONTHS_ES) else ""
    month_title = month_name.capitalize() if month_name else ""
    return f"{month_title} {joined_at.year}".strip()


class UserAchievementInfo(BaseModel):
    slug: str
    name: str
    description: Optional[str] = None
    icon_url: Optional[str] = None
    earned_at: Optional[str] = None


class UserProfileStats(BaseModel):
    reviews_count: int
    achievements_count: int


class UserReview(BaseModel):
    id: int
    place_id: int
    place_name: str
    author_id: int
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    photos: list[str] = []
    created_at: str
    helpful_votes: int = 0
    not_helpful_votes: int = 0
    user_vote: Optional[str] = None
    place_rating_avg: Optional[float] = None
    place_photo_url: Optional[str] = None


class UserProfile(BaseModel):
    username: str
    full_name: Optional[str] = None
    age: Optional[int] = None
    city: Optional[str] = None
    country: Optional[str] = None
    joined_in: Optional[str] = None
    photo_url: str
    bio: Optional[str] = None
    is_owner: bool
    stats: UserProfileStats
    achievements: list[UserAchievementInfo]
    reviews: list[UserReview]


def _order_achievements(achievements: Iterable[UserAchievement]) -> list[UserAchievement]:
    return sorted(
        achievements,
        key=lambda item: (item.earned_at is not None, item.earned_at),
        reverse=True,
    )


def build_user_profile(user: User, db=None) -> UserProfile:
    ordered_achievements = _order_achievements(user.achievements)
    achievements_payload: list[UserAchievementInfo] = []
    reviews_payload: list[UserReview] = []

    for item in ordered_achievements:
        achievement = item.achievement
        achievements_payload.append(
            UserAchievementInfo(
                slug=achievement.slug,
                name=achievement.name,
                description=achievement.description,
                icon_url=achievement.icon_url,
                earned_at=item.earned_at.isoformat() if item.earned_at else None,
            )
        )

    for review in user.reviews:
        place = review.place
        place_rating = (
            float(place.rating_avg) if place and place.rating_avg is not None else None
        )
        place_cover = place.photos[0].url if place and place.photos else None
        helpful_votes = sum(1 for vote in review.votes if vote.is_helpful)
        not_helpful_votes = sum(1 for vote in review.votes if not vote.is_helpful)
        reviews_payload.append(
            UserReview(
                id=review.id,
                place_id=review.place_id,
                place_name=place.name if place else "",
                author_id=review.user_id,
                rating=review.rating,
                title=review.title,
                comment=review.comment,
                photos=[p.url for p in review.photos],
                created_at=review.created_at.isoformat(),
                helpful_votes=helpful_votes,
                not_helpful_votes=not_helpful_votes,
                place_rating_avg=place_rating,
                place_photo_url=place_cover,
            )
        )

    # Count user_badge type rewards that are claimed
    user_badges_count = 0
    if db is not None:
        user_badges_count = db.scalar(
            select(func.count(UserReward.id))
            .join(Reward, UserReward.reward_id == Reward.id)
            .where(UserReward.user_id == user.id)
            .where(Reward.reward_type == "user_badge")
        ) or 0

    return UserProfile(
        username=user.username,
        full_name=user.full_name,
        age=_calculate_age(user.birthdate),
        city=user.city,
        country=user.country,
        joined_in=_format_joined_at(user.joined_at),
        photo_url=user.photo_url or DEFAULT_AVATAR_URL,
        bio=user.bio,
        is_owner=user.is_owner,
        stats=UserProfileStats(
            reviews_count=len(reviews_payload),
            achievements_count=user_badges_count,
        ),
        achievements=achievements_payload,
        reviews=reviews_payload,
    )
