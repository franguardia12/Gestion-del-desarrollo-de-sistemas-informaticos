from datetime import date, time
from pathlib import Path
from typing import Iterator, List, Optional
from urllib.parse import urlencode, urljoin

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload

from address_parser import parse_full_address
from auth import get_current_user
from constants import ALLOWED_PLACE_PHOTO_EXTENSIONS
from database import get_session
from geocoding import locationiq_client
from models import Place, PlacePhoto, PlaceSchedule, PlaceUnavailability
from services.place_photo_storage import delete_place_photo, open_place_photo, save_place_photo
from services.challenge_service import check_and_update_user_challenges

router = APIRouter(prefix="/api/places", tags=["places"])

# Hardcoded categories
PLACE_CATEGORIES = ["hotel", "restaurante", "alojamiento"]


@router.get("/categories", response_model=List[str])
def get_categories():
    """Returns the list of available place categories."""
    return PLACE_CATEGORIES


def _validate_place_photo_extension(upload: UploadFile) -> None:
    suffix = Path(upload.filename or "").suffix.lower()
    if suffix not in ALLOWED_PLACE_PHOTO_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_PLACE_PHOTO_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato de imagen no soportado. Extensiones permitidas: {allowed}",
        )


def _store_place_photo(upload: UploadFile, place_id: int, sort_order: int) -> str:
    _validate_place_photo_extension(upload)
    filename = upload.filename or f"place_{place_id}_photo_{sort_order}"
    return save_place_photo(upload.file, filename, upload.content_type)


def _build_place_photo_url(request: Request, place_id: int, photo_id: int, file_id: str) -> str:
    relative_path = f"api/places/{place_id}/photos/{photo_id}"
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


class UnavailabilityInput(BaseModel):
    start_date: date
    end_date: date


