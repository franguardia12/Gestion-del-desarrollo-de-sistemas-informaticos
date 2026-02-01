import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ReviewList } from "../../components/ReviewList";
import type { PlaceReview as Review, ReviewVoteAction } from "../../lib/api";
import { buildApiUrl, fetchJson, voteReview } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { useDialog } from "../../contexts/DialogContext";
import { Button } from "../../components/Button";
import { DayPicker, DateRange } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/style.css";
import "./PlaceDetail.css";

type Unavailability = { start: string; end: string };
type Schedule = {
  day_of_week: number; // 0=Monday, 6=Sunday
  opening_time: string | null;
  closing_time: string | null;
  is_closed: boolean;
};
type PlaceDetail = {
  id: number;
  name: string;
  city_state?: string;
  country?: string;
  category?: string;
  description?: string;
  rating_avg: number;
  capacity?: number;
  price_per_night?: number;
  unavailabilities: Unavailability[];
  schedules: Schedule[];
  photos: string[];
  owner_id: number;
  // 👇 NUEVOS CAMPOS PARA EL MAPA
  latitude?: number;
  longitude?: number;
  street?: string;
  street_number?: string;
};

type ReviewSortOption = "date_desc" | "date_asc" | "usefulness_desc" | "usefulness_asc";

export default function PlaceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { alert: showAlert } = useDialog();
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(today.getDate() + 7);
    return { from: today, to: sevenDaysLater };
  });
    // Fecha/rango para filtrar reseñas (separado del selector de reserva)
    const [reviewStart, setReviewStart] = useState<string | undefined>();
      const [reviewEnd, setReviewEnd] = useState<string | undefined>();
      const [reviewSortOption, setReviewSortOption] = useState<ReviewSortOption>("date_desc");
  const [editUnavailabilities, setEditUnavailabilities] = useState<Unavailability[]>([]);
  const [editSelectedRange, setEditSelectedRange] = useState<DateRange | undefined>();
  const [editSchedules, setEditSchedules] = useState<Schedule[]>([]);
  const [hasSchedules, setHasSchedules] = useState(false);
  // Aseguramos comparación numérica por si alguna vez viene como string
  const isOwner = !!(place && user && Number(place.owner_id) === Number(user.id));
  const [minRating, setMinRating] = useState<number | null>(null);
  const [votingReviewId, setVotingReviewId] = useState<number | null>(null);
  //const isOwner = !!(place && user && place.owner_id === user.id);

  // Estados para gestión de fotos
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<number[]>([]);

  function getReviewSortParams(option: ReviewSortOption) {
    const direction = option.endsWith("asc") ? "asc" : "desc";
    const field = option.startsWith("usefulness") ? "usefulness" : "date";
    return { direction, field };
  }

    useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError(null);

        const placeUrl = buildApiUrl(`/api/places/${id}`);
        // Build reviews URL and include date range filters when present
        const reviewsParams: Record<string, string> = {};
        if (reviewStart) {
            reviewsParams.start_date = reviewStart;
        }
        if (reviewEnd) {
            reviewsParams.end_date = reviewEnd;
        }
        if (minRating) { // Si el valor no es null/0
        reviewsParams.min_rating = String(minRating); // Lo convertimos a string para el URLSearchParams
        }
        const { direction: sortDirection, field: sortField } = getReviewSortParams(reviewSortOption);
        reviewsParams.sort = sortDirection;
        if (sortField !== "date") {
            reviewsParams.sort_by = sortField;
        }
        const reviewsUrl = buildApiUrl(`/api/places/${id}/reviews`, reviewsParams);

        Promise.all([
          fetchJson<PlaceDetail>(placeUrl),
          fetchJson<Review[]>(reviewsUrl, { credentials: "include" }),
        ])
      .then(([placeResponse, reviewsResponse]) => {
        setPlace(placeResponse);
        setReviews(reviewsResponse);
      })
      
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "No pudimos cargar la información del lugar.";
        setError(message);
        setPlace(null);
        setReviews([]);
      })
      .finally(() => setIsLoading(false));
    }, [id, reviewStart, reviewEnd, reviewSortOption, minRating]);

    // Expose a refresh function so child components can ask to reload reviews
  const fetchReviews = async () => {
    if (!id) return;
    try {
      const reviewsParams: Record<string, string> = {};
      if (reviewStart) reviewsParams.start_date = reviewStart;
      if (reviewEnd) reviewsParams.end_date = reviewEnd;
      if (minRating) reviewsParams.min_rating = String(minRating);
      const { direction: sortDirection, field: sortField } = getReviewSortParams(reviewSortOption);
      reviewsParams.sort = sortDirection;
      if (sortField !== "date") reviewsParams.sort_by = sortField;
      const reviewsUrl = buildApiUrl(`/api/places/${id}/reviews`, reviewsParams);
      const reviewsResponse = await fetchJson<Review[]>(reviewsUrl);
      setReviews(reviewsResponse);
    } catch (err) {
      console.error(err);
    }
  };

