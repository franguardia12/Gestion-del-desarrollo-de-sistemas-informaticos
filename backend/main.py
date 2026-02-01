from __future__ import annotations
from datetime import date
from typing import Dict, List, Optional, Literal
from datetime import date, datetime, time
from typing import List, Optional
import re
import unicodedata
import random

# ... otros imports ...
from routers import places # Router que ya existe


from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import select, distinct, func, asc, case
from sqlalchemy.orm import Session, joinedload

app = FastAPI(title="ViajerosXP API")

from database import engine, get_session
from constants import DEFAULT_AVATAR_URL
from auth import get_optional_user
from models import (
    Achievement,
    Base,
    Place,
    Review as ReviewModel,
    ReviewVote,
    PlaceSchedule,
    PlaceUnavailability,
    User,
    UserAchievement,
    Challenge,
    Reward,
    UserChallenge,
    UserReward,
)
from routers import auth, places, geocoding, reviews, users
from auth import get_current_user
from routers import auth, places, geocoding, reviews, rewards, users
from services.user_profile import UserProfile, build_user_profile
from services.virtual_assistant_ai import FALLBACK_MESSAGE, generate_ai_response, is_ai_enabled
from services.virtual_assistant_rules import (
    detect_category_keyword,
    get_category_label,
    match_scripted_response,
)
from services.challenge_service import check_and_update_user_challenges
from settings import get_settings

settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(places.router)
app.include_router(geocoding.router)
app.include_router(reviews.router)
app.include_router(users.router)
app.include_router(rewards.router)

uploads_root = settings.uploads_root
uploads_root.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_root), name="uploads")

@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)

class Availability(BaseModel):
    start: date
    end: date

class Unavailability(BaseModel):
    start: date
    end: date

class Schedule(BaseModel):
    day_of_week: int
    opening_time: Optional[str] = None
    closing_time: Optional[str] = None
    is_closed: bool

class PlaceSummary(BaseModel):
    id: int
    name: str
    city_state: Optional[str] = None
    country: Optional[str] = None
    description_short: Optional[str] = None
    rating_avg: float
    category: Optional[str] = None
    price_per_night: Optional[float] = None
    availability: list[Availability] = Field(default_factory=list)
    photos: list[str]
    badges: list[str] = Field(default_factory=list)

class PlaceDetail(BaseModel):
    id: int
    name: str
    city_state: Optional[str] = None  # CORREGIDO: era city_statcode
    country: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    rating_avg: float
    capacity: Optional[int] = None
    price_per_night: Optional[float] = None
    unavailabilities: list[Unavailability]
    schedules: list[Schedule]
    photos: list[str]
    owner_id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    street: Optional[str] = None
    street_number: Optional[str] = None

class Review(BaseModel):
    id: int
    place_id: int
    author_id: int
    rating: int
    title: Optional[str] = None
    comment: Optional[str] = None
    photos: list[str]
    author_name: str
    author_photo_url: str
    place_name: Optional[str] = None
    place_rating_avg: Optional[float] = None
    place_photo_url: Optional[str] = None
    helpful_votes: int = 0
    not_helpful_votes: int = 0
    user_vote: Optional[str] = None
    created_at: str  # ISO8601
    # Owner reply fields
    reply_text: Optional[str] = None
    reply_created_at: Optional[str] = None
    reply_updated_at: Optional[str] = None

class ChatbotAIMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class TravelPreferences(BaseModel):
    step: Literal[
        "need_category",
        "need_bundle",
        "need_location",
        "need_price_min",
        "need_price_max",
        "need_guests",
        "need_check_in",
        "need_check_out",
        "need_visit_date",
        "need_visit_time",
        "complete",
    ] = "need_category"
    category: Optional[str] = None
    location: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    guests: Optional[int] = None
    check_in: Optional[str] = None
    check_out: Optional[str] = None
    visit_date: Optional[str] = None
    visit_date_end: Optional[str] = None
    visit_time: Optional[str] = None
    visit_time_end: Optional[str] = None


class RecommendedPlace(BaseModel):
    id: Optional[int] = None
    name: str
    category: Optional[str] = None


class AssistantState(BaseModel):
    pending_intent: Optional[Literal["travel_recommendation"]] = None
    travel_preferences: Optional[TravelPreferences] = None
    recommended_places: list[RecommendedPlace] = Field(default_factory=list)
    last_category: Optional[str] = None
    rewards_context: bool = False

class ChatbotAIRequest(BaseModel):
    messages: list[ChatbotAIMessage] = Field(min_length=1)
    state: Optional[AssistantState] = None
    user_name: Optional[str] = None

class ChatbotAIResponse(BaseModel):
    message: str
    state: Optional[AssistantState] = None

def _shorten(text: str, n: int = 140) -> str:
    if text is None:
        return ""
    text = text.strip()
    return text if len(text) <= n else text[: n - 1] + "…"