class ScheduleInput(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    opening_time: Optional[time] = None
    closing_time: Optional[time] = None
    is_closed: bool = False

    @field_validator('day_of_week')
    @classmethod
    def validate_day_of_week(cls, v):
        if v < 0 or v > 6:
            raise ValueError('day_of_week must be between 0 (Monday) and 6 (Sunday)')
        return v

    @field_validator('closing_time')
    @classmethod
    def validate_closing_time(cls, v, info):
        opening_time = info.data.get('opening_time')
        is_closed = info.data.get('is_closed', False)

        # If not closed, both times must be provided
        # Note: We allow closing_time <= opening_time to support places that close past midnight
        # (e.g., opening at 20:00 and closing at 02:00 the next day)
        if not is_closed:
            if opening_time is None or v is None:
                raise ValueError('opening_time and closing_time are required when is_closed is False')

        return v


class PlaceCreate(BaseModel):
    name: str
    country: Optional[str] = None
    city_state: Optional[str] = None
    street: Optional[str] = None
    street_number: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    price_per_night: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    unavailabilities: Optional[List[UnavailabilityInput]] = None
    schedules: Optional[List[ScheduleInput]] = None
    # Nuevo campo para la dirección completa
    full_address: Optional[str] = None

class PlaceUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    city_state: Optional[str] = None
    street: Optional[str] = None
    street_number: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    capacity: Optional[int] = None
    price_per_night: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    unavailabilities: Optional[List[UnavailabilityInput]] = None
    schedules: Optional[List[ScheduleInput]] = None
    full_address: Optional[str] = None


@router.post("/", status_code=201)
def create_place(
    data: PlaceCreate,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    try:
        # 1️⃣ Verificar que sea un owner
        if not current_user.is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo los usuarios propietarios pueden publicar establecimientos",
            )

        # 2️⃣ Parsear la dirección completa si está disponible
        filter_fields = {}
        if data.full_address:
            parsed_address = parse_full_address(data.full_address)
            filter_fields = {
                'country_filter': parsed_address.get('country_filter'),
                'city_state_filter': parsed_address.get('city_state_filter'),
                'street_filter': parsed_address.get('street_filter')
            }

        # 3️⃣ Crear la instancia del lugar
        place = Place(
            name=data.name,
            country=data.country,
            city_state=data.city_state,
            street=data.street,
            street_number=data.street_number,
            latitude=data.latitude,
            longitude=data.longitude,
            category=data.category,
            description=data.description,
            capacity=data.capacity,
            price_per_night=data.price_per_night,
            rating_avg=0.0,
            owner_id=current_user.id,
            **filter_fields  # Agregar los campos de filtro
        )

        db.add(place)
        db.commit()
        db.refresh(place)

        # 3️⃣ Crear unavailabilities si se proporcionaron
        if data.unavailabilities:
            for unavail in data.unavailabilities:
                # Validar que end_date > start_date
                if unavail.end_date <= unavail.start_date:
                    db.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La fecha de fin debe ser posterior a la fecha de inicio"
                    )

                place_unavailability = PlaceUnavailability(
                    place_id=place.id,
                    start_date=unavail.start_date,
                    end_date=unavail.end_date
                )
                db.add(place_unavailability)

            db.commit()

        # 4️⃣ Crear schedules si se proporcionaron
        if data.schedules:
            for schedule in data.schedules:
                place_schedule = PlaceSchedule(
                    place_id=place.id,
                    day_of_week=schedule.day_of_week,
                    opening_time=schedule.opening_time,
                    closing_time=schedule.closing_time,
                    is_closed=schedule.is_closed
                )
                db.add(place_schedule)

            db.commit()

        # Update challenge 4 (publish_first_place) for the owner
        check_and_update_user_challenges(current_user.id, db)

        return {
            "id": place.id,
            "name": place.name,
            "owner_id": place.owner_id,
            "message": "Establecimiento creado exitosamente",
            "filter_fields": filter_fields  # Para debug
        }

    except Exception as e:
        db.rollback()
        print(f"Error creando place: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )




@router.post("/{place_id}/photos", status_code=201)
def upload_place_photos(
    place_id: int,
    request: Request,
    photos: List[UploadFile] = File(...),
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    # Verificar permisos
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los usuarios propietarios pueden subir fotos",
        )

    # Verificar que el lugar existe y pertenece al usuario
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lugar no encontrado")

    if place.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para subir fotos a este lugar",
        )

    try:
        # Obtener el sort_order inicial (basado en cuántas fotos ya existen)
        existing_photos_count = len(place.photos)
        photo_responses = []

        for i, photo in enumerate(photos):
            sort_order = existing_photos_count + i

            # Validar y almacenar la foto en GridFS
            file_id = _store_place_photo(photo, place_id, sort_order)

            # Crear registro en la base de datos (sin guardar aún)
            place_photo = PlacePhoto(
                place_id=place_id,
                url="",  # URL temporal, la actualizaremos después
                photo_file_id=file_id,
                sort_order=sort_order,
            )
            db.add(place_photo)
            db.flush()  # Obtener el ID sin hacer commit

            # Construir la URL con el photo_id
            photo_url = _build_place_photo_url(request, place_id, place_photo.id, file_id)
            place_photo.url = photo_url

            photo_responses.append(
                {"id": place_photo.id, "url": photo_url, "sort_order": sort_order}
            )

        db.commit()

        return {
            "message": f"{len(photos)} fotos subidas exitosamente",
            "photos": photo_responses,
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir las fotos: {str(e)}",
        )


@router.get("/{place_id}/photos/{photo_id}")
def get_place_photo(place_id: int, photo_id: int, db: Session = Depends(get_session)):
    # Verificar que el lugar existe
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lugar no encontrado")

    # Obtener la foto
    photo = db.get(PlacePhoto, photo_id)
    if not photo or photo.place_id != place_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    if not photo.photo_file_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no disponible")

    # Abrir el stream de GridFS
    photo_stream = open_place_photo(photo.photo_file_id)
    if photo_stream is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    # Obtener el content_type de los metadatos
    metadata = photo_stream.metadata or {}
    content_type = metadata.get("contentType", "application/octet-stream")
    headers = {
        "Cache-Control": "public, max-age=86400",
        "ETag": photo.photo_file_id,
    }

    return StreamingResponse(
        _stream_file(photo_stream),
        media_type=content_type,
        headers=headers,
    )