// Lógica de Edición y Guardado
const handleSave = async (e: React.FormEvent) => {
  e.preventDefault(); // Evita recargar el formulario

  if (!place || !id) return;

  const updatedData = {
    name: place.name,
    description: place.description,
    country: place.country || undefined,
    city_state: place.city_state || undefined,
    street: place.street || undefined,
    street_number: place.street_number || undefined,
    category: place.category || undefined,
    capacity: place.capacity || undefined,
    price_per_night: place.price_per_night ?? undefined,
    unavailabilities: editUnavailabilities.map(u => ({
      start_date: u.start,
      end_date: u.end
    })),
    schedules: editSchedules, // Send empty array to clear schedules
  };

  const placeUrl = buildApiUrl(`/api/places/${id}`);

  setIsSaving(true);
  setError(null);

  try {
    // 1. Guardar cambios básicos del lugar
    await fetchJson<PlaceDetail>(placeUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updatedData),
    });

    // 2. Eliminar fotos marcadas para eliminación
    for (const photoId of photosToDelete) {
      try {
        await fetch(buildApiUrl(`/api/places/${id}/photos/${photoId}`), {
          method: "DELETE",
          credentials: "include",
        });
      } catch (err) {
        console.warn(`No se pudo eliminar la foto ${photoId}:`, err);
      }
    }

    // 3. Subir nuevas fotos
    if (newPhotos.length > 0) {
      const formData = new FormData();
      newPhotos.forEach(photo => {
        formData.append("photos", photo);
      });

      try {
        await fetch(buildApiUrl(`/api/places/${id}/photos`), {
          method: "POST",
          credentials: "include",
          body: formData,
        });
      } catch (err) {
        console.warn("No se pudieron subir algunas fotos:", err);
      }
    }

    // 4. Recargar los datos del lugar desde el servidor
    const freshPlaceData = await fetchJson<PlaceDetail>(placeUrl, {
      credentials: "include",
    });

    setPlace(freshPlaceData);
    await showAlert("✅ ¡Cambios guardados con éxito!");
    setIsEditing(false);
    setNewPhotos([]);
    setNewPhotoPreviews([]);
    setPhotosToDelete([]);

  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Error desconocido al guardar los cambios.";
    setError(`Error al guardar: ${message}`);
    setIsEditing(true); // Mantiene el modo edición si falla
  } finally {
    setIsSaving(false);
  }
};

