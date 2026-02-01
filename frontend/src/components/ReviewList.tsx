import { useState, useEffect, ReactNode } from "react";

import { PlaceReview, createReviewReply, updateReviewReply, deleteReviewReply } from "../lib/api";
import { useDialog } from "../contexts/DialogContext";


type ReviewVoteIntent = "helpful" | "not_helpful";

type ReviewListProps = {
  reviews: PlaceReview[];
  showPlaceContext?: boolean;
  enableVoting?: boolean;
  currentUserId?: number | null;
  onVote?: (reviewId: number, intent: ReviewVoteIntent) => void;
  votingReviewId?: number | null;
  isOwner?: boolean;
  onRefresh?: () => Promise<void> | void;
};

export type ReviewCardProps = {
  review: PlaceReview;
  showPlaceContext?: boolean;
  actions?: ReactNode;
  body?: ReactNode;
  footer?: ReactNode | null;
  enableVoting?: boolean;
  currentUserId?: number | null;
  onVote?: (reviewId: number, intent: ReviewVoteIntent) => void;
  votingReviewId?: number | null;
  isOwner?: boolean;
  onRefresh?: () => Promise<void> | void;
};

function renderStars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => {
    const isFilled = index < rating;
    return (
      <span key={index} aria-hidden="true" className={isFilled ? "star filled" : "star"}>
        ★
      </span>
    );
  });
}