@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/chatbot/ai/respond", response_model=ChatbotAIResponse)
def chatbot_ai_respond(
    payload: ChatbotAIRequest,
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
) -> ChatbotAIResponse:
    last_user_message = next((msg.content for msg in reversed(payload.messages) if msg.role == "user"), "").strip()
    if not last_user_message:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío.")
    state = payload.state or AssistantState()
    user_name = payload.user_name

    if state.pending_intent == "travel_recommendation":
        response_text, next_state = handle_travel_recommendation(
            last_user_message,
            state,
            db,
            user_name=user_name,
            current_user=current_user,
        )
        return ChatbotAIResponse(message=response_text, state=_normalize_state(next_state))

    if _is_new_recommendation_request(last_user_message):
        prompt = "¿Qué buscás esta vez: hoteles, restaurantes o alojamientos?"
        fresh_state = AssistantState(
            pending_intent="travel_recommendation",
            travel_preferences=TravelPreferences(step="need_category"),
            recommended_places=[],
            last_category=None,
            rewards_context=False,
        )
        return ChatbotAIResponse(message=prompt, state=_normalize_state(fresh_state))

    rewards_scope, explicit_category = detect_rewards_scope(last_user_message, state)
    if rewards_scope == "places":
        if not state.recommended_places:
            return ChatbotAIResponse(
                message="Primero necesitás una lista de lugares recomendados para saber qué retos tienen.",
                state=_normalize_state(state),
            )
        message = describe_rewards_for_places(state.recommended_places, db, current_user=current_user)
        updated_state = AssistantState(
            pending_intent=state.pending_intent,
            travel_preferences=state.travel_preferences,
            recommended_places=state.recommended_places,
            last_category=state.last_category,
            rewards_context=True,
        )
        return ChatbotAIResponse(message=message, state=_normalize_state(updated_state))
    if rewards_scope == "category":
        category = explicit_category or state.last_category
        if not category:
            return ChatbotAIResponse(
                message="Decime antes una categoría (hotel, restaurante o alojamiento) o pedime recomendaciones y luego te muestro los retos.",
                state=_normalize_state(state),
            )
        message = describe_rewards_for_category(category, db, current_user=current_user)
        updated_state = AssistantState(
            pending_intent=state.pending_intent,
            travel_preferences=state.travel_preferences,
            recommended_places=state.recommended_places,
            last_category=category,
            rewards_context=True,
        )
        return ChatbotAIResponse(message=message, state=_normalize_state(updated_state))

    scripted = match_scripted_response(last_user_message, user_name=user_name)
    if scripted:
        next_state: Optional[AssistantState] = None
        if scripted.next_intent == "travel_recommendation":
            next_state = AssistantState(
                pending_intent="travel_recommendation",
                travel_preferences=TravelPreferences(),
            )
        elif scripted.next_intent:
            next_state = AssistantState(pending_intent=scripted.next_intent)
        return ChatbotAIResponse(message=scripted.message, state=_normalize_state(next_state))

    if not is_ai_enabled():
        return ChatbotAIResponse(message=FALLBACK_MESSAGE)

    message = generate_ai_response([msg.model_dump() for msg in payload.messages])
    return ChatbotAIResponse(message=message)


def _normalize_state(state: Optional[AssistantState]) -> Optional[AssistantState]:
    if not state:
        return None
    if (
        not state.pending_intent
        and not state.travel_preferences
        and not state.recommended_places
        and not state.last_category
        and not state.rewards_context
    ):
        return None
    return state


def _extract_number(text: str) -> Optional[int]:
    digits = re.findall(r"\d+", text.replace(".", "").replace(",", ""))
    if not digits:
        return None
    try:
        return int(digits[0])
    except ValueError:
        return None


def _parse_date(value: Optional[str | date]) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except (ValueError, AttributeError):
            continue
    return None


def _parse_time(value: Optional[str | time]) -> Optional[time]:
    if not value:
        return None
    if isinstance(value, time):
        return value
    for fmt in ("%H:%M", "%H.%M"):
        try:
            return datetime.strptime(value.strip(), fmt).time()
        except (ValueError, AttributeError):
            continue
    return None


def _parse_bundle(prefs: TravelPreferences, text: str) -> tuple[bool, TravelPreferences | str]:
    parts = [part.strip() for part in text.split(",") if part.strip()]
    if prefs.category == "restaurante":
        if len(parts) < 3:
            return False, "Necesito los tres datos: ubicación, fecha o rango, y horario o rango, separados por comas."
        location, date_part, time_part = parts[:3]
        dates = _parse_date_range(date_part)
        times = _parse_time_range(time_part)
        if not dates:
            return False, "No pude leer la fecha. Usá un formato como 05/12/2025 o 05/12/2025 al 12/12/2025."
        if not times:
            return False, "No pude leer el horario. Usá 20:30 o un rango como 20:00 a 23:00."
        new_prefs = TravelPreferences(**prefs.model_dump())
        new_prefs.location = location
        new_prefs.visit_date = dates[0].isoformat()
        if len(dates) > 1:
            new_prefs.visit_date_end = dates[1].isoformat()
        new_prefs.visit_time = times[0].strftime("%H:%M")
        if len(times) > 1:
            new_prefs.visit_time_end = times[1].strftime("%H:%M")
        return True, new_prefs

    # Hoteles / alojamientos
    if len(parts) < 5:
        return False, "Necesito: ubicación, precio mínimo, precio máximo, huéspedes y rango de fechas, separados por comas."
    location, min_part, max_part, guests_part, date_part = parts[:5]
    min_price = _extract_number(min_part)
    max_price = _extract_number(max_part)
    guests = _extract_number(guests_part)
    dates = _parse_date_range(date_part)
    if min_price is None or max_price is None or guests is None:
        return False, "Revisá los precios y la cantidad de huéspedes. Usá números, por ejemplo 40000, 120000, 4."
    if min_price > max_price:
        return False, "El precio mínimo no puede superar al máximo. Revisá los valores."
    if not dates or len(dates) < 2:
        return False, "Indicá un rango de fechas como 05/12/2025 al 12/12/2025."
    new_prefs = TravelPreferences(**prefs.model_dump())
    new_prefs.location = location
    new_prefs.min_price = float(min_price)
    new_prefs.max_price = float(max_price)
    new_prefs.guests = int(guests)
    new_prefs.check_in = dates[0].isoformat()
    new_prefs.check_out = dates[1].isoformat()
    return True, new_prefs


