import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import {
  buildApiUrl,
  createReview,
  CreateReviewPayload,
  fetchJson,
} from "../lib/api";
import { useDialog } from "../contexts/DialogContext";

type PlaceOption = {
  id: number;
  name: string;
  city_state?: string | null;
  country?: string | null;
};

export default function CreateReview() {
  const navigate = useNavigate();
  const { alert: showAlert } = useDialog();
  const [searchParams] = useSearchParams();
  const preselectedPlaceId = searchParams.get("placeId");
  
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [placeId, setPlaceId] = useState<number | "">(preselectedPlaceId ? Number(preselectedPlaceId) : "");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPlaces(true);
    fetchJson<PlaceOption[]>(buildApiUrl("/api/search"))
      .then(data => {
        if (!cancelled) {
          setPlaces(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("No pudimos cargar la lista de lugares. Intentá recargar la página.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPlaces(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const placeOptions = useMemo(
    () =>
      places.map(place => ({
        value: place.id,
        label: [place.name, place.city_state, place.country]
          .filter(Boolean)
          .join(" · "),
      })),
    [places]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!placeId) {
      setError("Seleccioná un lugar para tu reseña.");
      return;
    }

    if (!title.trim() || !comment.trim()) {
      setError("Completá el título y el texto de tu reseña.");
      return;
    }

    const payload: CreateReviewPayload = {
      place_id: Number(placeId),
      rating,
      title: title.trim(),
      comment: comment.trim(),
    };

    setSubmitting(true);
    setError(null);

    try {
      const created = await createReview(payload);
      // If there are photos, upload them to the review photos endpoint
      if (newPhotos.length > 0) {
        const formData = new FormData();
        newPhotos.forEach(p => formData.append("photos", p));

        const uploadResponse = await fetch(buildApiUrl(`/api/reviews/${created.id}/photos`), {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const text = await uploadResponse.text();
          console.warn("Error subiendo fotos de reseña:", text);
        }
      }
      const placeName =
        places.find(p => p.id === Number(placeId))?.name ||
        placeOptions.find(opt => opt.value === Number(placeId))?.label ||
        "el establecimiento";
      await showAlert(`Tu reseña sobre ${placeName} fue publicada✅`);
      navigate(`/places/${placeId}`, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo publicar la reseña en este momento.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container page">
      <header>
        <h1>Escribir una reseña</h1>
        <p className="muted">
          Contanos cómo fue tu experiencia. Tu opinión ayuda a otros viajeros a decidir mejor.
        </p>
      </header>

      <form className="review-form" onSubmit={handleSubmit}>
        {!preselectedPlaceId && (
          <label className="form-field">
            <span>¿Sobre qué lugar querés escribir?</span>
            <select
              value={placeId}
              onChange={event => setPlaceId(event.target.value ? Number(event.target.value) : "")}
              disabled={loadingPlaces || submitting}
              required
            >
              <option value="">Seleccioná un lugar</option>
              {placeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {preselectedPlaceId && (
          <div className="form-field">
            <span style={{ fontWeight: "500", color: "#333" }}>Reseña para:</span>
            <div style={{ 
              marginTop: 8, 
              padding: "12px 16px", 
              backgroundColor: "#f0f9ff", 
              border: "2px solid #00eb5b", 
              borderRadius: "8px",
              fontWeight: "500",
              color: "#002b11"
            }}>
              {placeOptions.find(opt => opt.value === Number(preselectedPlaceId))?.label || "Cargando..."}
            </div>
          </div>
        )}

        <label className="form-field">
          <span>¿Cuántas estrellas le darías?</span>
          <div className="rating-selector">
            {[1, 2, 3, 4, 5].map(value => (
              <label key={value} className={`rating-pill ${rating === value ? "active" : ""}`}>
                <input
                  type="radio"
                  name="rating"
                  value={value}
                  checked={rating === value}
                  onChange={() => setRating(value)}
                  disabled={submitting}
                />
                <span>{value} ★</span>
              </label>
            ))}
          </div>
        </label>

        <label className="form-field">
          <span>Título de tu reseña</span>
          <input
            type="text"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Ej: Una estadía inolvidable"
            maxLength={255}
            disabled={submitting}
            required
          />
        </label>

        <label className="form-field">
          <span>Contanos más detalles</span>
          <textarea
            value={comment}
            onChange={event => setComment(event.target.value)}
            rows={6}
            placeholder="Compartí qué fue lo que más te gustó o lo que creés que puede mejorar."
            disabled={submitting}
            required
          />
        </label>

        <label className="form-field">
          <span>Fotos (opcional)</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (!e.target.files) return;
              const files = Array.from(e.target.files);
              setNewPhotos(prev => [...prev, ...files]);
              files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (ev) => {
                  setNewPhotoPreviews(prev => [...prev, ev.target?.result as string]);
                };
                reader.readAsDataURL(file);
              });
            }}
            disabled={submitting}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {newPhotoPreviews.map((src, i) => (
              <div key={i} style={{ width: 120, height: 80, overflow: 'hidden', borderRadius: 6, position: 'relative' }}>
                <img src={src} alt={`preview-${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  type="button"
                  onClick={() => {
                    // remove the corresponding file and preview by index
                    setNewPhotos(prev => prev.filter((_, idx) => idx !== i));
                    setNewPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
                  }}
                  style={{ position: 'absolute', top: 6, right: 6, background: '#fff', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </label>

        {error ? <div className="notice error">{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" disabled={submitting || loadingPlaces}>
            {submitting ? "Publicando..." : "Publicar reseña"}
          </Button>
        </div>
      </form>
    </div>
  );
}
