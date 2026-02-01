import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import React from "react";
import { Button } from "../components/Button";
import { PlaceSummary } from "../components/PlaceCard/PlaceCard";
import { PlaceCarousel } from "../components/PlaceCarousel/PlaceCarousel";
import { ReviewCard, ReviewList } from "../components/ReviewList";
import { useAuth } from "../contexts/AuthContext";
import { useDialog } from "../contexts/DialogContext";
import {
  buildApiUrl,
  deletePlace,
  deleteReview,
  fetchUserProfile,
  fetchJson,
  PlaceReview,
  ReviewVoteAction,
  updateMyProfile,
  updateReview,
  UserAchievement,
  UserProfile as UserProfileResponse,
  voteReview,
} from "../lib/api";


type TabId = "about" | "reviews" | "places" | "beneficios";

type PlaceOption = {
  id: number;
  name: string;
  city_state?: string | null;
  country?: string | null;
};

function ProfileSkeleton() {
  return (
    <div className="container profile-page">
      <div className="profile-hero skeleton">
        <div className="profile-identity">
          <div className="profile-avatar skeleton-image large" />
          <div className="profile-heading">
            <div className="skeleton-line long" />
            <div className="skeleton-line" />
            <div className="skeleton-line" />
          </div>
        </div>
      </div>
      <div className="profile-tabs">
        <span className="skeleton-line" style={{ width: "80px" }} />
        <span className="skeleton-line" style={{ width: "120px" }} />
        <span className="skeleton-line" style={{ width: "100px" }} />
      </div>
      <div className="profile-card skeleton">
        <div className="skeleton-line long" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}

type EmptyStateProps = {
  isOwnProfile: boolean;
  onWriteReview: () => void;
  onExplore: () => void;
  onCreatePlace?: () => void;
};

function ReviewsEmptyState({ isOwnProfile, onWriteReview, onExplore, onCreatePlace }: EmptyStateProps) {
  return (
    <div className="profile-card profile-empty">
      <div className="profile-empty__badge">✨</div>
      <div className="profile-empty__content">
        <p className="profile-empty__eyebrow">
          {isOwnProfile ? "Dale vida a tu perfil" : "Sin reseñas todavía"}
        </p>
        <h3 className="profile-empty__title">
          {isOwnProfile ? "Compartí tu primera experiencia" : "Aún no hay reseñas publicadas"}
        </h3>
        <p className="profile-empty__text">
          {isOwnProfile
            ? "Contá cómo te fue en tu último viaje y ayudá a otros viajeros a decidir mejor."
            : "Cuando publique reseñas, vas a ver sus experiencias e insights acá."}
        </p>
        {isOwnProfile ? (
          <ul className="profile-empty__tasks">
            <li>✍️ Elegí un lugar y escribí tu reseña.</li>
            <li>📸 Sumá 2-3 fotos que cuenten la historia.</li>
            <li>👍 Votá reseñas de otros para ganar badges.</li>
          </ul>
        ) : null}
        <div className="profile-empty__actions">
          {isOwnProfile ? (
            <>
              <Button onClick={onWriteReview}>Escribir reseña</Button>
              <Button variant="outline" onClick={onExplore}>
                Explorar lugares
              </Button>
              {onCreatePlace ? (
                <Button variant="secondary" onClick={onCreatePlace}>
                  Publicar establecimiento
                </Button>
              ) : null}
            </>
          ) : (
            <Button variant="outline" onClick={onExplore}>
              Ver lugares destacados
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// 🆕 INTERFAZ ACTUALIZADA con información del Challenge
interface RewardType {
    id: number;
    title: string;
    description: string;
    image_url?: string | null;
    // Reward type classification
    reward_type: 'discount' | 'user_badge' | 'place_badge';
    badge_icon?: string | null;
    badge_display_name?: string | null;
    // Challenge progress
    challenge_title: string;
    challenge_description: string;
    challenge_target: number;
    current_progress: number;
    progress_percentage: number;
    is_completed: boolean;      // Challenge completed
    // Reward status
    is_claimable: boolean;      // Can claim reward (completed but not claimed)
    is_claimed: boolean;        // Reward has been claimed
    is_used: boolean;           // Reward has been used/redeemed
}

// Nueva interfaz que incluye la función de recarga
interface ChallengeItemProps {
    reward: RewardType;
    onClaimSuccess?: () => void;
}

// 🆕 COMPONENTE ACTUALIZADO con estilos del modal
const ChallengeItem: React.FC<ChallengeItemProps> = ({ reward, onClaimSuccess }) => {
    const { user: authUser } = useAuth();
    const currentUserId = authUser ? authUser.id : 0;

    const [isClaiming, setIsClaiming] = useState(false);
    const [showPlaceSelector, setShowPlaceSelector] = useState(false);
    const [userPlaces, setUserPlaces] = useState<any[]>([]);

    const handleClaim = async (placeId?: number) => {
        if (reward.is_used || !reward.is_claimable || isClaiming) return;

        // For place_badge rewards, we need a place_id
        if (reward.reward_type === 'place_badge') {
            if (!placeId) {
                // Show place selector modal
                // First, fetch user's places
                try {
                    const placesResponse = await fetch(buildApiUrl(`/api/users/${currentUserId}/places`), {
                        credentials: 'include'
                    });
                    if (placesResponse.ok) {
                        const places = await placesResponse.json();
                        setUserPlaces(places);
                        setShowPlaceSelector(true);
                        return;
                    } else {
                        alert('Error al cargar tus lugares. Intenta de nuevo.');
                        return;
                    }
                } catch (error) {
                    alert('Error al cargar tus lugares. Intenta de nuevo.');
                    return;
                }
            }
        }

        setIsClaiming(true);

        try {
            const response = await fetch(
                buildApiUrl(`/api/rewards/${reward.id}/claim`),
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ place_id: placeId || null })
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Fallo al reclamar (Status: ${response.status})`);


            }

            onClaimSuccess?.();
            setShowPlaceSelector(false);
            alert(`✅ ¡Recompensa '${reward.title}' canjeada con éxito!`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Error de conexión o desconocido.';

            console.error("Error al reclamar:", error);
            alert(`❌ Error al reclamar: ${errorMessage}`);
        } finally {
            setIsClaiming(false);
        }
    };


    

    // 🆕 DETERMINAR ESTADO Y ESTILOS
    const getCardStyles = () => {
        if (reward.is_claimable && !reward.is_used) {
            return {
                borderLeft: '4px solid #00eb5b',
                background: 'linear-gradient(135deg, #f0fff4 0%, #e6fffa 100%)',
                icon: '🎁',
                status: 'available'
            };
        } else if (reward.is_used) {
            return {
                borderLeft: '4px solid #10b981',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                icon: '✅',
                status: 'completed'
            };
        } else if (reward.is_claimed) {
            // Claimed but not used - show as completed/claimed
            return {
                borderLeft: '4px solid #10b981',
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                icon: '🎁',
                status: 'completed'
            };
        } else if (reward.current_progress > 0) {
            return {
                borderLeft: '4px solid #f59e0b',
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                icon: '🚧',
                status: 'in-progress'
            };
        } else {
            return {
                borderLeft: '4px solid #9ca3af',
                background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)',
                icon: '🔒',
                status: 'locked'
            };
        }
    };

    const styles = getCardStyles();

    return (
        <div className={`reward-card ${styles.status}`} style={{
            display: 'flex',
            gap: '15px',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '15px',
            borderLeft: styles.borderLeft,
            background: styles.background
        }}>
            <div className="reward-icon" style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                backgroundColor: 'rgba(255,255,255,0.8)',
                flexShrink: 0
            }}>
                {styles.icon}
            </div>
            
            <div className="reward-info" style={{ flex: 1 }}>
                <h3 className="reward-title" style={{ 
                    margin: '0 0 8px 0', 
                    color: '#122021',
                    fontSize: '1.1rem',
                    fontWeight: '600'
                }}>
                    {reward.title}
                </h3>
                <p className="reward-description" style={{ 
                    margin: '0 0 12px 0', 
                    color: '#4d5c5f',
                    fontSize: '0.9rem'
                }}>
                    {reward.description}
                </p>
                
                {/* 🆕 INFORMACIÓN DEL RETO */}
                <div className="challenge-info">
                    <p className="challenge-description" style={{ 
                        margin: '0 0 8px 0', 
                        color: '#4d5c5f',
                        fontSize: '0.85rem'
                    }}>
                        <strong>Reto:</strong> {reward.challenge_description}
                    </p>
                    
                    <div className="progress-container">
                        <div className="progress-bar" style={{
                            height: '8px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '4px'
                        }}>
                            <div 
                                className={`progress-fill ${reward.progress_percentage === 100 ? 'completed' : ''}`}
                                style={{ 
                                    height: '100%',
                                    backgroundColor: reward.progress_percentage === 100 ? '#10b981' : '#00eb5b',
                                    width: `${reward.progress_percentage}%`,
                                    transition: 'width 0.3s ease'
                                }}
                            ></div>
                        </div>
                        <span className="progress-text" style={{
                            fontSize: '0.75rem',
                            color: '#6b7280',
                            fontWeight: '500'
                        }}>
                            {reward.current_progress}/{reward.challenge_target} 
                            ({Math.round(reward.progress_percentage)}%)
                            {reward.progress_percentage === 100 && ' ✓'}
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="reward-actions" style={{ display: 'flex', alignItems: 'center' }}>
                {reward.is_claimable && !reward.is_used ? (
                    <button
                        className="reward-claim-btn"
                        onClick={() => handleClaim()}
                        disabled={isClaiming}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: '#00eb5b',
                            color: '#122021',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {isClaiming ? 'Procesando...' : 'Reclamar'}
                    </button>
                ) : (
                    <button
                        className={
                            reward.is_used || reward.is_claimed
                                ? "reward-completed-btn"
                                : "reward-locked-btn"
                        }
                        disabled
                    >
                        {reward.is_used ? 'Canjeada' :
                         reward.is_claimed ? 'Reclamado' :
                         reward.current_progress > 0 ? 'En progreso' : 'Pendiente'}
                    </button>
                )}
            </div>

            {/* Place Selector Modal for place_badge rewards */}
            {showPlaceSelector && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '12px',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }}>
                        <h3 style={{ marginTop: 0 }}>Selecciona un lugar para esta insignia</h3>
                        <p style={{ color: '#666', marginBottom: '20px' }}>
                            Esta insignia "{reward.badge_display_name}" se mostrará en el lugar que selecciones:
                        </p>

                        {userPlaces.length === 0 ? (
                            <p style={{ textAlign: 'center', color: '#999' }}>
                                No tienes lugares creados todavía.
                            </p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {userPlaces.map((place) => (
                                    <button
                                        key={place.id}
                                        onClick={() => handleClaim(place.id)}
                                        disabled={isClaiming}
                                        style={{
                                            padding: '15px',
                                            border: '2px solid #e5e7eb',
                                            borderRadius: '8px',
                                            backgroundColor: 'white',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'all 0.2s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = '#00eb5b';
                                            e.currentTarget.style.backgroundColor = '#f0fff4';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = '#e5e7eb';
                                            e.currentTarget.style.backgroundColor = 'white';
                                        }}
                                    >
                                        <strong>{place.name}</strong>
                                        {place.city && <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                            📍 {place.city}
                                        </div>}
                                    </button>
                                ))}
                            </div>
                        )}

                        <button
                            onClick={() => setShowPlaceSelector(false)}
                            style={{
                                marginTop: '20px',
                                padding: '10px 20px',
                                border: '1px solid #ccc',
                                borderRadius: '6px',
                                backgroundColor: 'white',
                                cursor: 'pointer',
                                width: '100%'
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Removed ALL_BENEFITS_DATA hardcoded array - now fetching from API



//interface BenefitsListProps {
  //  claimedBenefits: RewardType[];
//}
const BenefitsList: React.FC<{currentUserId: number}> = ({ currentUserId }) => {
    const [rewards, setRewards] = useState<RewardType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const url = buildApiUrl('/api/rewards');

        setLoading(true);
        setError(null);

        fetchJson<RewardType[]>(url)
            .then(data => {
                setRewards(data);
            })
            .catch(err => {
                setError("Error al cargar beneficios.");
                console.error(err);
            })
            .finally(() => setLoading(false));
    }, [currentUserId]);

    // Filter only DISCOUNT type rewards that are claimed
    const claimedBenefits = useMemo(() =>
        rewards.filter(r =>
            r.reward_type === 'discount' &&
            r.is_claimed
        ),
        [rewards]
    );

    if (loading) {
        return <div className="profile-card muted">Cargando beneficios...</div>;
    }

    if (error) {
        return <div className="profile-card muted error">{error}</div>;
    }

    if (claimedBenefits.length === 0) {
        return (
            <div className="profile-card muted">
                <p>¡Aún no has reclamado ningún beneficio!</p>
                <p>Completa retos para desbloquearlos en la pestaña "Retos y Recompensas".</p>
            </div>
        );
    }

    return (
        <div className="profile-card">
            <div style={{ padding: '20px' }}>
                <h2>🎁 Tus Beneficios y Cupones Activos</h2>
                <div className="rewards-list">
                    {claimedBenefits.map((benefit) => (
                        <ChallengeItem
                            key={benefit.id}
                            reward={benefit}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// 🆕 USER BADGES COMPONENT - Shows badges in user profile
const UserBadges: React.FC<{userId: number}> = ({ userId }) => {
    const [rewards, setRewards] = useState<RewardType[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const url = buildApiUrl('/api/rewards');

        fetchJson<RewardType[]>(url)
            .then(data => setRewards(data))
            .catch(err => console.error("Error loading badges:", err))
            .finally(() => setLoading(false));
    }, [userId]);

    const userBadges = useMemo(() =>
        rewards.filter(r =>
            r.reward_type === 'user_badge' &&
            r.is_claimed
        ),
        [rewards]
    );

    if (loading || userBadges.length === 0) {
        return null;
    }

    return (
        <div className="profile-badges">
            {userBadges.map(badge => (
                <div
                    key={badge.id}
                    title={badge.description}
                    className="profile-badge"
                >
                    <span>🏅</span>
                    <span>{badge.badge_display_name || badge.title}</span>
                </div>
            ))}
        </div>
    );
};

// 🆕 COMPONENTE PRINCIPAL ACTUALIZADO
function AchievementsList({ achievements }: { achievements: any[] }) { 
    
    const [rewards, setRewards] = useState<RewardType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 🚨 VARIABLE DE CONTROL TEMPORAL: 
    // Si es TRUE, TODAS las recompensas aparecerán como listas para reclamar (is_claimable: true).
    const TEST_ALL_CLAIMABLE = true; 

    const loadRewards = () => {
        const url = buildApiUrl('/api/rewards');
        
        setLoading(true);
        setError(null);
        
        fetchJson<RewardType[]>(url)
            .then(data => {
                // Aplicar el hardcodeo antes de establecer el estado
                const processedRewards = data.map(reward => {
                    if (TEST_ALL_CLAIMABLE) {
                        return {
                            ...reward,
                            // 1. Forzar elegibilidad para que el botón sea verde
                            is_claimable: true,
                            // 2. Forzar progreso a 100% para que se clasifique correctamente en el frontend
                            current_progress: reward.challenge_target,
                            progress_percentage: 100.0
                        };
                    }
                    return reward;
                });
                
                setRewards(processedRewards); // Usamos los datos procesados
            })
            .catch(err => {
                setError("Error al cargar recompensas. Asegúrate de que el Backend esté corriendo.");
                console.error(err);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadRewards();
    }, []);

    // 🆕 CÁLCULO CORREGIDO DEL PROGRESO (igual que en el modal)
    // ESTOS FILTROS AHORA USARÁN LOS VALORES TEMPORALMENTE HARDCODEADOS:
    
    const completedRewards = rewards.filter(r => r.is_used);
    const availableRewards = rewards.filter(r => r.is_claimable && !r.is_used);
    const inProgressRewards = rewards.filter(r => 
        !r.is_used && 
        !r.is_claimable && 
        r.current_progress > 0
    );
    const lockedRewards = rewards.filter(r => 
        !r.is_used && 
        !r.is_claimable && 
        r.current_progress === 0
    );
    
    const totalCompleted = completedRewards.length + availableRewards.length;

    if (loading) {
        return <div className="profile-card muted">Cargando recompensas...</div>;
    }

    if (error) {
        return <div className="profile-card muted error">{error}</div>;
    }
    
    if (rewards.length === 0) {
        return (
            <div className="profile-card muted">
                <p>No hay recompensas disponibles o la Base de Datos está vacía.</p>
            </div>
        );
    }
    
    return (
        <div className="profile-card">
            <div style={{ padding: '20px' }}>
                <h2 style={{ 
                    color: '#122021', 
                    textAlign: 'center', 
                    marginBottom: '20px',
                    fontSize: '1.5rem',
                    fontWeight: '700'
                }}>
                    🎯 Tus Retos y Recompensas
                </h2>
                
                <p style={{
                    textAlign: 'center', 
                    marginBottom: '30px', 
                    color: '#4d5c5f',
                    fontSize: '0.95rem'
                }}>
                    ¡Completa los retos para desbloquear y reclamar estas recompensas!
                </p>

                {/* 🆕 PROGRESO CORREGIDO - igual que en el modal */}
                <div className="rewards-progress" style={{
                    marginBottom: '30px',
                    padding: '20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                }}>
                    <div className="progress-stats" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        fontWeight: '600',
                        color: '#122021'
                    }}>
                        <span>{totalCompleted} de {rewards.length} retos completados</span>
                        <span>{Math.round((totalCompleted / rewards.length) * 100)}%</span>
                    </div>
                    <div className="progress-bar" style={{
                        height: '12px',
                        backgroundColor: '#e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden'
                    }}>
                        <div 
                            className="progress-fill"
                            style={{ 
                                height: '100%',
                                backgroundColor: '#00eb5b',
                                width: `${(totalCompleted / rewards.length) * 100}%`,
                                transition: 'width 0.5s ease'
                            }}
                        ></div>
                    </div>
                </div>

                {/* 🆕 LISTA DE RECOMPENSAS ORGANIZADA POR ESTADO */}
                <div className="rewards-list">
                    {/* Recompensas disponibles para reclamar */}
                    {availableRewards.length > 0 && (
                        <div style={{ marginBottom: '25px' }}>
                            <h3 style={{ 
                                color: '#122021',
                                marginBottom: '15px',
                                fontSize: '1.1rem',
                                fontWeight: '600'
                            }}>
                                🎁 Listas para reclamar ({availableRewards.length})
                            </h3>
                            {availableRewards.map((reward) => (
                                <ChallengeItem 
                                    key={reward.id} 
                                    reward={reward} 
                                    onClaimSuccess={loadRewards}
                                />
                            ))}
                        </div>
                    )}

                    {/* Retos en progreso */}
                    {inProgressRewards.length > 0 && (
                        <div style={{ marginBottom: '25px' }}>
                            <h3 style={{ 
                                color: '#122021',
                                marginBottom: '15px',
                                fontSize: '1.1rem',
                                fontWeight: '600'
                            }}>
                                🚧 En progreso ({inProgressRewards.length})
                            </h3>
                            {inProgressRewards.map((reward) => (
                                <ChallengeItem 
                                    key={reward.id} 
                                    reward={reward} 
                                    onClaimSuccess={loadRewards}
                                />
                            ))}
                        </div>
                    )}

                    {/* Retos bloqueados */}
                    {lockedRewards.length > 0 && (
                        <div style={{ marginBottom: '25px' }}>
                            <h3 style={{ 
                                color: '#122021',
                                marginBottom: '15px',
                                fontSize: '1.1rem',
                                fontWeight: '600'
                            }}>
                                🔒 Por comenzar ({lockedRewards.length})
                            </h3>
                            {lockedRewards.map((reward) => (
                                <ChallengeItem 
                                    key={reward.id} 
                                    reward={reward} 
                                    onClaimSuccess={loadRewards}
                                />
                            ))}
                        </div>
                    )}

                    {/* Recompensas ya canjeadas */}
                    {completedRewards.length > 0 && (
                        <div>
                            <h3 style={{ 
                                color: '#122021',
                                marginBottom: '15px',
                                fontSize: '1.1rem',
                                fontWeight: '600'
                            }}>
                                ✅ Canjeadas ({completedRewards.length})
                            </h3>
                            {completedRewards.map((reward) => (
                                <ChallengeItem 
                                    key={reward.id} 
                                    reward={reward} 
                                    onClaimSuccess={loadRewards}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// El resto del código de UserProfile permanece igual...
export default function UserProfile() {
  const { username } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const { alert: showAlert, confirm: showConfirm } = useDialog();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam === "reviews" || tabParam === "about"|| tabParam === "beneficios") {
      return tabParam;
    }
    return "about";
  });
  const [updateKey, setUpdateKey] = useState(0);
  const handleBenefitsUpdate = () => {
    // Incrementa la clave para forzar que BenefitsList y otros componentes dependientes se actualicen.
    setUpdateKey(prev => prev + 1); 
    
    // (Opcional: Si tienes una función loadRewards en UserProfile, llámala aquí también)
};
  const currentUserId = authUser ? authUser.id : 0;
  console.log("UserProfile: ID del Usuario Autenticado (currentUserId):", currentUserId);
  const [isEditing, setIsEditing] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [isOwnerInput, setIsOwnerInput] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [places, setPlaces] = useState<PlaceOption[]>([]);
  const [placesLoaded, setPlacesLoaded] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<number | null>(null);
  const [editPlaceId, setEditPlaceId] = useState<number | "">("");
  const [editRating, setEditRating] = useState(5);
  const [editTitle, setEditTitle] = useState("");
  const [editComment, setEditComment] = useState("");
  const [existingPhotos, setExistingPhotos] = useState<{ id: number; url: string }[]>([]);
  const [photosToDelete, setPhotosToDelete] = useState<number[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews] = useState<string[]>([]);
  const [reviewActionError, setReviewActionError] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewDeletingId, setReviewDeletingId] = useState<number | null>(null);
  const [reviewVotingId, setReviewVotingId] = useState<number | null>(null);
  const [publishedPlaces, setPublishedPlaces] = useState<PlaceSummary[]>([]);
  const [isLoadingPublishedPlaces, setIsLoadingPublishedPlaces] = useState(true);
  const [publishedPlacesError, setPublishedPlacesError] = useState<string | null>(null);
  const [placeDeletingId, setPlaceDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (!username) {
      setError("Perfil no encontrado");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchUserProfile(username)
      .then(data => {
        if (!cancelled) {
          setProfile(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err.message || "No se pudo cargar el perfil");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    if (tabParam === "reviews" || tabParam === "about" || tabParam === "beneficios") {
        setActiveTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    return () => {
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  useEffect(() => {
        if (!authUser || authUser.username !== username) { 
            setIsLoadingPublishedPlaces(false);
            return;
        }

        const fetchPublishedPlaces = async () => {
            setIsLoadingPublishedPlaces(true);
            setPublishedPlacesError(null);
            try {
                const url = buildApiUrl(`/api/users/${authUser.id}/places`); 
                const response = await fetchJson<PlaceSummary[]>(url, { credentials: 'include' });
                setPublishedPlaces(response);
            } catch (err: unknown) {
                console.error("Error fetching published places:", err);
                const message =
                    err instanceof Error ? err.message : "No se pudieron cargar tus establecimientos.";
                setPublishedPlacesError(message);
            } finally {
                setIsLoadingPublishedPlaces(false);
            }
        };

        fetchPublishedPlaces();
    }, [authUser, username]);

  const locationText = useMemo(() => {
    if (!profile) return "";
    return [profile.city, profile.country].filter(Boolean).join(", ");
  }, [profile]);

  const placeOptions = useMemo(
    () =>
      places.map(place => ({
        value: place.id,
        label: [place.name, place.city_state, place.country].filter(Boolean).join(" · "),
      })),
    [places]
  );

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="container profile-page">
        <div className="profile-card notice error">{error ?? "Perfil no encontrado"}</div>
      </div>
    );
  }

  const isOwnProfile = authUser?.username === profile.username;
  const displayName = profile.full_name ?? profile.username;
  const fullNameChanged =
    isEditing && profile ? fullNameInput.trim() !== (profile.full_name ?? "").trim() : false;
  const bioChanged = isEditing && profile ? bioInput.trim() !== (profile.bio ?? "").trim() : false;
  const isOwnerChanged = isEditing && profile ? isOwnerInput !== profile.is_owner : false;
  const hasPendingChanges = isEditing && (fullNameChanged || bioChanged || isOwnerChanged || Boolean(avatarFile));

  function handleStartEditing() {
    if (!profile) return;
    setFullNameInput(profile.full_name ?? "");
    setBioInput(profile.bio ?? "");
    setIsOwnerInput(profile.is_owner);
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(null);
    setAvatarFile(null);
    setSubmitError(null);
    setIsEditing(true);
    setActiveTab("about");
  }

  function handleCancelEditing() {
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview(null);
    setAvatarFile(null);
    setSubmitError(null);
    setIsEditing(false);
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview);
    }
    const previewUrl = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreview(previewUrl);
    setSubmitError(null);
    event.target.value = "";
  }

  async function handleSaveChanges() {
    if (!profile) return;
    const normalizedFullName = fullNameInput.trim();
    const normalizedBio = bioInput.trim();
    const hasFullNameChange = normalizedFullName !== (profile.full_name ?? "").trim();
    const hasBioChange = normalizedBio !== (profile.bio ?? "").trim();
    const hasIsOwnerChange = isOwnerInput !== profile.is_owner;
    const hasAvatarChange = Boolean(avatarFile);

    if (!hasFullNameChange && !hasBioChange && !hasIsOwnerChange && !hasAvatarChange) {
      setIsEditing(false);
      return;
    }

    const payload: { full_name?: string; bio?: string; is_owner?: boolean; avatar?: File } = {};
    if (hasFullNameChange) {
      payload.full_name = normalizedFullName;
    }
    if (hasBioChange) {
      payload.bio = normalizedBio;
    }
    if (hasIsOwnerChange) {
      payload.is_owner = isOwnerInput;
    }
    if (avatarFile) {
      payload.avatar = avatarFile;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const updatedProfile = await updateMyProfile(payload);
      setProfile(updatedProfile);
      setIsEditing(false);
      setAvatarFile(null);
      if (avatarPreview) {
        URL.revokeObjectURL(avatarPreview);
      }
      setAvatarPreview(null);

      // Dispatch event to notify other components that the profile was updated
      window.dispatchEvent(new CustomEvent("user-profile-updated"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el perfil";
      setSubmitError(message);
  } finally {
    setSaving(false);
  }
}

  async function reloadProfileData() {
    if (!username) return;
    const updatedProfile = await fetchUserProfile(username);
    setProfile(updatedProfile);
  }

  async function ensurePlacesLoaded() {
    if (placesLoaded || placesLoading) {
      return;
    }
    setPlacesLoading(true);
    try {
      const data = await fetchJson<PlaceOption[]>(buildApiUrl("/api/search"));
      setPlaces(data);
      setPlacesLoaded(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No pudimos cargar la lista de lugares. Intentá nuevamente.";
      setReviewActionError(message);
    } finally {
      setPlacesLoading(false);
    }
  }

  async function handleStartReviewEdit(review: PlaceReview) {
    setReviewActionError(null);
    setEditingReviewId(review.id);
    setEditPlaceId(review.place_id);
    setEditRating(review.rating);
    setEditTitle(review.title ?? "");
    setEditComment(review.comment ?? "");
    await ensurePlacesLoaded();
    // populate existing photos from profile data (if available)
    try {
      const profileReview = profile?.reviews.find(r => r.id === review.id as number);
      const photos: { id: number; url: string }[] = [];
      if (profileReview && (profileReview as any).photos) {
        const urls: string[] = (profileReview as any).photos as string[];
        urls.forEach(u => {
          try {
            // remove query string and fragment
            const clean = u.split(/[?#]/)[0];
            const parts = clean.split("/");
            const last = parts[parts.length - 1] || "";
            // prefer exact numeric segment, else search for digits
            let id: number | null = null;
            if (/^\d+$/.test(last)) {
              id = Number(last);
            } else {
              const m = clean.match(/(\d+)/g);
              if (m && m.length > 0) {
                id = Number(m[m.length - 1]);
              }
            }
            if (id !== null && !Number.isNaN(id)) {
              photos.push({ id, url: u });
            }
          } catch {
            // ignore parse errors
          }
        });
      }
      setExistingPhotos(photos);
      setPhotosToDelete([]);
      setNewPhotos([]);
      setNewPhotoPreviews([]);
    } catch (err) {
      // ignore
    }
  }

  function handleCancelReviewEdit() {
    setEditingReviewId(null);
    setReviewActionError(null);
    setEditPlaceId("");
    setEditRating(5);
    setEditTitle("");
    setEditComment("");
  setExistingPhotos([]);
  setPhotosToDelete([]);
  setNewPhotos([]);
  setNewPhotoPreviews([]);
  }

  async function handleSaveReviewChanges() {
    if (!editingReviewId) return;
    if (!editPlaceId) {
      setReviewActionError("Seleccioná el lugar al que pertenece la reseña.");
      return;
    }
    const normalizedTitle = editTitle.trim();
    const normalizedComment = editComment.trim();

    if (!normalizedTitle || !normalizedComment) {
      setReviewActionError("Completá el título y el texto de la reseña.");
      return;
    }

    setReviewSaving(true);
    setReviewActionError(null);
    try {
      await updateReview(editingReviewId, {
        place_id: Number(editPlaceId),
        rating: editRating,
        title: normalizedTitle,
        comment: normalizedComment,
      });
      // Delete photos marked for deletion
      if (photosToDelete.length > 0) {
        await Promise.all(
          photosToDelete.map(async photoId => {
            try {
              const resp = await fetch(buildApiUrl(`/api/reviews/${editingReviewId}/photos/${photoId}`), {
                method: "DELETE",
                credentials: "include",
              });
              if (!resp.ok) {
                const text = await resp.text();
                console.warn("failed to delete review photo:", text);
              }
            } catch (err) {
              console.warn("error deleting review photo", err);
            }
          })
        );
      }

      // Upload new photos
      if (newPhotos.length > 0) {
        try {
          const formData = new FormData();
          newPhotos.forEach(p => formData.append("photos", p));
          const uploadResp = await fetch(buildApiUrl(`/api/reviews/${editingReviewId}/photos`), {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          if (!uploadResp.ok) {
            const text = await uploadResp.text();
            console.warn("Error subiendo fotos de reseña (edit):", text);
          }
        } catch (err) {
          console.warn("error uploading review photos", err);
        }
      }
      await reloadProfileData();
      await showAlert("✅ ¡Cambios guardados con éxito!");
      handleCancelReviewEdit();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudieron guardar los cambios de la reseña.";
      setReviewActionError(message);
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleDeleteReview(review: PlaceReview) {
    const confirmed = await showConfirm(
      "¿Seguro que querés eliminar esta reseña? Esta acción no se puede deshacer."
    );
    if (!confirmed) {
      return;
    }
    setReviewActionError(null);
    setReviewDeletingId(review.id);
    try {
      await deleteReview(review.id);
      if (editingReviewId === review.id) {
        handleCancelReviewEdit();
      }
      await reloadProfileData();
      await showAlert("La reseña fue eliminada.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo eliminar la reseña. Intentá nuevamente.";
      setReviewActionError(message);
    } finally {
      setReviewDeletingId(null);
    }
  }

  async function handleDeletePlace(place: PlaceSummary) {
    const confirmed = await showConfirm(
      `¿Seguro que querés eliminar \"${place.name}\"? Esta acción borrará todas sus reseñas y no se puede deshacer.`,
      { confirmLabel: "Eliminar", cancelLabel: "Cancelar" }
    );
    if (!confirmed) {
      return;
    }
    setPlaceDeletingId(place.id);
    try {
      await deletePlace(place.id);
      setPublishedPlaces(prev => prev.filter(item => item.id !== place.id));
      await showAlert(`Se eliminó "${place.name}".`);
      navigate("/");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo eliminar el establecimiento.";
      await showAlert(message);
    } finally {
      setPlaceDeletingId(null);
    }
  }

  async function handleReviewVote(reviewId: number, intent: "helpful" | "not_helpful") {
    if (!authUser) {
      await showAlert("Necesitás iniciar sesión para votar reseñas.");
      return;
    }
    if (!profile) {
      return;
    }

    const targetReview = profile.reviews.find(r => r.id === reviewId);
    if (!targetReview) {
      return;
    }
    if (targetReview.author_id === authUser.id) {
      return;
    }

    const currentVote = targetReview.user_vote ?? null;
    const action: ReviewVoteAction = currentVote === intent ? "clear" : intent;

    setReviewVotingId(reviewId);
    try {
      const updatedVote = await voteReview(reviewId, action);
      setProfile(prev =>
        prev
          ? {
              ...prev,
              reviews: prev.reviews.map(review =>
                review.id === reviewId
                  ? {
                      ...review,
                      helpful_votes: updatedVote.helpful_votes,
                      not_helpful_votes: updatedVote.not_helpful_votes,
                      user_vote: updatedVote.user_vote ?? null,
                    }
                  : review
              ),
            }
          : prev
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo registrar tu voto.";
      await showAlert(message);
    } finally {
      setReviewVotingId(null);
    }
  }

  function renderTabContent(tab: TabId, profileData: UserProfileResponse, currentUserId: number, handleBenefitsUpdate: () => void) {
    if (tab === "places") {
        if (isLoadingPublishedPlaces) {
          return (
              <div className="profile-card muted">
                <p>Cargando tus establecimientos...</p>
              </div>
          );
        }

        if (publishedPlacesError) {
          return (
              <div className="profile-card notice error">
                <p>{publishedPlacesError}</p>
              </div>
          );
        }

        if (publishedPlaces.length === 0) {
          return (
              <div className="profile-card muted">
                <p>Todavía no tienes ningún establecimiento publicado.</p>
              </div>
          );
        }
    }
    
    if (tab === "about") {
        
       const aboutCard = (
        <div className="profile-card about">
            {isEditing ? (
                <>
                    <textarea
                        value={bioInput}
                        onChange={event => setBioInput(event.target.value)}
                        rows={4}
                        placeholder="Contanos un poco sobre vos..."
                        className="profile-textarea"
                        disabled={saving}
                    />
                    <label
                        className="profile-owner-toggle"
                    >
                        <input
                            type="checkbox"
                            checked={isOwnerInput}
                            onChange={event => setIsOwnerInput(event.target.checked)}
                            disabled={saving}
                            className="profile-owner-toggle__input"
                        />
                        <span>Soy propietario de un establecimiento</span>
                    </label>
                </>
            ) : (
                <>
                    {profileData.bio ? (
                        <p>{profileData.bio}</p>
                    ) : (
                        <p className="muted">Sin descripción por el momento.</p>
                    )}
                </>
            )}
        </div>
    );

    
    const reviewItems = profileData.reviews.map(review => ({
        id: review.id,
        place_id: review.place_id,
        author_id: review.author_id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: (review as any).photos ?? [],
        author_name: profileData.full_name ?? profileData.username,
        author_photo_url: profileData.photo_url,
        created_at: review.created_at,
        place_name: review.place_name,
        helpful_votes: review.helpful_votes ?? 0,
        not_helpful_votes: review.not_helpful_votes ?? 0,
        user_vote: review.user_vote ?? null,
        place_photo_url: review.place_photo_url,
        place_rating_avg: review.place_rating_avg,
    }));


    const reviewsCard = (
        <>
            <h3 style={{ marginTop: '20px', marginBottom: '10px', fontSize: '20px' }}>
                Reseñas Publicadas
            </h3>

            {reviewItems.length === 0 ? (
                <ReviewsEmptyState
                  isOwnProfile={isOwnProfile}
                  onWriteReview={() => navigate("/reviews/new")}
                  onExplore={() => navigate("/search")}
                  onCreatePlace={isOwnProfile && profileData.is_owner ? () => navigate("/create-place") : undefined}
                />
            ) : (
                <div className="profile-card reviews-card">
                    <div className="reviews">
                        {reviewItems.map(review => {
                            
                            const isEditingReview = editingReviewId === review.id;
                            if (isEditingReview) {
                                const editBody = (
                                    <div className="review-edit-fields">
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
                                            {placeOptions.find(opt => opt.value === Number(editPlaceId))?.label || review.place_name || "Cargando..."}
                                        </div>
                                        {placesLoading && !placesLoaded ? (
                                            <small className="muted">Cargando información del lugar…</small>
                                        ) : null}
                                      </div>

                                      <label className="form-field">
                                        <span>Actualizá la puntuación</span>
                                        <div className="rating-selector">
                                          {[1, 2, 3, 4, 5].map(value => (
                                            <label
                                              key={value}
                                              className={`rating-pill ${editRating === value ? "active" : ""}`}
                                            >
                                              <input
                                                type="radio"
                                                name="edit-rating"
                                                value={value}
                                                checked={editRating === value}
                                                onChange={() => {
                                                  setEditRating(value);
                                                  setReviewActionError(null);
                                                }}
                                                disabled={reviewSaving}
                                              />
                                              <span>{value} ★</span>
                                            </label>
                                          ))}
                                        </div>
                                      </label>

                                      <label className="form-field">
                                        <span>Título</span>
                                        <input
                                          type="text"
                                          value={editTitle}
                                          onChange={event => {
                                            setEditTitle(event.target.value);
                                            setReviewActionError(null);
                                          }}
                                          maxLength={255}
                                          placeholder="Ej: Una estadía inolvidable"
                                          disabled={reviewSaving}
                                          required
                                        />
                                      </label>

                                      <label className="form-field">
                                        <span>Contanos más</span>
                                        <textarea
                                          value={editComment}
                                          onChange={event => {
                                            setEditComment(event.target.value);
                                            setReviewActionError(null);
                                          }}
                                          rows={6}
                                          placeholder="Compartí lo mejor y lo que puede mejorar."
                                          disabled={reviewSaving}
                                          required
                                        />
                                      </label>

                                      <label className="form-field">
                                        <span>Fotos</span>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                          {existingPhotos.map(p => {
                                            const marked = photosToDelete.includes(p.id);
                                            return (
                                              <div key={p.id} style={{ position: 'relative' }}>
                                                <img
                                                  src={p.url}
                                                  alt={`photo-${p.id}`}
                                                  style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6, opacity: marked ? 0.4 : 1 }}
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setPhotosToDelete(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                                                  }}
                                                  className={`review-photo-toggle ${photosToDelete.includes(p.id) ? 'marked' : ''}`}
                                                  style={{ position: 'absolute', top: 6, right: 6, background: '#fff', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}
                                                >
                                                  {photosToDelete.includes(p.id) ? 'Desmarcar' : 'Eliminar'}
                                                </button>
                                              </div>
                                            );
                                          })}
                                          {newPhotoPreviews.map((src, i) => (
                                            <div key={`new-${i}`} style={{ position: 'relative' }}>
                                              <img src={src} alt={`new-${i}`} style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6 }} />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setNewPhotos(prev => prev.filter((_, idx) => idx !== i));
                                                  setNewPhotoPreviews(prev => prev.filter((_, idx) => idx !== i));
                                                }}
                                                style={{ position: 'absolute', top: 6, right: 6, background: '#fff', borderRadius: 6, padding: '4px 6px', cursor: 'pointer' }}
                                              >Quitar</button>
                                            </div>
                                          ))}
                                          <div>
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
                                                e.target.value = '';
                                              }}
                                              disabled={reviewSaving}
                                            />
                                          </div>
                                        </div>
                                      </label>

                                      {reviewActionError ? (
                                        <div className="notice error">{reviewActionError}</div>
                                      ) : null}
                                    </div>
                                );

                                const editFooter = (
                                    <div className="review-edit-footer">
                                        <Button variant="outline" onClick={handleCancelReviewEdit} disabled={reviewSaving}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            onClick={handleSaveReviewChanges}
                                            disabled={reviewSaving || placesLoading}
                                        >
                                            {reviewSaving ? "Guardando..." : "Guardar cambios"}
                                        </Button>
                                    </div>
                                );

                                return (
                                    <ReviewCard
                                        key={review.id}
                                        review={review}
                                        showPlaceContext
                                        body={editBody}
                                        footer={editFooter}
                                    />
                                );
                            }

                            const actions = (
                                <>
                                    <button
                                        type="button"
                                        className="review-card-action-button"
                                        onClick={() => handleStartReviewEdit(review)}
                                        disabled={reviewSaving || reviewDeletingId !== null}
                                    >
                                        Editar reseña
                                    </button>
                                    <button
                                        type="button"
                                        className="review-card-action-button danger"
                                        onClick={() => handleDeleteReview(review)}
                                        disabled={reviewDeletingId === review.id || reviewSaving}
                                    >
                                        {reviewDeletingId === review.id ? "Eliminando..." : "Eliminar reseña"}
                                    </button>
                                </>
                            );

                            return (
                                <ReviewCard
                                    key={review.id}
                                    review={review}
                                    showPlaceContext
                                    actions={actions}
                                    enableVoting
                                    currentUserId={authUser?.id ?? null}
                                    onVote={handleReviewVote}
                                    votingReviewId={reviewVotingId}
                                />
                            );
                        })}
                    </div>
                    {reviewActionError && editingReviewId === null ? (
                        <p className="review-error">{reviewActionError}</p>
                    ) : null}
                </div>
            )}
        </>
    );
    
    return (
        <>
            {aboutCard}
            {isOwnProfile && reviewsCard}
        </>
    );
}

    if (tab === "beneficios") {
      return <BenefitsList key="benefits-view" currentUserId={currentUserId} />;
    }
    if (tab === "achievements") {
        return <AchievementsList achievements={profileData.achievements} />;
    }
    
    if (tab === "places") {
        if (isLoadingPublishedPlaces) {
            return (
                <div className="profile-card muted">
                    <p>Cargando tus establecimientos...</p>
                </div>
            );
        }

        if (publishedPlacesError) {
            return (
                <div className="profile-card notice error">
                    <p>{publishedPlacesError}</p>
                </div>
            );
        }

        if (publishedPlaces.length === 0) {
            return (
                <div className="profile-card muted">
                    <p>Todavía no tienes ningún establecimiento publicado.</p>
                </div>
            );
        }
        
        const actionsRenderer = (place: PlaceSummary) => (
        isOwnProfile ? (
            <button
                type="button"
                className="place-card-delete-button"
                onClick={() => handleDeletePlace(place)}
                disabled={placeDeletingId === place.id}
                style={{
                    position: 'absolute',
                    top: 30,
                    right: 0,
                    zIndex: 15,
                    background: '#e74c3c',
                    color: 'white',
                    border: 'rounded',
                    padding: '4px 8px',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textShadow: '1px 1px 1px #00000040',
                }}
            >
                {placeDeletingId === place.id ? "Eliminando..." : "Eliminar"}
            </button>
        ) : undefined
    );

    

    return (
      <>
        {isEditing && (
          <>
            <textarea
              value={bioInput}
              onChange={event => setBioInput(event.target.value)}
              rows={4}
              placeholder="Contanos un poco sobre vos..."
              className="profile-textarea"
              disabled={saving}
            />
            <label
              className="profile-owner-toggle"
            >
              <input
                type="checkbox"
                checked={isOwnerInput}
                onChange={event => setIsOwnerInput(event.target.checked)}
                disabled={saving}
                className="profile-owner-toggle__input"
              />
              <span>Soy propietario de un establecimiento</span>
            </label>
          </>
        )}
        <PlaceCarousel
            title="Mis Establecimientos"
            places={publishedPlaces}
            actionsRenderer={actionsRenderer}
        />
      </>
    );
    }


    return null;
}

  const roleLabel = profile.is_owner ? "Propietario" : "Viajero";
  const statItems = [
    { label: "Reseñas", value: profile.stats.reviews_count },
    { label: "Logros", value: profile.stats.achievements_count },
    {
      label: isOwnProfile ? "Establecimientos" : "Rol",
      value: isOwnProfile ? (isLoadingPublishedPlaces ? "—" : publishedPlaces.length) : roleLabel,
    },
  ];

  return (
    <div className="container profile-page">
      <section className="profile-hero">
        <div className="profile-hero__bg" aria-hidden="true" />
        <div className="profile-hero__content">
          <div className="profile-identity">
            <div className="profile-avatar-wrap">
              <img
                src={avatarPreview ?? profile.photo_url}
                alt={`Foto de ${displayName}`}
                className="profile-avatar"
              />
              {isEditing ? (
                <label htmlFor="avatar-upload" className="profile-avatar-upload">
                  Cambiar foto
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="sr-only"
                    disabled={saving}
                  />
                </label>
              ) : null}
            </div>
            <div className="profile-heading">
              {isEditing ? (
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={event => setFullNameInput(event.target.value)}
                  placeholder="Nombre para mostrar"
                  className="profile-name-input"
                  disabled={saving}
                />
              ) : (
                <h1 className="profile-name">{displayName}</h1>
              )}
              <div className="profile-meta">
                {profile.age ? <span>{profile.age} años</span> : null}
                {locationText ? <span>{locationText}</span> : null}
                <span className={`profile-pill ${profile.is_owner ? "profile-pill--owner" : ""}`}>
                  {roleLabel}
                </span>
                {profile.joined_in ? <span>Miembro desde {profile.joined_in}</span> : null}
              </div>
              {!isEditing && isOwnProfile && <UserBadges userId={currentUserId} />}
              {isOwnProfile ? (
                <div className="profile-actions">
                  {isEditing ? (
                    <>
                      <Button variant="outline" onClick={handleCancelEditing} disabled={saving}>
                        Cancelar
                      </Button>
                      <Button onClick={handleSaveChanges} disabled={saving || !hasPendingChanges}>
                        {saving ? "Guardando..." : "Guardar cambios"}
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" onClick={handleStartEditing}>
                      Editar perfil
                    </Button>
                  )}
                </div>
              ) : null}
              {submitError ? <p className="profile-error">{submitError}</p> : null}
            </div>
          </div>
          <div className="profile-stats-row">
            {statItems.map(item => (
              <div className="profile-stat-chip" key={item.label}>
                <span className="profile-stat-label">{item.label}</span>
                <span className="profile-stat-value">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="profile-tabs">
        <button
          className={`profile-tab ${activeTab === "about" ? "active" : ""}`}
          onClick={() => setActiveTab("about")}
        >
          Información
        </button>
        {isOwnProfile ? (
          <button
            className={`profile-tab ${activeTab === "places" ? "active" : ""}`}
            onClick={() => setActiveTab("places")}
          >
            Establecimientos
            <span className="profile-tab__count">
              {isLoadingPublishedPlaces ? "…" : publishedPlaces.length}
            </span>
          </button>
        ) : null}
        <button
          className={`profile-tab ${activeTab === "beneficios" ? "active" : ""}`}
          onClick={() => setActiveTab("beneficios")}
        >
          Beneficios
        </button>
      </nav>

      <section className="profile-content">
        {renderTabContent(activeTab, profile, currentUserId, handleBenefitsUpdate)}
      </section>
    </div>
  );
}