def _parse_date_range(text: str) -> list[date]:
    """
    Intenta extraer fechas de un texto. 
    Puede ser una sola fecha o un rango (ej: "25/10 al 27/10" o "del 25/10 al 27/10").
    Retorna una lista de fechas encontradas.
    """
    # Buscar patrones de rango: "del X al Y", "X al Y", "X-Y", "X a Y"
    range_patterns = [
        r"del?\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?)\s+al?\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?)",
        r"(\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?)\s+al?\s+(\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?)",
        r"(\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?)\s*[-–—]\s*(\d{1,2}[/-]\d{1,2}(?:[/-]\d{4})?)",
    ]
    
    for pattern in range_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date1 = _parse_date(match.group(1))
            date2 = _parse_date(match.group(2))
            if date1 and date2:
                return [date1, date2]
    
    # Si no encontramos un rango, buscar una sola fecha
    single_date = _parse_date(text)
    if single_date:
        return [single_date]
    
    return []


def _parse_time_range(text: str) -> list[time]:
    """
    Intenta extraer horarios de un texto.
    Puede ser un solo horario o un rango (ej: "20:00 a 22:00").
    Retorna una lista de horarios encontrados.
    """
    # Buscar patrones de rango: "X a Y", "X-Y", "de X a Y"
    range_patterns = [
        r"de\s+(\d{1,2}[:\.]\d{2})\s+a\s+(\d{1,2}[:\.]\d{2})",
        r"(\d{1,2}[:\.]\d{2})\s+a\s+(\d{1,2}[:\.]\d{2})",
        r"(\d{1,2}[:\.]\d{2})\s*[-–—]\s*(\d{1,2}[:\.]\d{2})",
    ]
    
    for pattern in range_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            time1 = _parse_time(match.group(1))
            time2 = _parse_time(match.group(2))
            if time1 and time2:
                return [time1, time2]
    
    # Si no encontramos un rango, buscar un solo horario
    single_time = _parse_time(text)
    if single_time:
        return [single_time]
    
    return []


def _prefill_from_text(prefs: TravelPreferences, user_text: str) -> TravelPreferences:
    """
    Intenta extraer información del texto del usuario para prellenar las preferencias.
    Esto permite que el usuario pueda proporcionar múltiples datos en un solo mensaje.
    """
    # Intentar detectar categoría si aún no está definida
    if not prefs.category:
        category = detect_category_keyword(user_text)
        if category:
            prefs.category = category
    
    # Por ahora, solo prellenamos la categoría automáticamente
    # Las demás propiedades se manejan en el flujo paso a paso
    return prefs


