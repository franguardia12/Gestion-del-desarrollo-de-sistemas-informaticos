from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import select
from models import Place, UserReward, Reward
from services.place_schemas import PlaceSummarySchema


def get_place_badges(db: Session, place_id: int) -> List[str]:
    """
    Get list of active badge icons for a specific place.
    Returns badge_icon values like ["popular", "new"] based on claimed place_badge type rewards.
    """
    stmt = (
        select(Reward.badge_icon)
        .join(UserReward, UserReward.reward_id == Reward.id)
        .where(UserReward.place_id == place_id)
        .where(Reward.reward_type == "place_badge")
        .where(UserReward.is_used == False)  # Badge still active (not expired/used)
        .where(Reward.badge_icon.isnot(None))
    )

    result = db.execute(stmt).scalars().all()
    return list(result)


def get_owner_places(db: Session, owner_id: int) -> List[PlaceSummarySchema]:
    stmt = select(Place).where(Place.owner_id == owner_id)
    places = db.execute(stmt).scalars().all()

    place_summaries: List[PlaceSummarySchema] = []

    for place in places:
        photo_urls = [photo.url for photo in place.photos]

        # Get badges specific to THIS place
        badges = get_place_badges(db, place.id)

        place_schema = PlaceSummarySchema.from_orm(place)

        place_schema.photos = photo_urls
        place_schema.badges = badges

        if place.description:
            place_schema.description_short = place.description[:100] + "..." if len(place.description) > 100 else place.description

        place_summaries.append(place_schema)

    return place_summaries