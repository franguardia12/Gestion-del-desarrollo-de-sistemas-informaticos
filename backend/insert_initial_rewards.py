# insert_initial_rewards.py

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Reward, Challenge
import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from models import Reward, Challenge, UserReward, User, Base

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/viajerosxp")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def insert_initial_rewards():
    db = SessionLocal()
    
    try:
        print("Iniciando inserción de datos iniciales...")

        # Limpieza de datos existentes (rewards first due to FK constraint)
        db.query(Reward).delete()
        db.query(Challenge).delete()
        db.commit()
        print("Datos antiguos de recompensas y retos eliminados.")

        # --- NUEVOS RETOS MÁS CONCRETOS Y ATRACTIVOS ---
        challenges_to_create = [
            Challenge(id=1, title="Primera Reseña", slug="first_review", 
                    description="Escribe tu primera reseña en cualquier establecimiento", target_value=1),
            Challenge(id=4, title="Anfitrión Debutante", slug="publish_first_place", 
                      description="Publica tu primer establecimiento", target_value=1),
            Challenge(id=3, title="Viajero contento", slug="five_star_review",
                    description="Escribe una reseña de 5 estrellas", target_value=1),
            Challenge(id=8, title="Guía Local", slug="complete_profile", 
                      description="Completa al 100% tu perfil de usuario", target_value=1),
            

            # Retos de Propietarios
            Challenge(id=5, title="Host Popular", slug="get_5_reviews", 
                      description="Consigue 5 reseñas en uno de tus establecimientos", target_value=5),            
            # Retos de Comunidad             
            Challenge(id=9, title="Crítico Constante", slug="10_reviews_month", 
                      description="Escribe 10 reseñas", target_value=10),
            # Retos Especiales
            Challenge(id=10, title="Gourmet Viajero", slug="review_5_restaurants", 
                      description="Reseña 5 restaurantes diferentes", target_value=5),
            Challenge(id=11, title="Expert en Hoteles", slug="review_3_hotels", 
                      description="Reseña 5 hoteles diferentes", target_value=3),
            Challenge(id=12, title="Viajero Frecuente", slug="visit_3_cities", 
                      description="Interactua con 3 reseñas de usuarios", target_value=3),
            Challenge(id=13, title="Explorador Global", slug="review_5_countries",
                      description="Reseña lugares en 5 países diferentes", target_value=5),
            Challenge(id=14, title="Orgullo Local", slug="argentina_trio",
                      description="Publica 3 reseñas en establecimientos de Argentina", target_value=3),
            Challenge(id=15, title="Foodie Aventurero", slug="review_8_restaurants",
                      description="Escribe 8 reseñas en restaurantes", target_value=8),
            Challenge(id=16, title="Hotel Hunter", slug="review_5_hotels",
                      description="Reseña 5 hoteles diferentes", target_value=5),
            Challenge(id=17, title="Crítico Apreciado", slug="get_10_helpful_votes",
                      description="Consigue 10 votos de 'útil' en tus reseñas", target_value=10),
            Challenge(id=18, title="Comunidad Activa", slug="vote_15_reviews",
                      description="Vota 15 reseñas de otros viajeros", target_value=15),
            Challenge(id=19, title="Portafolio en Marcha", slug="publish_3_places",
                      description="Publica 3 establecimientos", target_value=3),
            Challenge(id=20, title="Portafolio Activo", slug="publish_5_places",
                      description="Publica 5 establecimientos", target_value=5),
            Challenge(id=21, title="Red de Anfitrión", slug="publish_10_places",
                      description="Publica 10 establecimientos", target_value=10),
            Challenge(id=22, title="Host Súper Popular", slug="get_10_reviews",
                      description="Alcanza 10 reseñas en tus lugares", target_value=10),
            Challenge(id=23, title="Host Leyenda", slug="get_20_reviews",
                      description="Alcanza 20 reseñas en tus lugares", target_value=20),
            Challenge(id=24, title="Cronista", slug="write_20_reviews",
                      description="Escribe 20 reseñas", target_value=20),
            Challenge(id=25, title="Cronista Incansable", slug="write_30_reviews",
                      description="Escribe 30 reseñas", target_value=30),
            Challenge(id=26, title="Votante Serial", slug="vote_30_reviews",
                      description="Emite 30 votos en reseñas", target_value=30),
            Challenge(id=27, title="Apoyo Constructivo", slug="vote_10_helpful",
                      description="Marca 10 reseñas como útiles", target_value=10),
            Challenge(id=28, title="Ojo Crítico", slug="vote_5_not_helpful",
                      description="Marca 5 reseñas como no útiles", target_value=5),
            Challenge(id=29, title="Crítico Referente", slug="get_25_helpful_votes",
                      description="Recibe 25 votos de 'útil' en tus reseñas", target_value=25),
            Challenge(id=30, title="Anfitrión Responde", slug="owner_reply_3",
                      description="Responde 3 reseñas en tus establecimientos", target_value=3),
            Challenge(id=31, title="Anfitrión Atento", slug="owner_reply_10",
                      description="Responde 10 reseñas en tus establecimientos", target_value=10)
        ]
        db.add_all(challenges_to_create)
        db.commit()
        print("[OK] 31 Retos mejorados insertados.")

        # --- RECOMPENSAS MÁS ATRACTIVAS ---
        rewards_to_create = [
            # USER BADGES - Show in user profile
            Reward(
                id=1,
                title="Insignia Primerizo",
                description="🎖️ Insignia 'Primera Reseña' en tu perfil",
                challenge_id=1,
                reward_type="user_badge",
                badge_icon="first_review",
                badge_display_name="Primera Reseña"
            ),
            Reward(
                id=8,
                title="Perfil Completo",
                description="💎 Insignia de 'Usuario Ejemplar' en tu perfil",
                challenge_id=8,
                reward_type="user_badge",
                badge_icon="profile_complete",
                badge_display_name="Usuario Ejemplar"
            ),

            # PLACE BADGES - Show on establishment cards
            Reward(
                id=4,
                title="Nuevo establecimiento",
                description="🏠 Sticker de 'Nuevo' por 2 semanas en tu establecimiento",
                challenge_id=4,
                reward_type="place_badge",
                badge_icon="new",
                badge_display_name="Nuevo"
            ),
            Reward(
                id=5,
                title="Host Verificado",
                description="✅ Sello 'Popular' en tu establecimiento",
                challenge_id=5,
                reward_type="place_badge",
                badge_icon="popular",
                badge_display_name="Popular"
            ),

            # DISCOUNTS - Show in benefits tab
            Reward(
                id=3,
                title="Viajero contento",
                description="⭐ 5% de descuento en el lugar reseñado!",
                challenge_id=3,
                reward_type="discount"
            ),
            Reward(
                id=9,
                title="Crítico Destacado",
                description="📝 10% de descuento en tu proxima cena!",
                challenge_id=9,
                reward_type="discount"
            ),
            Reward(
                id=10,
                title="Chef Honorario",
                description="🍝 Cena 2x1 en restaurante asociado",
                challenge_id=10,
                reward_type="discount"
            ),
            Reward(
                id=11,
                title="Expert en Hospedaje",
                description="🏨 Noche gratis en hotel",
                challenge_id=11,
                reward_type="discount"
            ),
            Reward(
                id=12,
                title="Descuento Viajero",
                description="✨ 15% de descuento en tu próxima reserva",
                challenge_id=12,
                reward_type="discount"
            ),
            Reward(
                id=13,
                title="Explorador Global",
                description="🌍 Insignia de viajero global visible en tu perfil",
                challenge_id=13,
                reward_type="user_badge",
                badge_icon="globe",
                badge_display_name="Explorador Global"
            ),
            Reward(
                id=14,
                title="Embajador Local",
                description="🇦🇷 Insignia 'Orgullo Local' para fans de Argentina",
                challenge_id=14,
                reward_type="user_badge",
                badge_icon="argentina",
                badge_display_name="Orgullo Local"
            ),
            Reward(
                id=15,
                title="Tour Gastronómico",
                description="🍽️ 12% de descuento en tu próxima reserva de restaurante",
                challenge_id=15,
                reward_type="discount"
            ),
            Reward(
                id=16,
                title="Upgrade Hotelero",
                description="🛎️ Late checkout o mejora de habitación sujeta a disponibilidad",
                challenge_id=16,
                reward_type="discount"
            ),
            Reward(
                id=17,
                title="Crítico Estrella",
                description="⭐ Insignia especial junto a tus reseñas más votadas",
                challenge_id=17,
                reward_type="user_badge",
                badge_icon="helpful",
                badge_display_name="Crítico Apreciado"
            ),
            Reward(
                id=18,
                title="Comunidad Activa",
                description="🤝 Insignia de reconocimiento por votar y apoyar reseñas",
                challenge_id=18,
                reward_type="user_badge",
                badge_icon="community",
                badge_display_name="Comunidad Activa"
            ),
            Reward(
                id=19,
                title="Mini Portafolio",
                description="🏷️ Sello destacado en tus próximas 3 publicaciones",
                challenge_id=19,
                reward_type="place_badge",
                badge_icon="portfolio",
                badge_display_name="Mini Portafolio"
            ),
            Reward(
                id=20,
                title="Portafolio Pro",
                description="📌 Sticker especial en tu tarjeta de propietario",
                challenge_id=20,
                reward_type="user_badge",
                badge_icon="owner_pro",
                badge_display_name="Portafolio Pro"
            ),
            Reward(
                id=21,
                title="Red de Anfitrión",
                description="🎯 Boost temporal de visibilidad en 2 de tus lugares",
                challenge_id=21,
                reward_type="place_badge",
                badge_icon="network",
                badge_display_name="Red Activa"
            ),
            Reward(
                id=22,
                title="Host Súper Popular",
                description="💬 Insignia de popularidad en la ficha del lugar",
                challenge_id=22,
                reward_type="place_badge",
                badge_icon="popular_plus",
                badge_display_name="Súper Popular"
            ),
            Reward(
                id=23,
                title="Host Leyenda",
                description="👑 Banner destacado por 30 días en tu mejor lugar",
                challenge_id=23,
                reward_type="place_badge",
                badge_icon="legend",
                badge_display_name="Leyenda"
            ),
            Reward(
                id=24,
                title="Cronista",
                description="📝 10% off en tu próxima reserva por compartir reseñas",
                challenge_id=24,
                reward_type="discount"
            ),
            Reward(
                id=25,
                title="Cronista Incansable",
                description="📚 Insignia premium visible en tu perfil",
                challenge_id=25,
                reward_type="user_badge",
                badge_icon="writer",
                badge_display_name="Cronista"
            ),
            Reward(
                id=26,
                title="Votante Serial",
                description="🗳️ Desbloquea filtro de reseñas avanzado",
                challenge_id=26,
                reward_type="user_badge",
                badge_icon="voter",
                badge_display_name="Votante Serial"
            ),
            Reward(
                id=27,
                title="Apoyo Constructivo",
                description="🙏 8% de descuento en tu próxima cena",
                challenge_id=27,
                reward_type="discount"
            ),
            Reward(
                id=28,
                title="Ojo Crítico",
                description="🔍 Insignia para resaltar tu ojo analítico",
                challenge_id=28,
                reward_type="user_badge",
                badge_icon="critic",
                badge_display_name="Ojo Crítico"
            ),
            Reward(
                id=29,
                title="Crítico Referente",
                description="🌟 Etiqueta especial junto a tus reseñas más votadas",
                challenge_id=29,
                reward_type="user_badge",
                badge_icon="mentor",
                badge_display_name="Crítico Referente"
            ),
            Reward(
                id=30,
                title="Anfitrión Responde",
                description="💬 Banner de anfitrión activo en el listado de tus lugares",
                challenge_id=30,
                reward_type="place_badge",
                badge_icon="reply",
                badge_display_name="Responde Rápido"
            ),
            Reward(
                id=31,
                title="Anfitrión Atento",
                description="⏱️ Prioridad en destacados por soporte ágil a reseñas",
                challenge_id=31,
                reward_type="place_badge",
                badge_icon="fast_reply",
                badge_display_name="Anfitrión Atento"
            )
        ]
        db.add_all(rewards_to_create)
        db.commit()
        print("[OK] 31 Recompensas atractivas insertadas.")

        print("\nNOTA: Los retos se rastrearan automaticamente con UserChallenge.")
        print("No se crean UserRewards hasta que el usuario reclame la recompensa.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Ocurrio un error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    insert_initial_rewards()
