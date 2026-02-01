import { ReactNode } from "react";
import { Link } from "react-router-dom";
import "./PlaceCard.css";

export type PlaceSummary = {
  id: number;
  name: string;
  city?: string;
  country?: string;
  category?: string;
  description_short?: string;
  rating_avg: number;
  price_per_night?: number;
  availability: {
    start: string;
    end: string;
  }[];
  photos: string[];
  badges?: string[];  // Badge icons: e.g., ["popular", "new"]
};

type PlaceCardProps = {
  place: PlaceSummary;
  actions?: ReactNode;
};

export function PlaceCard({ place, actions }: PlaceCardProps) {
  const cover = place.photos[0] ?? "https://picsum.photos/600/400";
  const location = [place.city, place.country].filter(Boolean).join(", ");

  // Badge configuration based on type
  const getBadgeConfig = (badgeIcon: string) => {
    switch (badgeIcon) {
      case 'popular':
        return { icon: '✅', label: 'Popular', color: '#10b981' };
      case 'new':
        return { icon: '🏠', label: 'Nuevo', color: '#f59e0b' };
      default:
        return { icon: '⭐', label: badgeIcon, color: '#00eb5b' };
    }
  };

  return (
    <Link to={`/places/${place.id}`} className="card-link">
      <article className={`card${actions ? " has-actions" : ""}`}>
        {actions ? <div className="card-actions">{actions}</div> : null}
        <img src={cover} alt={place.name} />

        {/* Badge de rating */}
        <span className="badge rating-pin">⭐ {place.rating_avg.toFixed(1)}</span>

        {/* Badge de precio */}
        {place.price_per_night && (
          <span
            className="badge price-badge"
            style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              background: '#00eb5b',
              color: '#002b11',
              fontWeight: 'bold',
              padding: '4px 8px',
              borderRadius: '999px',
              fontSize: '12px',
              zIndex: 10
            }}
          >
            ${place.price_per_night}/noche
          </span>
        )}

        {/* Place badges (Popular, Nuevo, etc.) - Below price or at top left */}
        {place.badges && place.badges.length > 0 && (
          <div style={{
            position: 'absolute',
            top: place.price_per_night ? '42px' : '10px', // Below price chip if it exists
            left: '10px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            zIndex: 10
          }}>
            {place.badges.map((badgeIcon, index) => {
              const config = getBadgeConfig(badgeIcon);
              return (
                <span
                  key={index}
                  className="badge place-badge"
                  style={{
                    background: config.color,
                    color: 'white',
                    fontWeight: '600',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>{config.icon}</span>
                  <span>{config.label}</span>
                </span>
              );
            })}
          </div>
        )}

        <div className="info">
          <h2>{place.name}</h2>

          {/* Categoría - NUEVO */}
          {place.category && (
            <small style={{
              color: '#666',
              fontStyle: 'italic',
              display: 'block',
              marginBottom: '4px'
            }}>
              {place.category.charAt(0).toUpperCase() + place.category.slice(1)}
            </small>
          )}

          {location ? <small> 📍 {location}</small> : null}

          <p style={{ marginTop: 8 }}>
            {place.description_short || "Sin descripción disponible por ahora."}
          </p>

          {/* Disponibilidad - NUEVO */}
          {place.availability && place.availability.length > 0 && (
            <div style={{
              marginTop: '8px',
              fontSize: '12px',
              background: '#f5f5f5',
              padding: '6px',
              borderRadius: '6px'
            }}>
              <strong>📅 Próxima disponibilidad:</strong><br/>
              {new Date(place.availability[0].start).toLocaleDateString()} - {new Date(place.availability[0].end).toLocaleDateString()}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