@router.put("/{place_id}", status_code=status.HTTP_200_OK)
def update_place(
    place_id: int,
    data: PlaceUpdate,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    # 1️⃣ Verificar que el usuario sea el dueño y que el lugar exista
    place = db.get(Place, place_id)

    if not place:
        raise HTTPException(status_code=404, detail="Establecimiento no encontrado")
        
    # Verificar que el usuario logueado sea el propietario
    if place.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para editar este establecimiento"
        )

    try:
        # 2️⃣ Parsear la dirección completa si está disponible
        filter_fields = {}
        if data.full_address is not None:  # Incluye la posibilidad de cadena vacía
            parsed_address = parse_full_address(data.full_address)
            filter_fields = {
                'country_filter': parsed_address.get('country_filter'),
                'city_state_filter': parsed_address.get('city_state_filter'),
                'street_filter': parsed_address.get('street_filter')
            }

        # 3️⃣ Aplicar los cambios
        update_data = data.model_dump(exclude_unset=True, exclude={'full_address'})
        
        # Separar unavailabilities y schedules del resto de campos
        unavailabilities_data = update_data.pop('unavailabilities', None)
        schedules_data = update_data.pop('schedules', None)

        for key, value in update_data.items():
            if value is not None:
                setattr(place, key, value)
        
        # 4️⃣ Aplicar campos de filtro si se proporcionó full_address
        for key, value in filter_fields.items():
            setattr(place, key, value)

        # 5️⃣ Guardar cambios del lugar en base de datos
        db.add(place)
        db.commit()

        # 4️⃣ Actualizar unavailabilities si se proporcionaron
        if unavailabilities_data is not None:
            # Eliminar las unavailabilities existentes
            db.query(PlaceUnavailability).filter(
                PlaceUnavailability.place_id == place_id
            ).delete()

            # Crear las nuevas unavailabilities
            for unavail in unavailabilities_data:
                # Validar que end_date > start_date
                if unavail['end_date'] <= unavail['start_date']:
                    db.rollback()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="La fecha de fin debe ser posterior a la fecha de inicio"
                    )

                place_unavailability = PlaceUnavailability(
                    place_id=place_id,
                    start_date=unavail['start_date'],
                    end_date=unavail['end_date']
                )
                db.add(place_unavailability)

            db.commit()

        # 5️⃣ Actualizar schedules si se proporcionaron
        if schedules_data is not None:
            # Eliminar los schedules existentes
            db.query(PlaceSchedule).filter(
                PlaceSchedule.place_id == place_id
            ).delete()

            # Crear los nuevos schedules
            for schedule in schedules_data:
                place_schedule = PlaceSchedule(
                    place_id=place_id,
                    day_of_week=schedule['day_of_week'],
                    opening_time=schedule.get('opening_time'),
                    closing_time=schedule.get('closing_time'),
                    is_closed=schedule.get('is_closed', False)
                )
                db.add(place_schedule)

            db.commit()

        db.refresh(place)

        # 6️⃣ Devolver el recurso actualizado (para que el Frontend se actualice)
        return place 

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error interno del servidor al actualizar el establecimiento"
        )


@router.delete("/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_place(
    place_id: int,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
) -> Response:
    place = (
        db.query(Place)
        .options(joinedload(Place.photos))
        .filter(Place.id == place_id)
        .one_or_none()
    )
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lugar no encontrado")
    if place.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar este lugar",
        )

    try:
        for photo in place.photos:
            if photo.photo_file_id:
                delete_place_photo(photo.photo_file_id)
        db.delete(place)
        db.commit()
        check_and_update_user_challenges(current_user.id, db)
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar el establecimiento",
        )


@router.delete("/{place_id}/photos/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    place_id: int,
    photo_id: int,
    db: Session = Depends(get_session),
    current_user=Depends(get_current_user),
):
    # Verificar que el lugar existe
    place = db.get(Place, place_id)
    if not place:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lugar no encontrado")

    # Verificar que el usuario es el propietario
    if place.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permiso para eliminar fotos de este lugar",
        )

    # Obtener la foto
    photo = db.get(PlacePhoto, photo_id)
    if not photo or photo.place_id != place_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Foto no encontrada")

    try:
        # Eliminar el archivo de GridFS si existe
        if photo.photo_file_id:
            delete_place_photo(photo.photo_file_id)

        # Eliminar el registro de la base de datos
        db.delete(photo)
        db.commit()

        return None

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al eliminar la foto: {str(e)}",
        )
