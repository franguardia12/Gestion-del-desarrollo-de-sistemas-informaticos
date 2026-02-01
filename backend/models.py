from __future__ import annotations

from datetime import date, datetime, time
from enum import Enum
from typing import List

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from constants import DEFAULT_AVATAR_URL



class Base(DeclarativeBase):
    pass


class RewardType(str, Enum):
    """Types of rewards that can be earned"""
    DISCOUNT = "discount"
    USER_BADGE = "user_badge"
    PLACE_BADGE = "place_badge"


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    country: Mapped[str | None] = mapped_column(String(120))
    city_state: Mapped[str | None] = mapped_column(String(255))  # Ciudad y Estado combinados
    street: Mapped[str | None] = mapped_column(String(255))
    street_number: Mapped[str | None] = mapped_column(String(50))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)

    country_filter: Mapped[str | None] = mapped_column(String(120))
    city_state_filter: Mapped[str | None] = mapped_column(String(255))
    street_filter: Mapped[str | None] = mapped_column(String(255))

    category: Mapped[str | None] = mapped_column(String(80))
    description: Mapped[str | None] = mapped_column(Text)
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0)
    capacity: Mapped[int | None] = mapped_column(Integer)
    price_per_night: Mapped[float | None] = mapped_column(Float)

    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), # Apunta a la tabla 'users'
        nullable=False # Un lugar DEBE tener un dueño
    )
    
    # 2. Relación de SQLAlchemy (opcional, pero útil)
    owner: Mapped["User"] = relationship(
        backref="places", # Crea un campo 'places' en el objeto User
        #uselist=False # No es una lista, es solo un objeto (si quieres)
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    photos: Mapped[List["PlacePhoto"]] = relationship(
        back_populates="place",
        cascade="all, delete-orphan",
        order_by="PlacePhoto.sort_order",
    )
    unavailabilities: Mapped[List["PlaceUnavailability"]] = relationship(
        back_populates="place",
        cascade="all, delete-orphan",
        order_by="PlaceUnavailability.start_date",
    )
    bookings: Mapped[List["Booking"]] = relationship(
        back_populates="place",
        cascade="all, delete-orphan",
        order_by="Booking.check_in_date",
    )
    reviews: Mapped[List["Review"]] = relationship(
        back_populates="place",
        cascade="all, delete-orphan",
        order_by=lambda: Review.created_at.desc(),
    )
    schedules: Mapped[List["PlaceSchedule"]] = relationship(
        back_populates="place",
        cascade="all, delete-orphan",
        order_by="PlaceSchedule.day_of_week",
    )
    user_rewards: Mapped[List["UserReward"]] = relationship(
        back_populates="place",
        cascade="all, delete-orphan",
    )



class PlacePhoto(Base):
    __tablename__ = "place_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    photo_file_id: Mapped[str | None] = mapped_column(String(96))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    place: Mapped[Place] = relationship(back_populates="photos")


class PlaceUnavailability(Base):
    __tablename__ = "place_unavailabilities"
    __table_args__ = (
        UniqueConstraint(
            "place_id",
            "start_date",
            "end_date",
            name="uq_place_unavailabilities",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), nullable=False
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    place: Mapped[Place] = relationship(back_populates="unavailabilities")


class PlaceSchedule(Base):
    __tablename__ = "place_schedules"
    __table_args__ = (
        UniqueConstraint(
            "place_id",
            "day_of_week",
            name="uq_place_schedules",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), nullable=False
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    opening_time: Mapped[time | None] = mapped_column(Time)
    closing_time: Mapped[time | None] = mapped_column(Time)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    place: Mapped[Place] = relationship(back_populates="schedules")


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        UniqueConstraint(
            "place_id",
            "check_in_date",
            "check_out_date",
            name="uq_bookings",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), nullable=False
    )
    guest_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    check_in_date: Mapped[date] = mapped_column(Date, nullable=False)
    check_out_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_price: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    place: Mapped[Place] = relationship(back_populates="bookings")
    guest: Mapped["User"] = relationship(back_populates="bookings")


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    place_id: Mapped[int] = mapped_column(
        ForeignKey("places.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str | None] = mapped_column(String(255))
    comment: Mapped[str | None] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Reply from the place owner
    reply_text: Mapped[str | None] = mapped_column(Text)
    reply_created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    reply_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    place: Mapped[Place] = relationship(back_populates="reviews")
    user: Mapped["User"] = relationship(back_populates="reviews")
    photos: Mapped[List["ReviewPhoto"]] = relationship(
        back_populates="review",
        cascade="all, delete-orphan",
        order_by="ReviewPhoto.id",
    )
    votes: Mapped[List["ReviewVote"]] = relationship(
        back_populates="review",
        cascade="all, delete-orphan",
    )


class ReviewPhoto(Base):
    __tablename__ = "review_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False
    )
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    photo_file_id: Mapped[str | None] = mapped_column(String(96))

    review: Mapped[Review] = relationship(back_populates="photos")


class ReviewVote(Base):
    __tablename__ = "review_votes"
    __table_args__ = (
        UniqueConstraint(
            "review_id",
            "user_id",
            name="uq_review_votes",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    review_id: Mapped[int] = mapped_column(
        ForeignKey("reviews.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_helpful: Mapped[bool] = mapped_column(Boolean, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    review: Mapped[Review] = relationship(back_populates="votes")
    user: Mapped["User"] = relationship(back_populates="review_votes")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    is_owner: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    birthdate: Mapped[date | None] = mapped_column(Date)
    city: Mapped[str | None] = mapped_column(String(120))
    country: Mapped[str | None] = mapped_column(String(120))
    bio: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str] = mapped_column(
        String(512),
        default=DEFAULT_AVATAR_URL,
        server_default=DEFAULT_AVATAR_URL,
        nullable=False,
    )
    photo_file_id: Mapped[str | None] = mapped_column(String(96))
    joined_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user_rewards: Mapped[List["UserReward"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    
    achievements: Mapped[List["UserAchievement"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    bookings: Mapped[List["Booking"]] = relationship(
        back_populates="guest", cascade="all, delete-orphan"
    )
    reviews: Mapped[List["Review"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        order_by=lambda: Review.created_at.desc(),
    )
    review_votes: Mapped[List["ReviewVote"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    user_challenges: Mapped[List["UserChallenge"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Achievement(Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    icon_url: Mapped[str | None] = mapped_column(String(512))

    users: Mapped[List["UserAchievement"]] = relationship(
        back_populates="achievement", cascade="all, delete-orphan"
    )


class UserAchievement(Base):
    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "achievement_id",
            name="uq_user_achievements",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    achievement_id: Mapped[int] = mapped_column(
        ForeignKey("achievements.id", ondelete="CASCADE"), nullable=False
    )
    earned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="achievements")
    achievement: Mapped[Achievement] = relationship(back_populates="users")



class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    
    # Lógica de juego:
    points_awarded: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    target_value: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    
    # Relaciones
    rewards: Mapped[List["Reward"]] = relationship(
        back_populates="challenge", cascade="all, delete-orphan"
    )
    user_challenges: Mapped[List["UserChallenge"]] = relationship(
        back_populates="challenge", cascade="all, delete-orphan"
    )



class Reward(Base):
    __tablename__ = "rewards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Challenge association
    challenge_id: Mapped[int | None] = mapped_column(
        ForeignKey("challenges.id", ondelete="SET NULL"), nullable=True
    )

    # Reward type classification
    reward_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="discount"
    )

    # Badge-specific fields (only used when reward_type is user_badge or place_badge)
    badge_icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    badge_display_name: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # Relationships
    challenge: Mapped["Challenge"] = relationship(back_populates="rewards")
    user_rewards: Mapped[List["UserReward"]] = relationship(
        back_populates="reward", cascade="all, delete-orphan"
    )

# -------------------------------------------------------------
# 2. TABLA USERCHALLENGE (Progreso del usuario en desafíos)
# -------------------------------------------------------------
class UserChallenge(Base):
    __tablename__ = "user_challenges"

    __table_args__ = (
        UniqueConstraint("user_id", "challenge_id", name="uq_user_challenge"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # FK al usuario
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # FK al desafío
    challenge_id: Mapped[int] = mapped_column(ForeignKey("challenges.id", ondelete="CASCADE"))

    # Progreso del desafío
    current_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relaciones
    user: Mapped["User"] = relationship(back_populates="user_challenges")
    challenge: Mapped["Challenge"] = relationship(back_populates="user_challenges")


# -------------------------------------------------------------
# 3. TABLA USERREWARD (Recompensas reclamadas por el usuario)
# -------------------------------------------------------------
class UserReward(Base):
    __tablename__ = "user_rewards"

    __table_args__ = (
        UniqueConstraint("user_id", "reward_id", name="uq_user_reward"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    # FK al usuario
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))

    # FK a la recompensa
    reward_id: Mapped[int] = mapped_column(ForeignKey("rewards.id", ondelete="CASCADE"))

    # FK al lugar (opcional, solo para place_badge rewards)
    place_id: Mapped[int | None] = mapped_column(
        ForeignKey("places.id", ondelete="SET NULL"), nullable=True
    )

    # Estado de la recompensa
    claimed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), nullable=False)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relaciones
    user: Mapped["User"] = relationship(back_populates="user_rewards")
    reward: Mapped["Reward"] = relationship(back_populates="user_rewards")
    place: Mapped["Place | None"] = relationship(back_populates="user_rewards")
