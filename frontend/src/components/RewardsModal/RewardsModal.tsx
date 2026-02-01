import React, { useState, useEffect } from 'react';
import { buildApiUrl, fetchJson } from '../../lib/api';
import './RewardsModal.css';
import { useAuth } from '../../contexts/AuthContext';
import { useDialog } from '../../contexts/DialogContext';

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

interface RewardsModalProps {
    isOpen: boolean;
    onClose: () => void;
   // currentUserId: number;
    onBenefitsUpdate: () => void;
}

const RewardsModal: React.FC<RewardsModalProps> = ({ isOpen, onClose, onBenefitsUpdate}) => {
    const { user: authUser } = useAuth();
    const currentUserId = authUser ? authUser.id : 0;
    const { alert: showAlert } = useDialog();

    const [rewards, setRewards] = useState<RewardType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');
    const [showPlaceSelector, setShowPlaceSelector] = useState(false);
    const [userPlaces, setUserPlaces] = useState<any[]>([]);
    const [selectedReward, setSelectedReward] = useState<RewardType | null>(null);

    const loadRewards = () => {
        const url = buildApiUrl('/api/rewards');
        
        setLoading(true);
        setError(null);
        
        fetchJson<RewardType[]>(url)
            .then(setRewards)
            .catch(err => {
                setError("Error al cargar recompensas");
                console.error(err);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (isOpen) {
            console.log("RewardsModal: ID recibido en Props:", currentUserId);
            loadRewards();
        }
    }, [isOpen,currentUserId]);

    const handleClaim = async (reward: RewardType, placeId?: number) => {
        console.log("RewardsModal: ID al momento de Reclamar:", currentUserId);

        // For place_badge rewards, check if we need to show place selector
        if (reward.reward_type === 'place_badge') {
            // Special badges that auto-assign to specific places (no user choice needed)
            const autoAssignBadges = [4, 5]; // 4: "Nuevo establecimiento", 5: "Host Verificado"

            if (!autoAssignBadges.includes(reward.id) && !placeId) {
                // Show place selector modal for other place badges
                setSelectedReward(reward);
                // Fetch user's places
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
                    await showAlert('Error al cargar tus lugares. Intenta de nuevo.');
                    return;
                }
            } catch (error) {
                await showAlert('Error al cargar tus lugares. Intenta de nuevo.');
                return;
            }
        }
            // For auto-assign badges (4 & 5), continue without showing selector
        }

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
                throw new Error(errorData.detail || `Fallo al reclamar`);
            }

            // 🚨 CÓDIGO MODIFICADO PARA INCLUIR EL ID DEL USUARIO 🚨
            const userKey = `claimed_rewards_${currentUserId}`; // Clave única por usuario
            const claimedIds = JSON.parse(localStorage.getItem(userKey) || '[]'); // Lee la clave única

            // 1. Añadir el ID actual al mock de beneficios reclamados
            if (!claimedIds.includes(reward.id)) {
                claimedIds.push(reward.id);
                localStorage.setItem(userKey, JSON.stringify(claimedIds)); // Escribe en la clave única
            }
            // ------------------------------------------------------------------

            setShowPlaceSelector(false);
            setSelectedReward(null);
            loadRewards();
            //onBenefitsUpdate();
            await showAlert(`✅ ¡Recompensa '${reward.title}' canjeada con éxito!`);

        } catch (error: unknown) {
            const errorMessage = error instanceof Error
                ? error.message
                : 'Error de conexión';
            console.error("Error al reclamar:", error);
            await showAlert(`❌ Error al reclamar: ${errorMessage}`);
        }
    };

    // Filter rewards by status
    const usedRewards = rewards.filter(r => r.is_used);                    // Used/redeemed
    const claimedRewards = rewards.filter(r => r.is_claimed && !r.is_used); // Claimed but not used
    const availableRewards = rewards.filter(r => r.is_claimable);          // Claimable (completed not claimed)
    const inProgressRewards = rewards.filter(r =>
        !r.is_completed && r.current_progress > 0
    );
    const lockedRewards = rewards.filter(r =>
        !r.is_completed && r.current_progress === 0
    );

    const totalCompleted = usedRewards.length + claimedRewards.length + availableRewards.length;

    if (!isOpen) return null;

    return (
        <div className="rewards-modal-overlay" onClick={onClose}>
            <div className="rewards-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="rewards-modal-header">
                    <h2>🎯 Tus Retos y Recompensas</h2>
                    <button className="rewards-modal-close" onClick={onClose}>×</button>
                </div>

                <div className="rewards-modal-tabs">
                    <button 
                        className={`rewards-tab ${activeTab === 'available' ? 'active' : ''}`}
                        onClick={() => setActiveTab('available')}
                    >
                        Disponibles ({availableRewards.length + inProgressRewards.length + lockedRewards.length})
                    </button>
                    <button 
                        className={`rewards-tab ${activeTab === 'completed' ? 'active' : ''}`}
                        onClick={() => setActiveTab('completed')}
                    >
                        Completados ({totalCompleted})
                    </button>
                </div>

                <div className="rewards-modal-body">
                    {loading ? (
                        <div className="rewards-loading">Cargando tus recompensas...</div>
                    ) : error ? (
                        <div className="rewards-error">{error}</div>
                    ) : activeTab === 'available' ? (
                        <div className="rewards-list">
                            {/* Recompensas disponibles para reclamar */}
                            {availableRewards.map(reward => (
                                <div key={reward.id} className="reward-card available">
                                    <div className="reward-icon">🎁</div>
                                    <div className="reward-info">
                                        <h3 className="reward-title">{reward.title}</h3>
                                        <p className="reward-description">{reward.description}</p>
                                        <div className="challenge-info">
                                            <p className="challenge-description">
                                                <strong>Reto:</strong> {reward.challenge_description}
                                            </p>
                                            <div className="progress-container">
                                                <div className="progress-bar">
                                                    <div 
                                                        className="progress-fill completed"
                                                        style={{ width: '100%' }}
                                                    ></div>
                                                </div>
                                                <span className="progress-text">
                                                    {reward.current_progress}/{reward.challenge_target} 
                                                    (Completado ✓)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        className="reward-claim-btn"
                                        onClick={() => handleClaim(reward)}
                                    >
                                        Reclamar
                                    </button>
                                </div>
                            ))}

                            {/* Retos en progreso */}
                            {inProgressRewards.map(reward => (
                                <div key={reward.id} className="reward-card in-progress">
                                    <div className="reward-icon">🚧</div>
                                    <div className="reward-info">
                                        <h3 className="reward-title">{reward.title}</h3>
                                        <p className="reward-description">{reward.description}</p>
                                        <div className="challenge-info">
                                            <p className="challenge-description">
                                                <strong>Reto:</strong> {reward.challenge_description}
                                            </p>
                                            <div className="progress-container">
                                                <div className="progress-bar">
                                                    <div 
                                                        className="progress-fill"
                                                        style={{ width: `${reward.progress_percentage}%` }}
                                                    ></div>
                                                </div>
                                                <span className="progress-text">
                                                    {reward.current_progress}/{reward.challenge_target} 
                                                    ({Math.round(reward.progress_percentage)}%)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="reward-locked-btn" disabled>
                                        En progreso
                                    </button>
                                </div>
                            ))}

                            {/* Retos bloqueados */}
                            {lockedRewards.map(reward => (
                                <div key={reward.id} className="reward-card locked">
                                    <div className="reward-icon">🔒</div>
                                    <div className="reward-info">
                                        <h3 className="reward-title">{reward.title}</h3>
                                        <p className="reward-description">{reward.description}</p>
                                        <div className="challenge-info">
                                            <p className="challenge-description">
                                                <strong>Reto:</strong> {reward.challenge_description}
                                            </p>
                                            <div className="progress-container">
                                                <div className="progress-bar">
                                                    <div 
                                                        className="progress-fill"
                                                        style={{ width: '0%' }}
                                                    ></div>
                                                </div>
                                                <span className="progress-text">
                                                    0/{reward.challenge_target} (Por comenzar)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="reward-locked-btn" disabled>
                                        Pendiente
                                    </button>
                                </div>
                            ))}

                            {availableRewards.length === 0 && inProgressRewards.length === 0 && lockedRewards.length === 0 && (
                                <div className="rewards-empty">
                                    <p>🎯 Completa más actividades para desbloquear recompensas</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rewards-list">
                            {/* Recompensas usadas/redimidas */}
                            {usedRewards.map(reward => (
                                <div key={reward.id} className="reward-card completed">
                                    <div className="reward-icon">✅</div>
                                    <div className="reward-info">
                                        <h3 className="reward-title">{reward.title}</h3>
                                        <p className="reward-description">{reward.description}</p>
                                        <div className="challenge-info">
                                            <p className="challenge-description">
                                                <strong>Reto completado:</strong> {reward.challenge_description}
                                            </p>
                                        </div>
                                    </div>
                                    <button className="reward-completed-btn" disabled>
                                        Redimida
                                    </button>
                                </div>
                            ))}

                            {/* Recompensas reclamadas pero no usadas */}
                            {claimedRewards.map(reward => (
                                <div key={reward.id} className="reward-card completed">
                                    <div className="reward-icon">🎁</div>
                                    <div className="reward-info">
                                        <h3 className="reward-title">{reward.title}</h3>
                                        <p className="reward-description">{reward.description}</p>
                                        <div className="challenge-info">
                                            <p className="challenge-description">
                                                <strong>Reto completado:</strong> {reward.challenge_description}
                                            </p>
                                        </div>
                                    </div>
                                    <button className="reward-completed-btn" disabled>
                                        Reclamada
                                    </button>
                                </div>
                            ))}

                            {/* Recompensas disponibles para reclamar */}
                            {availableRewards.map(reward => (
                                <div key={reward.id} className="reward-card available">
                                    <div className="reward-icon">🎁</div>
                                    <div className="reward-info">
                                        <h3 className="reward-title">{reward.title}</h3>
                                        <p className="reward-description">{reward.description}</p>
                                        <div className="challenge-info">
                                            <p className="challenge-description">
                                                <strong>Reto completado:</strong> {reward.challenge_description}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        className="reward-claim-btn"
                                        onClick={() => handleClaim(reward)}
                                    >
                                        Reclamar
                                    </button>
                                </div>
                            ))}

                            {totalCompleted === 0 && (
                                <div className="rewards-empty">
                                    <p>🏆 Aún no has completado ningún reto</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Progress Summary */}
                <div className="rewards-progress">
                    <div className="progress-stats">
                        <span>{totalCompleted} de {rewards.length} retos completados</span>
                        <span>{Math.round((totalCompleted / rewards.length) * 100)}%</span>
                    </div>
                    <div className="progress-bar">
                        <div
                            className="progress-fill"
                            style={{ width: `${(totalCompleted / rewards.length) * 100}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Place Selector Modal for place_badge rewards */}
            {showPlaceSelector && selectedReward && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000
                }} onClick={() => setShowPlaceSelector(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '30px',
                        borderRadius: '12px',
                        maxWidth: '500px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflow: 'auto'
                    }} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{ marginTop: 0 }}>Selecciona un lugar para esta insignia</h3>
                        <p style={{ color: '#666', marginBottom: '20px' }}>
                            Esta insignia "{selectedReward.badge_display_name}" se mostrará en el lugar que selecciones:
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
                                        onClick={() => handleClaim(selectedReward, place.id)}
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

export default RewardsModal;