// Fin de la función handleSave

  async function handleReviewVote(reviewId: number, intent: "helpful" | "not_helpful") {
    if (!user) {
      await showAlert("Necesitás iniciar sesión para votar reseñas.");
      return;
    }

    const targetReview = reviews.find(r => r.id === reviewId);
    if (!targetReview) {
      return;
    }
    if (targetReview.author_id === user.id) {
      return;
    }

    const action: ReviewVoteAction = targetReview.user_vote === intent ? "clear" : intent;

    setVotingReviewId(reviewId);
    try {
      const updatedVote = await voteReview(reviewId, action);
      setReviews(prev =>
        prev.map(review =>
          review.id === reviewId
            ? {
                ...review,
                helpful_votes: updatedVote.helpful_votes,
                not_helpful_votes: updatedVote.not_helpful_votes,
                user_vote: updatedVote.user_vote ?? null,
              }
            : review
        )
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo registrar tu voto.";
      await showAlert(message);
    } finally {
      setVotingReviewId(null);
    }
  }

  // Función para obtener las fechas deshabilitadas del calendario
  const getDisabledDates = () => {
    if (!place?.unavailabilities) return [];

    const disabledDates: Date[] = [];

    place.unavailabilities.forEach((unavail) => {
      const start = new Date(unavail.start + 'T00:00:00');
      const end = new Date(unavail.end + 'T00:00:00');

      // Agregar todas las fechas del rango (inclusive end date)
      const current = new Date(start);
      while (current <= end) {
        disabledDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    });

    return disabledDates;
  };

  // Función para validar que el rango seleccionado no contenga fechas no disponibles
  const validateDateRange = (range: DateRange | undefined): boolean => {
    if (!range?.from || !range?.to || !place?.unavailabilities) return true;

    const selectedStart = new Date(range.from);
    const selectedEnd = new Date(range.to);

    // Verificar si alguna fecha no disponible se superpone con el rango seleccionado
    for (const unavail of place.unavailabilities) {
      const unavailStart = new Date(unavail.start);
      const unavailEnd = new Date(unavail.end);

      // Verificar superposición: el rango no disponible se solapa con el rango seleccionado
      if (
        (unavailStart >= selectedStart && unavailStart <= selectedEnd) ||
        (unavailEnd >= selectedStart && unavailEnd <= selectedEnd) ||
        (unavailStart <= selectedStart && unavailEnd >= selectedEnd)
      ) {
        return false;
      }
    }

    return true;
  };

  // Handler para validar la selección de fechas
  const handleDateSelect = (range: DateRange | undefined) => {
    setSelectedRange(range);

    // Si el rango está completo, validar
    if (range?.from && range?.to) {
      if (!validateDateRange(range)) {
        void showAlert("El rango seleccionado contiene fechas no disponibles. Por favor, seleccioná un período diferente.");
        setSelectedRange(undefined);
      }
    }
  };

  // Handlers para el modo de edición de unavailabilities
  const handleAddUnavailability = () => {
    if (editSelectedRange?.from && editSelectedRange?.to) {
      const newUnavailability: Unavailability = {
        start: format(editSelectedRange.from, "yyyy-MM-dd"),
        end: format(editSelectedRange.to, "yyyy-MM-dd"),
      };
      setEditUnavailabilities(prev => [...prev, newUnavailability]);
      setEditSelectedRange(undefined);
    }
  };

  const removeUnavailability = (index: number) => {
    setEditUnavailabilities(prev => prev.filter((_, i) => i !== index));
  };

  // Schedule editing handlers
  const handleScheduleChange = (dayOfWeek: number, field: keyof Schedule, value: string | boolean) => {
    setEditSchedules(prev => {
      const existingIndex = prev.findIndex(s => s.day_of_week === dayOfWeek);

      if (existingIndex >= 0) {
        // Update existing schedule
        return prev.map((schedule, i) =>
          i === existingIndex ? { ...schedule, [field]: value } : schedule
        );
      } else {
        // Create new schedule if it doesn't exist
        const newSchedule: Schedule = {
          day_of_week: dayOfWeek,
          opening_time: field === "opening_time" ? value as string : "09:00",
          closing_time: field === "closing_time" ? value as string : "17:00",
          is_closed: field === "is_closed" ? value as boolean : false,
        };
        return [...prev, newSchedule].sort((a, b) => a.day_of_week - b.day_of_week);
      }
    });
  };

  const getScheduleForDay = (dayOfWeek: number): Schedule | undefined => {
    return editSchedules.find(s => s.day_of_week === dayOfWeek);
  };

  const handleEditClick = () => {
    setIsEditing(true);
    // Inicializar unavailabilities y schedules para edición
    setEditUnavailabilities(place?.unavailabilities || []);
    setEditSchedules(place?.schedules || []);
    setHasSchedules(!!(place?.schedules && place.schedules.length > 0));
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditUnavailabilities([]);
    setEditSchedules([]);
    setEditSelectedRange(undefined);
    setHasSchedules(false);
    setNewPhotos([]);
    setNewPhotoPreviews([]);
    setPhotosToDelete([]);
  };

  // Handlers para fotos
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setNewPhotos(prev => [...prev, ...files]);

      // Crear previews
      files.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setNewPhotoPreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveNewPhoto = (index: number) => {
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
    setNewPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkPhotoForDeletion = (photoUrl: string) => {
    // Extraer el photo_id de la URL
    const match = photoUrl.match(/\/photos\/(\d+)/);
    if (match) {
      const photoId = parseInt(match[1]);
      setPhotosToDelete(prev => [...prev, photoId]);
    }
  };

  const handleUnmarkPhotoForDeletion = (photoUrl: string) => {
    const match = photoUrl.match(/\/photos\/(\d+)/);
    if (match) {
      const photoId = parseInt(match[1]);
      setPhotosToDelete(prev => prev.filter(id => id !== photoId));
    }
  };

  const isPhotoMarkedForDeletion = (photoUrl: string): boolean => {
    const match = photoUrl.match(/\/photos\/(\d+)/);
    if (match) {
      const photoId = parseInt(match[1]);
      return photosToDelete.includes(photoId);
    }
    return false;
  };

  if (!id) {
    return <div className="container page">No se encontró el lugar solicitado.</div>;
  }

  if (error) {
    return <div className="container page"><div className="notice error">{error}</div></div>;
  }

  if (isLoading && !place) {
    return (
      <div className="container page">
        <div className="skeleton-detail">
          <div className="skeleton-line long" />
          <div className="skeleton-line" />
          <div className="skeleton-image large" />
        </div>
      </div>
    );
  }

  if (!place) {
    return <div className="container page">No pudimos encontrar este lugar.</div>;
  }



return (
    <div className="container page">
        <Link to="/" className="link back-link">
            &lt; Volver a la búsqueda
        </Link>

        {error && <div className="notice error">{error}</div>}

        <form onSubmit={handleSave} style={{ display: "grid", gap: 16 }}>
            <div className="detail-header-content">
                {isEditing ? (
                    <>
                      <input
                          type="text"
                          value={place.name}
                          onChange={(e) => setPlace(p => p ? { ...p, name: e.target.value } : null)}
                          style={{ fontSize: "2rem", fontWeight: "bold", width: "100%", marginBottom: "16px" }}
                          required
                      />

                      {/* Campos adicionales en modo edición */}
                      <div style={{ display: "grid", gap: "16px", marginBottom: "16px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                          <div>
                            <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                              Categoría
                            </label>
                            <select
                              value={place.category || ""}
                              onChange={(e) => setPlace(p => p ? { ...p, category: e.target.value } : null)}
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                border: "2px solid #e0e0e0",
                                borderRadius: "8px",
                                fontSize: "14px"
                              }}
                            >
                              <option value="">Seleccionar categoría</option>
                              <option value="hotel">Hotel</option>
                              <option value="restaurante">Restaurante</option>
                              <option value="alojamiento">Alojamiento</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                              Capacidad (huéspedes)
                            </label>
                            <input
                              type="number"
                              value={place.capacity || ""}
                              onChange={(e) => setPlace(p => p ? { ...p, capacity: e.target.value ? Number(e.target.value) : undefined } : null)}
                              min="1"
                              placeholder="Ej: 4"
                              style={{
                                width: "100%",
                                padding: "8px 12px",
                                border: "2px solid #e0e0e0",
                                borderRadius: "8px",
                                fontSize: "14px"
                              }}
                            />
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                            Precio por noche
                          </label>
                          <input
                            type="number"
                            value={place.price_per_night ?? ""}
                            onChange={(e) => setPlace(p => p ? { ...p, price_per_night: e.target.value ? parseFloat(e.target.value) : undefined } : null)}
                            min="0"
                            step="0.01"
                            placeholder="Ej: 75.00"
                            style={{
                              width: "100%",
                              padding: "8px 12px",
                              border: "2px solid #e0e0e0",
                              borderRadius: "8px",
                              fontSize: "14px",
                              maxWidth: "200px"
                            }}
                          />
                        </div>
                      </div>
                    </>
                ) : (
                    <>
                      <h1>{place.name}</h1>
                      {place.category && (
                        <div style={{marginTop: '8px'}}>
                          <strong>Categoría:</strong> {place.category.charAt(0).toUpperCase() + place.category.slice(1)}
                        </div>
                      )}
                    </>
                )}

        <div className="place-meta">
          <small>{[place.city_state, place.country].filter(Boolean).join(", ")}</small>
                    <span className="badge">⭐ {place.rating_avg.toFixed(1)}</span>
                    {place.category ? <small className="badge-category">{place.category.charAt(0).toUpperCase() + place.category.slice(1)}</small> : null}
                    {place.capacity ? <small>{place.capacity} huéspedes</small> : null}
                    {place.price_per_night != null ? <small>${place.price_per_night} / noche</small> : null}
                </div>

                {isOwner && !isEditing && (
                    <Button
                        type="button"
                        onClick={handleEditClick}
                        variant="secondary"
                        style={{ width: "fit-content", justifySelf: "flex-start", marginTop: '8px' }}
                    >
                        Editar Establecimiento
                    </Button>
                )}

                {isOwner && isEditing && (
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={isSaving}
                            style={{ width: "fit-content" }}
                        >
                            {isSaving ? "Guardando..." : "Guardar Cambios"}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCancelEdit}
                            variant="secondary"
                            style={{ width: "fit-content" }}
                        >
                            Cancelar
                        </Button>
                    </div>
                )}
            </div>

            <div className="detail-gallery">
                {/* Fotos existentes */}
                {(place.photos?.length ? place.photos : ["https://picsum.photos/800/400"]).map((src, i) => (
                    <div key={i} style={{ position: "relative" }}>
                        <img
                            src={src}
                            alt={`${place.name} foto ${i + 1}`}
                            className="detail-photo"
                            style={{
                                opacity: isEditing && isPhotoMarkedForDeletion(src) ? 0.5 : 1,
                                filter: isEditing && isPhotoMarkedForDeletion(src) ? "grayscale(100%)" : "none",
                            }}
                        />
                        {isEditing && isOwner && src.includes("/api/places/") && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (isPhotoMarkedForDeletion(src)) {
                                        handleUnmarkPhotoForDeletion(src);
                                    } else {
                                        handleMarkPhotoForDeletion(src);
                                    }
                                }}
                                style={{
                                    position: "absolute",
                                    top: "8px",
                                    right: "8px",
                                    background: isPhotoMarkedForDeletion(src) ? "#4CAF50" : "#f44336",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "50%",
                                    width: "32px",
                                    height: "32px",
                                    fontSize: "18px",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                }}
                            >
                                {isPhotoMarkedForDeletion(src) ? "↶" : "×"}
                            </button>
                        )}
                    </div>
                ))}

                {/* Previews de nuevas fotos */}
                {isEditing && newPhotoPreviews.map((preview, i) => (
                    <div key={`new-${i}`} style={{ position: "relative" }}>
                        <img
                            src={preview}
                            alt={`Nueva foto ${i + 1}`}
                            className="detail-photo"
                            style={{ border: "3px solid #00eb5b" }}
                        />
                        <button
                            type="button"
                            onClick={() => handleRemoveNewPhoto(i)}
                            style={{
                                position: "absolute",
                                top: "8px",
                                right: "8px",
                                background: "#f44336",
                                color: "white",
                                border: "none",
                                borderRadius: "50%",
                                width: "32px",
                                height: "32px",
                                fontSize: "18px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                            }}
                        >
                            ×
                        </button>
                        <div
                            style={{
                                position: "absolute",
                                bottom: "8px",
                                left: "8px",
                                background: "#00eb5b",
                                color: "white",
                                padding: "4px 8px",
                                borderRadius: "4px",
                                fontSize: "12px",
                                fontWeight: "bold",
                            }}
                        >
                            NUEVA
                        </div>
                    </div>
                ))}

                {/* Botón para agregar más fotos */}
                {isEditing && isOwner && (
                    <div
                        style={{
                            border: "2px dashed #ccc",
                            borderRadius: "8px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            minHeight: "200px",
                            cursor: "pointer",
                            backgroundColor: "#f9f9f9",
                            position: "relative",
                        }}
                        onClick={() => document.getElementById("add-photos-input")?.click()}
                    >
                        <div style={{ textAlign: "center", color: "#666" }}>
                            <div style={{ fontSize: "48px", marginBottom: "8px" }}>+</div>
                            <div>Agregar fotos</div>
                        </div>
                        <input
                            type="file"
                            id="add-photos-input"
                            multiple
                            accept="image/*"
                            onChange={handlePhotoChange}
                            style={{ display: "none" }}
                        />
                    </div>
                )}
            </div>

            <div className="detail-sections-container">
            <div className="detail-left-column">
            <section className="detail-section">
                <h2>Descripción</h2>
                {isEditing ? (
                    <textarea
                        value={place.description || ''}
                        onChange={(e) => setPlace(p => p ? { ...p, description: e.target.value } : null)}
                        rows={5}
                        style={{ width: "100%", marginTop: 8, lineHeight: 1.5 }}
                        required
                    />
                ) : (
                    <p style={{ marginTop: 8, lineHeight: 1.5 }}>
                        {place.description || 'Sin descripción detallada.'}
                    </p>
                )}
            </section>

            {/* Sección del Mapa */}
                <section className="detail-section">
                <h2>Ubicación</h2>

                {isEditing ? (
                  <div style={{ marginTop: 16, display: "grid", gap: "16px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                          País
                        </label>
                        <input
                          type="text"
                          value={place.country || ""}
                          onChange={(e) => setPlace(p => p ? { ...p, country: e.target.value } : null)}
                          placeholder="Ej: Argentina"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "2px solid #e0e0e0",
                            borderRadius: "8px",
                            fontSize: "14px"
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                          Ciudad/Provincia
                        </label>
                        <input
                          type="text"
                          value={place.city_state || ""}
                          onChange={(e) => setPlace(p => p ? { ...p, city_state: e.target.value } : null)}
                          placeholder="Ej: CABA"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "2px solid #e0e0e0",
                            borderRadius: "8px",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "12px" }}>
                      <div>
                        <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                          Calle
                        </label>
                        <input
                          type="text"
                          value={place.street || ""}
                          onChange={(e) => setPlace(p => p ? { ...p, street: e.target.value } : null)}
                          placeholder="Ej: Av. Corrientes"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "2px solid #e0e0e0",
                            borderRadius: "8px",
                            fontSize: "14px"
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: "14px", fontWeight: "500", color: "#333", display: "block", marginBottom: "4px" }}>
                          Número
                        </label>
                        <input
                          type="text"
                          value={place.street_number || ""}
                          onChange={(e) => setPlace(p => p ? { ...p, street_number: e.target.value } : null)}
                          placeholder="1234"
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            border: "2px solid #e0e0e0",
                            borderRadius: "8px",
                            fontSize: "14px"
                          }}
                        />
                      </div>
                    </div>

                    <p style={{ fontSize: "13px", color: "#666", marginTop: "8px" }}>
                      💡 Nota: Los cambios en la ubicación se reflejarán después de guardar.
                    </p>
                  </div>
                ) : (
                  <>
                    {place.latitude && place.longitude ? (
                    <div style={{
                    marginTop: 16,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0'
                    }}>
                    {/* Mapa estático de LocationIQ */}
                    <img
                        src={`https://maps.locationiq.com/v3/staticmap?key=${import.meta.env.VITE_LOCATIONIQ_API_KEY}&center=${place.latitude},${place.longitude}&zoom=15&size=800x300&format=png&markers=icon:small-red-cutlet|${place.latitude},${place.longitude}`}
                        alt={`Ubicación de ${place.name}`}
                        style={{
                        width: '100%',
                        height: '300px',
                        objectFit: 'cover'
                        }}
                        onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                            const errorDiv = document.createElement('div');
                            errorDiv.innerHTML = `
                            <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa;">
                                <p>⚠️ No se pudo cargar el mapa</p>
                                <a
                                href="https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=15/${place.latitude}/${place.longitude}"
                                target="_blank"
                                rel="noopener noreferrer"
                                style="color: #007bff; text-decoration: none; font-size: 14px;"
                                >
                                Ver en OpenStreetMap
                                </a>
                            </div>
                            `;
                            parent.appendChild(errorDiv);
                        }
                        }}
                    />

                    {/* Información de dirección debajo del mapa */}
                    <div style={{
                        padding: '16px 20px',
                        backgroundColor: '#f8f9fa',
                        borderTop: '1px solid #e0e0e0'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <span style={{
                            fontSize: '18px',
                            color: '#333',
                            lineHeight: '1.2'
                        }}>📍</span>
                        <div>
                            <p style={{
                            margin: '0 0 4px 0',
                            fontWeight: '500',
                            color: '#333'
                            }}>
                            {[place.street, place.street_number].filter(Boolean).join(' ')}
                            </p>
                            <p style={{
                            margin: '0',
                            fontSize: '14px',
                            color: '#666'
                            }}>
                            {[place.city_state, place.country].filter(Boolean).join(', ')}
                            </p>
                        </div>
                        </div>
                    </div>
                    </div>
                ) : (
                    <div style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '12px',
                    marginTop: '16px'
                    }}>
                    <p style={{
                        margin: '0 0 8px 0',
                        color: '#666',
                        fontSize: '16px'
                    }}>
                        🗺️ Ubicación no disponible
                    </p>
                    <p style={{
                        margin: '0',
                        color: '#999',
                        fontSize: '14px'
                    }}>
                        No hay información de ubicación para este establecimiento
                    </p>
                    </div>
                )}
                  </>
                )}
                </section>

            {/* Schedule section */}
            {isEditing && isOwner ? (
                <section className="detail-section">
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", fontSize: "14px", fontWeight: "500" }}>
                        <input
                            type="checkbox"
                            checked={hasSchedules}
                            onChange={(e) => {
                                setHasSchedules(e.target.checked);
                                if (!e.target.checked) {
                                    setEditSchedules([]);
                                } else {
                                    // Initialize all days with default schedules (open 09:00-17:00)
                                    const daysOfWeek = [
                                        { value: 0, label: "Lunes" },
                                        { value: 1, label: "Martes" },
                                        { value: 2, label: "Miércoles" },
                                        { value: 3, label: "Jueves" },
                                        { value: 4, label: "Viernes" },
                                        { value: 5, label: "Sábado" },
                                        { value: 6, label: "Domingo" },
                                    ];
                                    setEditSchedules(daysOfWeek.map(day => ({
                                        day_of_week: day.value,
                                        opening_time: "09:00",
                                        closing_time: "17:00",
                                        is_closed: false
                                    })));
                                }
                            }}
                            style={{ cursor: "pointer" }}
                        />
                        Este establecimiento tiene horarios de apertura
                    </label>

                    {hasSchedules && (
                        <>
                            <p className="muted" style={{ marginTop: 8, marginBottom: 16 }}>
                                Define los horarios de apertura y cierre para cada día de la semana
                            </p>
                        </>
                    )}

                    {hasSchedules && (
                        <div style={{
                            border: "2px solid #e0e0e0",
                            borderRadius: "12px",
                            padding: "20px",
                            backgroundColor: "#fafafa"
                        }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {(() => {
                                    const daysOfWeek = [
                                        { value: 0, label: "Lunes" },
                                        { value: 1, label: "Martes" },
                                        { value: 2, label: "Miércoles" },
                                        { value: 3, label: "Jueves" },
                                        { value: 4, label: "Viernes" },
                                        { value: 5, label: "Sábado" },
                                        { value: 6, label: "Domingo" },
                                    ];

                                    return daysOfWeek.map(day => {
                                        const schedule = getScheduleForDay(day.value);

                                        return (
                                            <div
                                                key={day.value}
                                                style={{
                                                    display: "flex",
                                                    gap: "16px",
                                                    alignItems: "center",
                                                    padding: "12px 16px",
                                                    backgroundColor: "#fff",
                                                    border: "1px solid #e0e0e0",
                                                    borderRadius: "8px"
                                                }}
                                            >
                                                <span style={{ fontSize: "14px", fontWeight: "500", color: "#333", minWidth: "90px" }}>
                                                    {day.label}
                                                </span>

                                                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", minWidth: "90px" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={schedule?.is_closed || false}
                                                        onChange={(e) => handleScheduleChange(day.value, "is_closed", e.target.checked)}
                                                        style={{ cursor: "pointer" }}
                                                    />
                                                    Cerrado
                                                </label>

                                                {!schedule?.is_closed && (
                                                    <>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                            <label style={{ fontSize: "13px", color: "#666" }}>Abre:</label>
                                                            <select
                                                                value={schedule?.opening_time || ""}
                                                                onChange={(e) => handleScheduleChange(day.value, "opening_time", e.target.value)}
                                                                style={{
                                                                    padding: "6px 10px",
                                                                    border: "1px solid #e0e0e0",
                                                                    borderRadius: "6px",
                                                                    fontSize: "13px"
                                                                }}
                                                            >
                                                                {Array.from({ length: 24 }, (_, hour) =>
                                                                    ["00", "30"].map(minute => {
                                                                        const time = `${String(hour).padStart(2, "0")}:${minute}`;
                                                                        return (
                                                                            <option key={time} value={time}>
                                                                                {time}
                                                                            </option>
                                                                        );
                                                                    })
                                                                ).flat()}
                                                            </select>
                                                        </div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                            <label style={{ fontSize: "13px", color: "#666" }}>Cierra:</label>
                                                            <select
                                                                value={schedule?.closing_time || ""}
                                                                onChange={(e) => handleScheduleChange(day.value, "closing_time", e.target.value)}
                                                                style={{
                                                                    padding: "6px 10px",
                                                                    border: "1px solid #e0e0e0",
                                                                    borderRadius: "6px",
                                                                    fontSize: "13px"
                                                                }}
                                                            >
                                                                {Array.from({ length: 24 }, (_, hour) =>
                                                                    ["00", "30"].map(minute => {
                                                                        const time = `${String(hour).padStart(2, "0")}:${minute}`;
                                                                        return (
                                                                            <option key={time} value={time}>
                                                                                {time}
                                                                            </option>
                                                                        );
                                                                    })
                                                                ).flat()}
                                                            </select>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    )}
                </section>
            ) : (
                place.schedules && place.schedules.length > 0 && (
                    <section className="detail-section">
                        <h2>Horarios</h2>
                        <div style={{
                            marginTop: 16,
                            border: "1px solid #e0e0e0",
                            borderRadius: "12px",
                            overflow: "hidden",
                            backgroundColor: "#fff",
                            maxWidth: "100%"
                        }}>
                            {(() => {
                                const daysOfWeek = [
                                    { value: 0, label: "Lunes" },
                                    { value: 1, label: "Martes" },
                                    { value: 2, label: "Miércoles" },
                                    { value: 3, label: "Jueves" },
                                    { value: 4, label: "Viernes" },
                                    { value: 5, label: "Sábado" },
                                    { value: 6, label: "Domingo" },
                                ];

                                return daysOfWeek.map((day, index) => {
                                    const schedule = place.schedules.find(s => s.day_of_week === day.value);

                                    return (
                                        <div
                                            key={day.value}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "14px 20px",
                                                borderBottom: index < daysOfWeek.length - 1 ? "1px solid #e0e0e0" : "none"
                                            }}
                                        >
                                            <span style={{ fontWeight: "400", fontSize: "15px", color: "#1a1a1a" }}>
                                                {day.label}
                                            </span>
                                            <span style={{ fontSize: "15px", color: schedule?.is_closed ? "#666" : "#1a1a1a" }}>
                                                {schedule ? (
                                                    schedule.is_closed ? (
                                                        "Cerrado"
                                                    ) : (
                                                        `Del ${schedule.opening_time?.substring(0, 5)} al ${schedule.closing_time?.substring(0, 5)}`
                                                    )
                                                ) : (
                                                    <span style={{ color: "#999", fontStyle: "italic" }}>No especificado</span>
                                                )}
                                            </span>
                                        </div>
                                    );
                                });
                            })()}
                        </div>
                    </section>
                )
            )}
            </div>

            <div className="detail-right-sidebar">
            <section className="detail-section calendar-section">
                {isEditing && isOwner ? (
                    <>
                        <h2>Fechas no disponibles (opcional)</h2>
                        <p className="muted" style={{ marginTop: 8, marginBottom: 16 }}>
                            Selecciona períodos en los que el establecimiento no estará disponible para reservas (mantenimiento, uso personal, etc.)
                        </p>

                        <div className="calendar-container" style={{
                            border: "2px solid #e0e0e0",
                            borderRadius: "12px",
                            padding: "20px",
                            backgroundColor: "#fafafa",
                            margin: "0 auto"
                        }}>
                            <DayPicker
                                mode="range"
                                selected={editSelectedRange}
                                onSelect={setEditSelectedRange}
                                disabled={{ before: new Date() }}
                            />
                        </div>

                        <div className="calendar-container" style={{
                            marginTop: "16px",
                            padding: "20px",
                            backgroundColor: "#f0f9f4",
                            border: "2px solid #00a56b",
                            borderRadius: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            margin: "16px auto 0"
                        }}>
                            {editSelectedRange?.from && editSelectedRange?.to ? (
                                <>
                                    <p style={{ margin: 0, color: "#333", fontSize: "14px" }}>
                                        <strong>Período seleccionado:</strong><br />
                                        <span style={{ fontSize: "13px" }}>
                                            {format(editSelectedRange.from, "dd/MM/yyyy")} - {format(editSelectedRange.to, "dd/MM/yyyy")}
                                        </span>
                                    </p>
                                    <Button
                                        type="button"
                                        onClick={handleAddUnavailability}
                                        variant="primary"
                                        style={{ padding: "10px 16px", fontSize: "14px" }}
                                    >
                                        Agregar período
                                    </Button>
                                </>
                            ) : (
                                <p style={{ margin: 0, color: "#666", fontSize: "14px", textAlign: "center" }}>
                                    Seleccioná un rango de fechas en el calendario para bloquear ese período.
                                </p>
                            )}
                        </div>

                        {/* Lista de períodos bloqueados */}
                        {editUnavailabilities.length > 0 && (
                            <div style={{ marginTop: "16px" }}>
                                <p style={{ fontWeight: "500", marginBottom: "12px", fontSize: "14px" }}>
                                    Períodos bloqueados ({editUnavailabilities.length}):
                                </p>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {editUnavailabilities.map((unavail, index) => (
                                        <div
                                            key={index}
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                alignItems: "center",
                                                padding: "12px 16px",
                                                backgroundColor: "#fff",
                                                border: "1px solid #e0e0e0",
                                                borderRadius: "8px"
                                            }}
                                        >
                                            <span style={{ fontSize: "14px", color: "#333" }}>
                                                📅 {new Date(unavail.start + 'T00:00:00').toLocaleDateString("es-ES", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric"
                                                })} - {new Date(unavail.end + 'T00:00:00').toLocaleDateString("es-ES", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric"
                                                })}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeUnavailability(index)}
                                                style={{
                                                    padding: "6px 12px",
                                                    backgroundColor: "#f44336",
                                                    color: "white",
                                                    border: "none",
                                                    borderRadius: "6px",
                                                    cursor: "pointer",
                                                    fontSize: "12px"
                                                }}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <h2>Seleccioná las fechas de tu estadía</h2>

                        <div className="calendar-container" style={{
                            border: "2px solid #e0e0e0",
                            borderRadius: "12px",
                            padding: "20px",
                            backgroundColor: "#fafafa",
                            margin: "0 auto"
                        }}>
                            <DayPicker
                                mode="range"
                                selected={selectedRange}
                                onSelect={handleDateSelect}
                                disabled={[
                                    { before: new Date() },
                                    ...getDisabledDates()
                                ]}
                            />
                        </div>

                        <div className="calendar-container" style={{
                            marginTop: "16px",
                            padding: "15px",
                            backgroundColor: "#f0f9f4",
                            border: "2px solid #00a56b",
                            borderRadius: "12px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            margin: "16px auto 0"
                        }}>
                            {selectedRange?.from && selectedRange?.to ? (
                                <>
                                    <p style={{ margin: 0, color: "#333", fontSize: "14px" }}>
                                        <strong>Fechas seleccionadas:</strong><br />
                                        <span style={{ fontSize: "13px" }}>
                                            {format(selectedRange.from, "dd/MM/yyyy")} - {format(selectedRange.to, "dd/MM/yyyy")}
                                        </span>
                                    </p>
                                    {place.price_per_night && (
                                        <p style={{ margin: 0, color: "#666", fontSize: "13px" }}>
                                            <strong>Precio por noche:</strong> ${place.price_per_night}
                                        </p>
                                    )}
                                    <Button
                                        type="button"
                                        onClick={() => {
                                            // TODO: Implement booking logic
                                            void showAlert(`Reservar desde ${format(selectedRange.from!, "dd/MM/yyyy")} hasta ${format(selectedRange.to!, "dd/MM/yyyy")}`);
                                        }}
                                        variant="primary"
                                        style={{ padding: "10px 16px", fontSize: "14px" }}
                                    >
                                        Reservar
                                    </Button>
                                </>
                            ) : (
                                <p style={{ margin: 0, color: "#666", fontSize: "14px", textAlign: "center" }}>
                                    Seleccioná las fechas de tu estadía en el calendario para reservar.
                                </p>
                            )}
                        </div>
                    </>
                )}
            </section>
            </div>
            </div>

<section className="detail-section">
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Reseñas ({reviews.length})</h2>

        {/* Si estamos en modo edición no mostramos los controles de filtrado de reseñas */}
        {!isEditing && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {/* FILTROS DE FECHA */}
                <label style={{ fontSize: 13, color: '#444', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Desde</span>
                    <input type="date" value={reviewStart || ''} onChange={(e) => setReviewStart(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #ddd' }} />
                </label>
                <label style={{ fontSize: 13, color: '#444', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Hasta</span>
                    <input type="date" value={reviewEnd || ''} onChange={(e) => setReviewEnd(e.target.value)} style={{ padding: 6, borderRadius: 6, border: '1px solid #ddd' }} />
                </label>

                {/* NUEVO: FILTRO POR CALIFICACIÓN MÍNIMA */}
                <label style={{ fontSize: 13, color: '#444', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Min. Calificación</span>
                    <select
                        value={minRating || ''}
                        onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : null)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid #ddd' }}
                    >
                        <option value="">Todas</option>
                        <option value="5">5 Estrellas</option>
                        <option value="4">4 Estrellas+</option>
                        <option value="3">3 Estrellas+</option>
                        <option value="2">2 Estrellas+</option>
                        <option value="1">1 Estrella+</option>
                    </select>
                </label>
                {/* FIN NUEVO FILTRO */}

                {/* BOTÓN APLICAR (ahora aplica todos los filtros/órdenes) */}
                <button
                    type="button"
                    // El onClick está vacío porque el efecto se dispara por las dependencias:
                    onClick={() => { /* El useEffect depende de reviewStart/reviewEnd/minRating/reviewSortOption */ }}
                    style={{ background: '#00eb5b', color: '#002b11', border: 'none', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}
                >
                    Aplicar filtros
                </button>

                <label style={{ fontSize: 13, color: '#444', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#666' }}>Ordenar por</span>
                    <select
                        value={reviewSortOption}
                        onChange={(e) => setReviewSortOption(e.target.value as ReviewSortOption)}
                        style={{ padding: 6, borderRadius: 6, border: '1px solid #ddd' }}
                    >
                        <option value="date_desc">⬇️ Más recientes</option>
                        <option value="date_asc">⬆️ Más antiguas</option>
                        <option value="usefulness_desc">✨ Más útiles</option>
                        <option value="usefulness_asc">⚖️ Menos útiles</option>
                    </select>
                </label>

                {/* Botón Limpiar */}
                <button
                    type="button"
                    onClick={() => { setReviewStart(undefined); setReviewEnd(undefined); setMinRating(null); setReviewSortOption('date_desc'); }}
                    style={{ background: 'none', border: '1px solid #ddd', padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}
                >
                    Limpiar filtros
                </button>
            </div>
        )}
    </div>

    {/* Botón para escribir una reseña (solo si el usuario ha iniciado sesión) */}
    {user && !isEditing && (
        <div style={{ marginTop: 16, marginBottom: 16 }}>
            <Link to={`/reviews/new?placeId=${place.id}`}>
                <Button variant="secondary">
                    ✍️ Escribir reseña sobre este lugar
                </Button>
            </Link>
        </div>
    )}

    {/* ACTUALIZAR ReviewList para pasarle las props */}
  <div style={{ marginTop: 12 }}>
    <ReviewList
      reviews={reviews}
      enableVoting
      currentUserId={user?.id ?? null}
      onVote={handleReviewVote}
      votingReviewId={votingReviewId}
      isOwner={!!isOwner}
      onRefresh={fetchReviews}
    />
  </div>
</section>
        </form>
    </div>
);

}