def handle_travel_recommendation(
    user_text: str,
    state: AssistantState,
    db: Session,
    *,
    user_name: Optional[str] = None,
    current_user: Optional[User] = None,
) -> tuple[str, AssistantState]:
    prefs = state.travel_preferences or TravelPreferences()
    prefs = TravelPreferences(**prefs.model_dump())
    is_restaurant = prefs.category == "restaurante"
    prefs = _prefill_from_text(prefs, user_text)

    if prefs.step == "need_category":
        category = detect_category_keyword(user_text)
        if not category:
            return (
                "Decime si buscás un hotel, un restaurante o un alojamiento y seguimos con los detalles.",
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )
        prefs.category = category
        prefs.step = "need_bundle"
        is_restaurant = category == "restaurante"
        if is_restaurant:
            prompt = (
                "Entendido. Ingresá ahora los datos que se adapten a tu plan: ubicación del restaurante, fecha o rango de fechas, "
                "y horario o franja horaria. Ejemplo: \"Buenos Aires, 05/12/2025 al 12/12/2025, 20:00 a 23:00\"."
            )
        else:
            prompt = (
                "Entendido. Ingresá ahora los datos que mejor se adapten a tu plan: ubicación, precio mínimo y máximo, cantidad de huéspedes "
                "y el rango de fechas de estadía. Ejemplo: \"Mendoza, 40000, 120000, 4, 05/12/2025 al 12/12/2025\"."
            )
        return prompt, AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs)

    if prefs.step == "need_bundle":
        ok, result = _parse_bundle(prefs, user_text)
        if not ok:
            return (
                result,
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )
        prefs = result
        prefs.step = "complete"

    if prefs.step == "need_location":
        location = user_text.strip()
        if len(location) < 2:
            return (
                "Necesito un nombre de ciudad, provincia o zona para orientarme. ¿Dónde te gustaría buscar?",
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )
        prefs.location = location
        if prefs.category == "restaurante":
            prefs.step = "need_visit_date"
            prompt = "¿Qué día querés ir? Podés escribir un día (25/10/2024) o un rango (25/10 al 27/10)."
        else:
            prefs.step = "need_price_min"
            prompt = "¿Cuál es el precio mínimo por noche que querés pagar? Indicá un número aproximado."
        return prompt, AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs)

    if prefs.category != "restaurante":
        if prefs.step == "need_price_min":
            min_price = _extract_number(user_text)
            if min_price is None:
                return (
                    "No pude reconocer el monto mínimo. Indicá un número como 40000.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            prefs.min_price = float(min_price)
            prefs.step = "need_price_max"
            return (
                "¿Y el precio máximo por noche?",
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )

        if prefs.step == "need_price_max":
            max_price = _extract_number(user_text)
            if max_price is None:
                return (
                    "No pude reconocer el monto máximo. Indicá un número como 120000.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            if prefs.min_price is not None and float(max_price) < prefs.min_price:
                return (
                    "El máximo no puede ser menor al mínimo. Indicá un valor más alto.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            prefs.max_price = float(max_price)
            prefs.step = "need_guests"
            return (
                "¿Para cuántas personas tiene que haber capacidad?",
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )

        if prefs.step == "need_guests":
            guests = _extract_number(user_text)
            if guests is None or guests <= 0:
                return (
                    "Decime un número entero de personas para continuar.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            prefs.guests = int(guests)
            prefs.step = "need_check_in"
            return (
                "¿Cuál es la fecha de check-in? (ej. 15/11/2024)",
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )

        if prefs.step == "need_check_in":
            check_in = _parse_date(user_text)
            if not check_in:
                return (
                    "No reconocí la fecha. Escribila como 15/11/2024.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            prefs.check_in = check_in.isoformat()
            prefs.step = "need_check_out"
            return (
                "¿Cuál es la fecha de check-out?",
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )

        if prefs.step == "need_check_out":
            check_out = _parse_date(user_text)
            check_in = _parse_date(prefs.check_in) if prefs.check_in else None
            if not check_out or not check_in:
                return (
                    "No reconocí la fecha. Intentá con un formato como 20/11/2024.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            if check_out <= check_in:
                return (
                    "La fecha de salida tiene que ser posterior a la de ingreso.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            prefs.check_out = check_out.isoformat()
            prefs.step = "complete"

    else:
        if prefs.step == "need_visit_date":
            dates = _parse_date_range(user_text)
            if not dates:
                return (
                    "No reconocí la fecha. Escribila como 28/10/2024 o indicá un rango como 28/10/2024 al 30/10/2024.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            prefs.visit_date = dates[0].isoformat()
            if len(dates) > 1:
                prefs.visit_date_end = dates[1].isoformat()
            prefs.step = "need_visit_time"
            return (
                "¿A qué hora te gustaría ir? Podés indicar una hora (20:30) o un rango (20:00 a 22:00).",
                AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
            )

        if prefs.step == "need_visit_time":
            times = _parse_time_range(user_text)
            if not times:
                return (
                    "No reconocí el horario. Probá con 20:30 o un rango como 20:00 a 22:00.",
                    AssistantState(pending_intent="travel_recommendation", travel_preferences=prefs),
                )
            prefs.visit_time = times[0].strftime("%H:%M")
            if len(times) > 1:
                prefs.visit_time_end = times[1].strftime("%H:%M")
            prefs.step = "complete"

    if prefs.step == "complete":
        if prefs.category == "restaurante":
            message, recommended = _build_restaurant_recommendations(
                prefs, db, user_name, current_user=current_user
            )
        else:
            message, recommended = _build_lodging_recommendations(
                prefs, db, user_name, current_user=current_user
            )
        next_state = AssistantState(
            recommended_places=recommended,
            last_category=prefs.category,
            rewards_context=False,
        )
        return message, next_state

    return (
        "Sigamos con la recomendación. ¿Querés probar nuevamente especificando categoría?",
        AssistantState(),
    )


def _build_lodging_recommendations(
    prefs: TravelPreferences,
    db: Session,
    user_name: Optional[str],
    *,
    current_user: Optional[User],
) -> tuple[str, list[RecommendedPlace]]:
    stmt = (
        select(Place)
        .where(func.lower(Place.category) == (prefs.category or ""))
        .options(joinedload(Place.unavailabilities))
    )
    if prefs.location:
        pattern = f"%{prefs.location.strip()}%"
        stmt = stmt.where(
            (Place.city_state.ilike(pattern))
            | (Place.name.ilike(pattern))
            | (Place.country.ilike(pattern))
        )
    if prefs.min_price is not None:
        stmt = stmt.where(Place.price_per_night >= prefs.min_price)
    if prefs.max_price is not None:
        stmt = stmt.where(Place.price_per_night <= prefs.max_price)
    if prefs.guests:
        stmt = stmt.where(Place.capacity.is_(None) | (Place.capacity >= prefs.guests))

    stmt = stmt.order_by(Place.rating_avg.desc(), Place.name.asc()).limit(15)
    places = db.scalars(stmt).unique().all()

    reviewed_ids: set[int] = set()
    if current_user:
        reviewed_ids = {
            row[0]
            for row in db.execute(
                select(ReviewModel.place_id).where(ReviewModel.user_id == current_user.id)
            ).all()
        }

    check_in = _parse_date(prefs.check_in)
    check_out = _parse_date(prefs.check_out)

    filtered: list[Place] = []
    for place in places:
        if check_in and check_out and not _is_place_available_for_dates(place, check_in, check_out):
            continue
        filtered.append(place)

    if not filtered:
        return (
            "Ningún establecimiento coincide con todos los criterios (zona, precios, fechas y capacidad). "
            "Podés ajustar los montos o las fechas y volver a intentarlo."
        ), []

    preferred = [p for p in filtered if p.id not in reviewed_ids]
    pool = preferred if len(preferred) >= 3 else preferred + [p for p in filtered if p.id in reviewed_ids]
    sampled = random.sample(pool, k=min(3, len(pool)))

    lines = []
    recommended: list[RecommendedPlace] = []
    for idx, place in enumerate(sampled, start=1):
        location = place.city_state or place.country or "sin ubicación"
        rating_text = _format_rating(place.rating_avg, fallback="Sin reseñas")
        price_text = _format_price(place.price_per_night)
        lines.append(f"{idx}) {place.name} – {location} - ⭐ {rating_text} - {price_text}/noche.")
        recommended.append(
            RecommendedPlace(
                id=getattr(place, "id", None),
                name=place.name,
                category=place.category,
            )
        )

    intro = f"{user_name or 'Te'} recomiendo estas opciones para vos:\n\n"
    return intro + " ".join(lines), recommended


def _build_restaurant_recommendations(
    prefs: TravelPreferences,
    db: Session,
    user_name: Optional[str],
    *,
    current_user: Optional[User],
) -> tuple[str, list[RecommendedPlace]]:
    stmt = (
        select(Place)
        .where(func.lower(Place.category) == "restaurante")
        .options(joinedload(Place.unavailabilities), joinedload(Place.schedules))
    )
    if prefs.location:
        pattern = f"%{prefs.location.strip()}%"
        stmt = stmt.where(
            (Place.city_state.ilike(pattern))
            | (Place.name.ilike(pattern))
            | (Place.country.ilike(pattern))
        )

    stmt = stmt.order_by(Place.rating_avg.desc(), Place.name.asc()).limit(20)
    places = db.scalars(stmt).unique().all()

    reviewed_ids: set[int] = set()
    if current_user:
        reviewed_ids = {
            row[0]
            for row in db.execute(
                select(ReviewModel.place_id).where(ReviewModel.user_id == current_user.id)
            ).all()
        }

    visit_date = _parse_date(prefs.visit_date)
    visit_time = _parse_time(prefs.visit_time) if prefs.visit_time else None

    filtered: list[Place] = []
    for place in places:
        if visit_date and visit_time:
            if not _is_restaurant_available(place, visit_date, visit_time):
                continue
        filtered.append(place)

    if not filtered:
        return (
            "No encontré restaurantes disponibles con esa zona, fecha y horario. "
            "Podés ajustar alguno de los datos y volver a preguntar."
        ), []

    preferred = [p for p in filtered if p.id not in reviewed_ids]
    pool = preferred if len(preferred) >= 3 else preferred + [p for p in filtered if p.id in reviewed_ids]
    sampled = random.sample(pool, k=min(3, len(pool)))

    intro = f"{user_name or 'Te'} sugiero estos restaurantes para vos:\n\n"

    lines = []
    recommended: list[RecommendedPlace] = []
    for idx, place in enumerate(sampled, start=1):
        location = place.city_state or place.country or "sin ubicación"
        rating_text = _format_rating(place.rating_avg, fallback="Sin reseñas")
        price_text = _format_price(place.price_per_night)
        lines.append(f"{idx}) {place.name} – {location} - ⭐ {rating_text} - {price_text}/ticket estimado.")
        recommended.append(
            RecommendedPlace(
                id=getattr(place, "id", None),
                name=place.name,
                category=place.category,
            )
        )
    return intro + " ".join(lines), recommended


def _is_place_available_for_dates(place: Place, check_in: date, check_out: date) -> bool:
    for unavailability in place.unavailabilities or []:
        start = unavailability.start_date
        end = unavailability.end_date
        if start and end and not (check_out <= start or check_in >= end):
            return False
    return True


def _is_restaurant_available(place: Place, visit_date: date, visit_time: time) -> bool:
    for unavailability in place.unavailabilities or []:
        start = unavailability.start_date
        end = unavailability.end_date
        if start and end and start <= visit_date <= end:
            return False

    weekday = visit_date.weekday()
    schedules = place.schedules or []
    schedule = next(
        (
            sch
            for sch in schedules
            if _normalize_schedule_day(sch.day_of_week) == weekday
        ),
        None,
    )
    if not schedule:
        return True
    if schedule.is_closed:
        return False

    opening = _parse_time(schedule.opening_time) if schedule.opening_time else time(0, 0)
    closing = _parse_time(schedule.closing_time) if schedule.closing_time else time(23, 59)
    if closing <= opening:
        closing = time(23, 59)
    return opening <= visit_time <= closing


def _format_price(value: Optional[float]) -> str:
    if value is None:
        return "Precio a consultar"
    try:
        return f"${int(value):,}".replace(",", ".")
    except (TypeError, ValueError):
        return "Precio a consultar"


def _format_rating(value: Optional[float], fallback: str = "N/D") -> str:
    if not value:
        return fallback
    try:
        return f"{float(value):.1f}"
    except (TypeError, ValueError):
        return fallback


def _normalize_schedule_day(value: Optional[int]) -> Optional[int]:
    if value is None:
        return None
    if 0 <= value <= 6:
        return value
    if 1 <= value <= 7:
        return (value - 1) % 7
    return value % 7


def _prefill_from_text(prefs: TravelPreferences, text: str) -> TravelPreferences:
    # Helper to keep compatibility; currently returns prefs unchanged.
    return prefs


CATEGORY_TERMS = {
    "hotel": ("hotel", "hoteles"),
    "restaurante": ("restaurante", "restaurantes"),
    "alojamiento": ("alojamiento", "alojamientos", "cabaña", "cabañas", "casa", "casas"),
}


def detect_rewards_scope(text: str, state: Optional[AssistantState] = None) -> tuple[Optional[str], Optional[str]]:
    normalized = _normalize_text(text)
    has_keywords = any(keyword in normalized for keyword in ("reto", "retos", "logro", "logros", "recompensa", "recompensas"))
    if not has_keywords:
        if state and state.rewards_context and ("en general" in normalized or "todos los lugares" in normalized):
            return "category", None
        return None, None

    place_tokens = (
        "esos lugares",
        "estos lugares",
        "esos hoteles",
        "estos hoteles",
        "esos restaurantes",
        "estos restaurantes",
        "esos alojamientos",
        "estos alojamientos",
    )
    if any(token in normalized for token in place_tokens):
        return "places", None

    category = _detect_category_from_text(normalized)
    if (
        "todos los lugares" in normalized
        or "en general" in normalized
        or "todos" in normalized
        or "categoria" in normalized
        or category
    ):
        return "category", category

    return None, None


def describe_rewards_for_places(places: list[RecommendedPlace], db: Session, current_user: Optional[User] = None) -> str:
    if not places:
        return "Todavía no te recomendé lugares, pedime una búsqueda primero."
    challenges = db.scalars(select(Challenge)).all()
    completed_challenge_ids = _completed_challenge_ids(db, current_user) if current_user else set()

    found_sections: list[str] = []
    for place in places:
        terms = [_normalize_text(place.name)]
        place_challenges = _filter_entries_by_terms(challenges, terms)
        place_challenges = [c for c in place_challenges if c.id not in completed_challenge_ids][:3]
        if not place_challenges:
            continue
        retos_text = "; ".join(
            f"{challenge.title} - {(challenge.description or 'Sin descripción.').strip()}"
            for challenge in place_challenges
        )
        found_sections.append(f"Para {place.name} encontré estos retos disponibles: {retos_text}.")

    if not found_sections:
        return "Por ahora no encontré retos disponibles en los lugares recomendados."

    return " ".join(found_sections)


def describe_rewards_for_category(category: str, db: Session, current_user: Optional[User] = None) -> str:
    rewards = db.scalars(select(Reward).options(joinedload(Reward.challenge))).all()
    completed_challenge_ids = _completed_challenge_ids(db, current_user) if current_user else set()
    terms = _category_terms(category)

    matched_rewards = _filter_entries_by_terms(rewards, terms)
    matched_rewards = [
        r for r in matched_rewards if not r.challenge_id or r.challenge_id not in completed_challenge_ids
    ][:3]

    label = get_category_label(category)
    if not matched_rewards:
        return f"No encontré retos específicos para la categoría {label}."

    parts: list[str] = []
    for idx, reward in enumerate(matched_rewards, start=1):
        challenge = reward.challenge
        requirement = (challenge.description or "Sin descripción de requisito").strip() if challenge else "Sin reto asociado"
        prize = (reward.description or "Sin descripción de recompensa").strip()
        parts.append(f"{idx}) {reward.title} - requiere: {requirement} - consigues: {prize}")

    return f"Para la categoría {label} encontré los siguientes retos: " + "; ".join(parts) + "."


def _filter_entries_by_terms(entries: list, terms: tuple[str, ...]) -> list:
    normalized_terms = tuple(term for term in (term.lower() for term in terms) if term)
    results = []
    for entry in entries:
        text_parts = [getattr(entry, "title", ""), getattr(entry, "description", "")]
        challenge = getattr(entry, "challenge", None)
        if challenge:
            text_parts.extend([getattr(challenge, "title", ""), getattr(challenge, "description", "")])
        text = " ".join(filter(None, text_parts))
        normalized = _normalize_text(text)
        if any(term in normalized for term in normalized_terms):
            results.append(entry)
    return results


def _format_rewards_section(
    title: str,
    challenges: list[Challenge],
    *,
    arrow: bool = False,
) -> str:
    heading = f"{title} ->" if arrow else f"{title}:"
    lines = [heading]
    lines.extend(_format_challenge_lines(challenges))
    return "\n".join(lines)


def _format_challenge_lines(challenges: list[Challenge]) -> list[str]:
    if not challenges:
        return ["  Retos: no encontré retos específicos."]
    entries = [
        f"{challenge.title} - {(challenge.description or 'Sin descripción.').strip()}"
        for challenge in challenges
    ]
    joined = "; ".join(entries) + "."
    return [f"  Retos: {joined}"]


def _completed_challenge_ids(db: Session, current_user: Optional[User]) -> set[int]:
    if not current_user:
        return set()
    rows = db.execute(
        select(UserChallenge.challenge_id)
        .where(UserChallenge.user_id == current_user.id)
        .where(UserChallenge.is_completed.is_(True))
    ).all()
    return {row[0] for row in rows}


def _category_terms(category: Optional[str]) -> tuple[str, ...]:
    if not category:
        return ()
    key = get_category_label(category).lower()
    return CATEGORY_TERMS.get(key, (key,))


def _normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _detect_category_from_text(normalized_text: str) -> Optional[str]:
    for category, terms in CATEGORY_TERMS.items():
        if any(term in normalized_text for term in terms):
            return category
    return None


def _is_new_recommendation_request(text: str) -> bool:
    normalized = _normalize_text(text)
    triggers = (
        "que otros lugares",
        "que otro lugar",
        "otros lugares",
        "otro lugar",
        "otra categoria",
        "otros destinos",
        "algo diferente",
    )
    return any(trigger in normalized for trigger in triggers)

@app.get("/api/featured", response_model=List[PlaceSummary])
def get_featured_places(db: Session = Depends(get_session)):

    stmt = (
        select(Place)
        .options(joinedload(Place.photos))
        .order_by(Place.rating_avg.desc())
        .limit(10)
    )

    places = db.scalars(stmt).unique().all()

    results = []
    for place in places:
        from services.place_service import get_place_badges

        photos = [photo.url for photo in place.photos]
        badges = get_place_badges(db, place.id)

        results.append(
            {
                "id": place.id,
                "name": place.name,
                "city_state": place.city_state,
                "country": place.country,
                "description_short": _shorten(place.description or ""),
                "rating_avg": float(place.rating_avg or 0),
                "category": place.category,
                "photos": photos[:3],
                "price_per_night": (
                    float(place.price_per_night)
                    if place.price_per_night is not None
                    else None
                ),
                "owner_id": place.owner_id,
                "badges": badges,
            }
        )
    return results

@app.get("/api/search", response_model=List[PlaceSummary])
def search(
    q: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    min_price: Optional[float] = Query(default=None, ge=0),
    max_price: Optional[float] = Query(default=None, ge=0),
    check_in: Optional[date] = Query(default=None),
    check_out: Optional[date] = Query(default=None),
    guests: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_session),
):
    stmt = (
        select(Place)
        .options(
            joinedload(Place.photos),
            joinedload(Place.bookings),
            joinedload(Place.unavailabilities),
            # ELIMINADO: joinedload(Place.availabilities), ← ESTA LÍNEA FUE ELIMINADA
        )
        .order_by(Place.rating_avg.desc(), Place.name.asc())
    )
    if q:
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(
            Place.name.ilike(pattern) | 
            Place.city_state_filter.ilike(pattern) |
            Place.country_filter.ilike(pattern)
        )
    if category:
        stmt = stmt.where(func.lower(Place.category) == category.lower())
    if min_price is not None:
        stmt = stmt.where(Place.price_per_night >= min_price)
    if max_price is not None:
        stmt = stmt.where(Place.price_per_night <= max_price)
    if guests is not None:
        stmt = stmt.where(Place.capacity >= guests)

    places = db.scalars(stmt).unique().all()

    # Filter out places that are unavailable during the requested dates
    if check_in and check_out:
        available_places = []
        for place in places:
            is_available = True

            # Check for bookings that conflict with requested dates
            for booking in place.bookings:
                if (
                    check_in < booking.check_out_date
                    and check_out > booking.check_in_date
                ):
                    is_available = False
                    break

            # Check if there are any unavailability periods that conflict
            if is_available:
                for unavailability in place.unavailabilities:
                    if (
                        check_in < unavailability.end_date
                        and check_out > unavailability.start_date
                    ):
                        is_available = False
                        break

            if is_available:
                available_places.append(place)

        places = available_places
    
    results = []
    for place in places:
        from services.place_service import get_place_badges

        photos = [photo.url for photo in place.photos]
        badges = get_place_badges(db, place.id)

        # SIMPLEMENTE DEJAR availability COMO LISTA VACÍA
        # Ya que no tenemos datos de availabilities en el modelo
        next_availability = []

        results.append(
            {
                "id": place.id,
                "name": place.name,
                "city_state": place.city_state,
                "country": place.country,
                "description_short": _shorten(place.description or ""),
                "rating_avg": float(place.rating_avg or 0),
                "category": place.category,
                "price_per_night": (
                    float(place.price_per_night)
                    if place.price_per_night is not None
                    else None
                ),
                "availability": next_availability,  # Lista vacía
                "photos": photos[:3],
                "badges": badges,
            }
        )
    return results

@app.get("/api/categories", response_model=List[str])
def get_unique_categories(db: Session = Depends(get_session)):
    """Recupera una lista de todas las categorías únicas de la base de datos."""

    stmt = select(distinct(Place.category)).where(Place.category != None)
    categories = db.execute(stmt).scalars().all()
    return [c for c in categories if c is not None]

@app.get("/api/places/{place_id}", response_model=PlaceDetail)
def get_place(place_id: int, db: Session = Depends(get_session)):
    stmt = (
        select(Place)
        .where(Place.id == place_id)
        .options(
            joinedload(Place.photos),
            joinedload(Place.unavailabilities),
            joinedload(Place.schedules),
        )
    )
    place = db.scalar(stmt)
    if not place:
        raise HTTPException(status_code=404, detail="Place not found")

    return {
        "id": place.id,
        "name": place.name,
        "city_state": place.city_state,
        "country": place.country,
        "category": place.category,
        "description": place.description,
        "rating_avg": float(place.rating_avg or 0),
        "capacity": place.capacity,
        "price_per_night": float(place.price_per_night) if place.price_per_night is not None else None,
        "unavailabilities": [
            Unavailability(start=unavailability.start_date, end=unavailability.end_date)
            for unavailability in place.unavailabilities
        ],
        "schedules": [
            Schedule(
                day_of_week=schedule.day_of_week,
                opening_time=schedule.opening_time.strftime("%H:%M") if schedule.opening_time else None,
                closing_time=schedule.closing_time.strftime("%H:%M") if schedule.closing_time else None,
                is_closed=schedule.is_closed
            )
            for schedule in place.schedules
        ],
        "photos": [photo.url for photo in place.photos],
        "owner_id": place.owner_id,
        "latitude": place.latitude,
        "longitude": place.longitude,
        "street": place.street,
        "street_number": place.street_number,
    }

@app.get("/api/places/{place_id}/reviews", response_model=List[Review])
def get_reviews(
    place_id: int,
    start_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(default=None, description="YYYY-MM-DD"),
    min_rating: Optional[int] = Query(
        default=None, ge=1, le=5, description="Filtra por calificación mínima (1-5 estrellas)"
    ),
    sort: str = Query(default="desc", description="asc or desc"),
    sort_by: str = Query(
        default="date", description="date (default), usefulness o rating"
    ),
    db: Session = Depends(get_session),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if sort not in ("asc", "desc"):
        raise HTTPException(status_code=400, detail="sort must be 'asc' or 'desc'")
    if sort_by not in {"date", "usefulness", "rating"}:
        raise HTTPException(
            status_code=400, detail="sort_by must be 'date', 'usefulness' or 'rating'"
        )

    votes_subquery = (
        select(
            ReviewVote.review_id.label("review_id"),
            func.sum(
                case((ReviewVote.is_helpful.is_(True), 1), else_=0)
            ).label("helpful_votes"),
            func.sum(
                case((ReviewVote.is_helpful.is_(False), 1), else_=0)
            ).label("not_helpful_votes"),
        )
        .group_by(ReviewVote.review_id)
        .subquery()
    )

    helpful_col = func.coalesce(votes_subquery.c.helpful_votes, 0)
    not_helpful_col = func.coalesce(votes_subquery.c.not_helpful_votes, 0)
    usefulness_score = helpful_col - not_helpful_col

    stmt = (
        select(
            ReviewModel,
            votes_subquery.c.helpful_votes.label("helpful_votes"),
            votes_subquery.c.not_helpful_votes.label("not_helpful_votes"),
        )
        .outerjoin(votes_subquery, votes_subquery.c.review_id == ReviewModel.id)
        .where(ReviewModel.place_id == place_id)
        .options(joinedload(ReviewModel.photos))
        .options(joinedload(ReviewModel.user))
        .options(joinedload(ReviewModel.place).joinedload(Place.photos))
    )

    if min_rating is not None:
        stmt = stmt.where(ReviewModel.rating >= min_rating)

    from datetime import datetime, time

    if start_date:
        try:
            sd = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400, detail="start_date must be YYYY-MM-DD"
            )
        stmt = stmt.where(ReviewModel.created_at >= sd)
    if end_date:
        try:
            ed = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=400, detail="end_date must be YYYY-MM-DD"
            )
        ed_end = datetime.combine(ed.date(), time(23, 59, 59))
        stmt = stmt.where(ReviewModel.created_at <= ed_end)

    effective_sort_by = sort_by
    if sort_by == "date" and min_rating is not None:
        effective_sort_by = "rating"

    if effective_sort_by == "usefulness":
        order_column = usefulness_score
    elif effective_sort_by == "rating":
        order_column = ReviewModel.rating
    else:
        order_column = ReviewModel.created_at

    order_clause = order_column.desc() if sort == "desc" else order_column.asc()
    order_by_expressions = [order_clause]

    if effective_sort_by == "usefulness":
        secondary_order = (
            ReviewModel.created_at.desc()
            if sort == "desc"
            else ReviewModel.created_at.asc()
        )
        order_by_expressions.append(secondary_order)

    stmt = stmt.order_by(*order_by_expressions)

    result = db.execute(stmt).unique().all()
    if not result:
        return []

    review_ids = [review.id for review, _, _ in result]
    user_votes: dict[int, str] = {}
    if current_user and review_ids:
        votes_stmt = (
            select(ReviewVote.review_id, ReviewVote.is_helpful)
            .where(ReviewVote.user_id == current_user.id)
            .where(ReviewVote.review_id.in_(review_ids))
        )
        vote_rows = db.execute(votes_stmt).all()
        user_votes = {
            row.review_id: "helpful" if row.is_helpful else "not_helpful"
            for row in vote_rows
        }

    response: list[dict[str, object]] = []
    for review, helpful_votes_raw, not_helpful_raw in result:
        helpful_votes = int(helpful_votes_raw or 0)
        not_helpful_votes = int(not_helpful_raw or 0)
        place = review.place
        response.append(
            {
                "id": review.id,
                "place_id": review.place_id,
                "rating": review.rating,
                "title": review.title,
                "comment": review.comment,
                "photos": [photo.url for photo in review.photos],
                "author_name": review.author_name,
                "author_photo_url": (
                    review.user.photo_url if review.user else DEFAULT_AVATAR_URL
                ),
                "author_id": review.user_id,
                "place_name": review.place.name if review.place else None,
                "place_rating_avg": (
                    float(place.rating_avg) if place and place.rating_avg is not None else None
                ),
                "place_photo_url": (
                    review.place.photos[0].url
                    if review.place and review.place.photos
                    else None
                ),
                "created_at": review.created_at.isoformat(),
                "helpful_votes": helpful_votes,
                "not_helpful_votes": not_helpful_votes,
                "user_vote": user_votes.get(review.id),


                "reply_text": review.reply_text,
                "reply_created_at": (
                    review.reply_created_at.isoformat()
                    if review.reply_created_at
                    else None
                ),
                "reply_updated_at": (
                    review.reply_updated_at.isoformat()
                    if review.reply_updated_at
                    else None
                ),
            }
        )
    return response


@app.post("/api/reviews/{review_id}/reply")
def create_review_reply(
    review_id: int,
    payload: dict,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Create a reply to a review. Only the owner of the place may reply."""
    stmt = (
        select(ReviewModel)
        .where(ReviewModel.id == review_id)
        .options(joinedload(ReviewModel.place))
    )
    review = db.scalar(stmt)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    # Verify ownership
    if not review.place or review.place.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    reply_text = payload.get("reply_text")
    if not reply_text or not isinstance(reply_text, str):
        raise HTTPException(status_code=400, detail="reply_text is required")

    now = datetime.now()
    review.reply_text = reply_text
    review.reply_created_at = now
    review.reply_updated_at = now
    db.add(review)
    db.commit()
    db.refresh(review)
    check_and_update_user_challenges(current_user.id, db)

    return {
        "id": review.id,
        "reply_text": review.reply_text,
        "reply_created_at": (
            review.reply_created_at.isoformat()
            if review.reply_created_at
            else None
        ),
        "reply_updated_at": (
            review.reply_updated_at.isoformat()
            if review.reply_updated_at
            else None
        ),
    }


@app.put("/api/reviews/{review_id}/reply")
def update_review_reply(
    review_id: int,
    payload: dict,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Update an existing reply. Only the owner of the place may update."""
    stmt = (
        select(ReviewModel)
        .where(ReviewModel.id == review_id)
        .options(joinedload(ReviewModel.place))
    )
    review = db.scalar(stmt)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if not review.place or review.place.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    reply_text = payload.get("reply_text")
    if reply_text is None or not isinstance(reply_text, str):
        raise HTTPException(status_code=400, detail="reply_text is required")

    review.reply_text = reply_text
    review.reply_updated_at = datetime.now()
    db.add(review)
    db.commit()
    db.refresh(review)
    check_and_update_user_challenges(current_user.id, db)

    return {
        "id": review.id,
        "reply_text": review.reply_text,
        "reply_created_at": (
            review.reply_created_at.isoformat()
            if review.reply_created_at
            else None
        ),
        "reply_updated_at": (
            review.reply_updated_at.isoformat()
            if review.reply_updated_at
            else None
        ),
    }


@app.delete("/api/reviews/{review_id}/reply", status_code=204)
def delete_review_reply(
    review_id: int,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    """Delete an existing reply. Only the owner of the place may delete."""
    stmt = (
        select(ReviewModel)
        .where(ReviewModel.id == review_id)
        .options(joinedload(ReviewModel.place))
    )
    review = db.scalar(stmt)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    if not review.place or review.place.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not allowed")

    review.reply_text = None
    review.reply_created_at = None
    review.reply_updated_at = None
    db.add(review)
    db.commit()
    check_and_update_user_challenges(current_user.id, db)
    return


@app.get("/api/users/{username}", response_model=UserProfile)
def get_user_profile(username: str, db: Session = Depends(get_session)):
    stmt = (
        select(User)
        .where(User.username == username)
        .options(
            joinedload(User.achievements).joinedload(
                UserAchievement.achievement
            ),
            joinedload(User.reviews)
            .joinedload(ReviewModel.place)
            .joinedload(Place.photos),
            joinedload(User.reviews).joinedload(ReviewModel.votes),
        )
    )
    user = db.scalar(stmt)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return build_user_profile(user, db)