export function ReviewCard({
  review,
  showPlaceContext = false,
  actions,
  body,
  footer,
  enableVoting = false,
  currentUserId = null,
  onVote,
  votingReviewId = null,
  isOwner = false,
  onRefresh,
}: ReviewCardProps) {
  const { alert: showAlert } = useDialog();

  // --- Estados para respuesta del propietario ---
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState(review.reply_text || "");
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [localReply, setLocalReply] = useState<string | null>(review.reply_text || null);
  const [localReplyTs, setLocalReplyTs] = useState<string | null>(
    review.reply_created_at || review.reply_updated_at || null
  );

  useEffect(() => {
    setLocalReply(review.reply_text || null);
    setLocalReplyTs(review.reply_created_at || review.reply_updated_at || null);
    setReplyText(review.reply_text || "");
  }, [review.reply_text, review.reply_created_at, review.reply_updated_at]);

  const createdAt = new Date(review.created_at);
  const formattedDate = createdAt.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  function formatReplyDate(ts: string | null | undefined) {
    if (!ts) return "";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const handleSaveReply = async () => {
    if (!replyText) return;
    setIsSavingReply(true);
    setMessage(null);
    const prevReply = localReply;
    const prevTs = localReplyTs;
    try {
      let resp;
      if (review.reply_text) {
        resp = await updateReviewReply(review.id, replyText);
      } else {
        resp = await createReviewReply(review.id, replyText);
      }
      if (resp) {
        setLocalReply(resp.reply_text || replyText);
        setLocalReplyTs(
          resp.reply_updated_at || resp.reply_created_at || new Date().toISOString()
        );
      } else {
        setLocalReply(replyText);
        setLocalReplyTs(new Date().toISOString());
      }
      setIsReplying(false);
      setMessage("Respuesta guardada");
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
      setLocalReply(prevReply);
      setLocalReplyTs(prevTs);
      setMessage("No se pudo guardar la respuesta");
    } finally {
      setIsSavingReply(false);
    }
  };

  const handleDeleteReply = async () => {
    if (!confirm("¿Eliminar respuesta?")) return;
    try {
      await deleteReviewReply(review.id);
      setReplyText("");
      setLocalReply(null);
      setLocalReplyTs(null);
      setMessage("Respuesta eliminada");
      if (onRefresh) await onRefresh();
    } catch (err) {
      console.error(err);
      setMessage("No se pudo eliminar la respuesta");
    }
  };

  // --- Votaciones ---
  const helpfulCount = review.helpful_votes ?? 0;
  const notHelpfulCount = review.not_helpful_votes ?? 0;
  const helpfulActive = review.user_vote === "helpful";
  const notHelpfulActive = review.user_vote === "not_helpful";
  const isVoting = votingReviewId === review.id;
  const isLoggedIn = typeof currentUserId === "number";
  const isOwnReview =
    isLoggedIn && typeof review.author_id === "number" && review.author_id === currentUserId;

  async function handleVote(intent: ReviewVoteIntent) {
    if (!enableVoting) return;
    if (!isLoggedIn) {
      await showAlert("Necesitás iniciar sesión para votar las reseñas.");
      return;
    }
    if (isOwnReview) return;
    onVote?.(review.id, intent);
  }

  // --- Cuerpo principal ---
  const defaultBody = (
    <>
      <div className="review-card-rating" aria-label={`Puntuación ${review.rating} de 5 estrellas`}>
        {renderStars(review.rating)}
        <span className="sr-only">{review.rating} de 5</span>
      </div>
      {review.title && <h3 className="review-card-title">{review.title}</h3>}
      {review.comment && <p className="review-card-text">{review.comment}</p>}
      {review.photos && review.photos.length > 0 && (
        <div className="review-photos" aria-label="Galería de fotos de la reseña">
          {review.photos.map((src, i) => (
            <div key={i} className="review-photo">
              <img
                src={src}
                alt={`Foto ${i + 1} de la reseña sobre ${review.place_name ?? "el lugar"}`}
                className="review-photo__image"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}
    </>
  );

  const loginTitle = "Necesitás iniciar sesión para votar las reseñas.";
  const ownReviewTitle = "No podés votar tu propia reseña.";
  const helpfulTitle = !enableVoting
    ? undefined
    : !isLoggedIn
    ? loginTitle
    : isOwnReview
    ? ownReviewTitle
    : "Marcar como útil";
  const notHelpfulTitle = !enableVoting
    ? undefined
    : !isLoggedIn
    ? loginTitle
    : isOwnReview
    ? ownReviewTitle
    : "Marcar como no útil";

  const defaultFooter = enableVoting ? (
    <>
      <button
        type="button"
        className={`review-card-action review-card-vote-button ${helpfulActive ? "active" : ""}`}
        aria-pressed={helpfulActive}
        onClick={() => handleVote("helpful")}
        disabled={isVoting || isOwnReview || !onVote}
        title={helpfulTitle}
      >
        👍 <span>Útil</span> <strong>{helpfulCount}</strong>
      </button>
      <button
        type="button"
        className={`review-card-action review-card-vote-button ${
          notHelpfulActive ? "active" : ""
        }`}
        aria-pressed={notHelpfulActive}
        onClick={() => handleVote("not_helpful")}
        disabled={isVoting || isOwnReview || !onVote}
        title={notHelpfulTitle}
      >
        👎 <span>No útil</span> <strong>{notHelpfulCount}</strong>
      </button>
    </>
  ) : (
    <>
      <div className="review-card-action">
        👍 <span>Útil</span> <strong>{helpfulCount}</strong>
      </div>
      <div className="review-card-action">
        👎 <span>No útil</span> <strong>{notHelpfulCount}</strong>
      </div>
    </>
  );

  return (
    <article className="review-card">
      <header className="review-card-header">
        <div className="review-card-header-info">
          <img
            src={review.author_photo_url}
            alt={`Foto de ${review.author_name}`}
            className="review-card-avatar"
            loading="lazy"
          />
          <div>
            <p className="review-card-author">
              <strong>{review.author_name}</strong> escribió una opinión
            </p>
            <small className="review-card-date">{formattedDate}</small>
          </div>
        </div>
        {actions && <div className="review-card-actions">{actions}</div>}
      </header>

      <div className="review-card-body">{body ?? defaultBody}</div>

      {/* Respuesta del propietario */}
      {localReply ? (
        <div className="review-card-reply">
          <strong>Respuesta del propietario</strong>
          <p>{localReply}</p>
          <small className="muted">
            {formatReplyDate(localReplyTs || review.reply_created_at || review.reply_updated_at)}
          </small>
        </div>
      ) : null}

      {/* Controles del propietario */}
      {isOwner && (
        <div style={{ marginTop: 8 }}>
          {isReplying ? (
            <div>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
                placeholder="Escribí la respuesta aquí..."
                disabled={isSavingReply}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveReply}
                  disabled={isSavingReply || replyText.trim().length === 0}
                >
                  {isSavingReply ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsReplying(false);
                    setReplyText(localReply || "");
                    setMessage(null);
                  }}
                  disabled={isSavingReply}
                >
                  Cancelar
                </button>
                {localReply && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteReply}
                    disabled={isSavingReply}
                  >
                    Eliminar
                  </button>
                )}
              </div>
              {message && (
                <div
                  style={{ marginTop: 8 }}
                  className={
                    message.startsWith("No") ? "notice error" : "notice success"
                  }
                >
                  {message}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setIsReplying(true);
                  setMessage(null);
                  setReplyText(localReply || "");
                }}
              >
                {localReply ? "Editar respuesta" : "Responder"}
              </button>
            </div>
          )}
        </div>
      )}

      {showPlaceContext && review.place_name ? (
        <div className="review-card-place">
          {review.place_photo_url ? (
            <img
              src={review.place_photo_url}
              alt={`Foto de ${review.place_name}`}
              className="review-card-place-photo"
              loading="lazy"
            />
          ) : (
            <div className="review-card-place-photo placeholder" aria-hidden="true">
              📍
            </div>
          )}
          <div className="review-card-place-info">
            <span className="review-card-place-label">Reseña sobre</span>
            <strong className="review-card-place-name">{review.place_name}</strong>
            {typeof review.place_rating_avg === "number" && (
              <span className="review-card-place-rating">
                ⭐ {review.place_rating_avg.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {footer !== null && (
        <footer className="review-card-footer">{footer ?? defaultFooter}</footer>
      )}
    </article>
  );
}

export function ReviewList({
  reviews,
  showPlaceContext = false,
  enableVoting = false,
  currentUserId = null,
  onVote,
  votingReviewId = null,
  isOwner = false,
  onRefresh,
}: ReviewListProps) {
  if (reviews.length === 0) {
    return <p className="muted">Todavía no hay reseñas.</p>;
  }

  return (
    <div className="reviews">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          showPlaceContext={showPlaceContext}
          enableVoting={enableVoting}
          currentUserId={currentUserId}
          onVote={onVote}
          votingReviewId={votingReviewId}
          isOwner={isOwner}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
