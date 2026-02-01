import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { FeaturedCarousel } from "../components/FeaturedCarusel/FeaturedCarusel";
import { getCurrentUser, AuthUser, buildApiUrl } from "../lib/api";
import { ButtonLink } from "../components/Button";
import RewardsModal from "../components/RewardsModal/RewardsModal";
import { VirtualAssistant } from "../components/VirtualAssistant";
import {
  Home as HomeIcon,
  Hotel,
  UtensilsCrossed,
  House,
  Search,
  CheckCircle2,
  Plane,
  Map,
  Star,
  Building,
  Users,
  MapPin,
  Heart,
  TrendingUp,
  Compass,
  Camera,
  MessageSquare
} from "lucide-react";

// Category configuration with icons and display names
const CATEGORY_CONFIG: Record<string, { icon: any; label: string }> = {
  hotel: { icon: Hotel, label: "Hoteles" },
  restaurante: { icon: UtensilsCrossed, label: "Restaurantes" },
  alojamiento: { icon: House, label: "Alojamientos" }
};

export default function Home() {
  const [q, setQ] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user));
  }, []);

  // Fetch categories from API
  useEffect(() => {
    async function loadCategories() {
      try {
        const url = buildApiUrl("/api/places/categories");
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setCategories(data);
        }
      } catch (err) {
        console.error("Error loading categories:", err);
        setCategories([]);
      }
    }
    loadCategories();
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    const params = new URLSearchParams();

    if (query) {
      params.set("q", query);
    }

    if (selectedCategory !== "all") {
      params.set("category", selectedCategory);
    }

    const queryString = params.toString();
    navigate(`/search${queryString ? `?${queryString}` : ""}`);
  }

  return (
    <>
      <div className="container page home-page">
      {/* Botón flotante para recompensas */}
      {currentUser && (
        <button
          className="rewards-floating-btn"
          onClick={() => setShowRewardsModal(true)}
          title="Ver mis retos y recompensas"
        >
          🏆
          <span className="rewards-badge">!</span>
        </button>
      )}

      {/* Modal de recompensas */}
      <RewardsModal
        isOpen={showRewardsModal}
        onClose={() => setShowRewardsModal(false)}
      />

        <section className="home-hero">
          {/* Decorative elements */}
          <div className="home-hero__decoration home-hero__decoration--1">
            <Plane size={40} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--2">
            <Map size={32} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--3">
            <Star size={28} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--4">
            <Hotel size={36} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--5">
            <Compass size={38} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--6">
            <MapPin size={34} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--7">
            <UtensilsCrossed size={36} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--8">
            <House size={32} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--9">
            <Building size={38} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--10">
            <Star size={24} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--11">
            <Camera size={30} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--12">
            <MessageSquare size={28} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--13">
            <Heart size={26} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--14">
            <TrendingUp size={32} strokeWidth={1.5} />
          </div>
          <div className="home-hero__decoration home-hero__decoration--15">
            <Users size={30} strokeWidth={1.5} />
          </div>

          <span className="home-hero__eyebrow">Tu guía colaborativa</span>
          <h1 className="home-hero__title">¿A dónde vamos?</h1>
          <p className="home-hero__subtitle">
            Descubrí experiencias reales, planificá escapadas y compartí tus mejores recomendaciones con la comunidad.
          </p>

          <div className="home-hero__actions">
            {currentUser?.is_owner && (
              <ButtonLink to="/create-place" variant="outline">
                <Building size={18} strokeWidth={2} />
                Publicar tu Establecimiento
              </ButtonLink>
            )}
          </div>

          <div className="category-search-wrapper">
            {/* Additional decorative elements for category/search section */}
            <div className="search-section__decoration search-section__decoration--1">
              <Map size={40} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--2">
              <Star size={36} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--3">
              <Plane size={44} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--4">
              <House size={38} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--5">
              <Hotel size={42} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--6">
              <Compass size={36} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--7">
              <MapPin size={38} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--8">
              <UtensilsCrossed size={40} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--10">
              <Plane size={38} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--11">
              <Map size={36} strokeWidth={1.5} />
            </div>
            <div className="search-section__decoration search-section__decoration--12">
              <Building size={42} strokeWidth={1.5} />
            </div>

            <div className="category-filter">
              <button
                type="button"
                className={`category-filter__btn ${selectedCategory === "all" ? "active" : ""}`}
                onClick={() => setSelectedCategory("all")}
              >
                <span className="category-filter__icon">
                  <HomeIcon size={20} strokeWidth={2} />
                </span>
                <span className="category-filter__label">Buscar todo</span>
              </button>
              {categories.map((category) => {
                const config = CATEGORY_CONFIG[category];
                const IconComponent = config?.icon || Building;
                const label = config?.label || category.charAt(0).toUpperCase() + category.slice(1);

                return (
                  <button
                    key={category}
                    type="button"
                    className={`category-filter__btn ${selectedCategory === category ? "active" : ""}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    <span className="category-filter__icon">
                      <IconComponent size={20} strokeWidth={2} />
                    </span>
                    <span className="category-filter__label">{label}</span>
                  </button>
                );
              })}
            </div>

            <form className="searchBar home-hero__search" onSubmit={onSubmit}>
              <div className="search-input-wrapper">
                <span className="search-icon">
                  <Search size={20} strokeWidth={2} />
                </span>
                <input
                  placeholder="Buscar por ciudad o nombre. Ej: Tigre, Palermo..."
                  value={q}
                  onChange={e => setQ(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn--primary">
                Buscar
              </button>
            </form>
          </div>

          <ul className="home-hero__highlights">
            <li className="home-hero__highlight">
              <span className="highlight-icon">
                <CheckCircle2 size={14} strokeWidth={3} />
              </span>
              Reseñas verificadas por viajeros como vos
            </li>
            <li className="home-hero__highlight">
              <span className="highlight-icon">
                <CheckCircle2 size={14} strokeWidth={3} />
              </span>
              Filtros inteligentes para cada plan
            </li>
            <li className="home-hero__highlight">
              <span className="highlight-icon">
                <CheckCircle2 size={14} strokeWidth={3} />
              </span>
              Diseño claro y accesible para navegar sin esfuerzo
            </li>
          </ul>
        </section>

        <section className="featured-section">
          <div className="featured-section__header">
            <h2 className="featured-section__title">Destinos Destacados</h2>
            <p className="featured-section__subtitle">Descubrí los lugares más populares de nuestra comunidad</p>
          </div>
          <FeaturedCarousel />
        </section>

        {/* How It Works Section */}
        <section className="how-it-works">
          <div className="how-it-works__header">
            <h2 className="section-title">Cómo funciona</h2>
            <p className="section-subtitle">Tres pasos simples para tu próxima aventura</p>
          </div>
          <div className="how-it-works__grid">
            <div className="how-it-works__step">
              <div className="step-number">1</div>
              <div className="step-icon">
                <Compass size={32} strokeWidth={1.5} />
              </div>
              <h3 className="step-title">Explorá</h3>
              <p className="step-description">
                Buscá entre miles de destinos, hoteles y restaurantes recomendados por viajeros reales
              </p>
            </div>
            <div className="how-it-works__step">
              <div className="step-number">2</div>
              <div className="step-icon">
                <Camera size={32} strokeWidth={1.5} />
              </div>
              <h3 className="step-title">Descubrí</h3>
              <p className="step-description">
                Leé reseñas auténticas y mirá fotos de la comunidad para tomar la mejor decisión
              </p>
            </div>
            <div className="how-it-works__step">
              <div className="step-number">3</div>
              <div className="step-icon">
                <MessageSquare size={32} strokeWidth={1.5} />
              </div>
              <h3 className="step-title">Compartí</h3>
              <p className="step-description">
                Contá tu experiencia y ayudá a otros viajeros a vivir momentos inolvidables
              </p>
            </div>
          </div>
        </section>

        {/* Community Stats Section */}
        <section className="community-stats">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <MapPin size={28} strokeWidth={2} />
              </div>
              <div className="stat-content">
                <div className="stat-number">1000+</div>
                <div className="stat-label">Destinos</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Users size={28} strokeWidth={2} />
              </div>
              <div className="stat-content">
                <div className="stat-number">5000+</div>
                <div className="stat-label">Viajeros</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Heart size={28} strokeWidth={2} />
              </div>
              <div className="stat-content">
                <div className="stat-number">10K+</div>
                <div className="stat-label">Reseñas</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <TrendingUp size={28} strokeWidth={2} />
              </div>
              <div className="stat-content">
                <div className="stat-number">95%</div>
                <div className="stat-label">Satisfacción</div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="benefits-section">
          <div className="benefits-header">
            <h2 className="section-title">¿Por qué elegir ViajerosXP?</h2>
            <p className="section-subtitle">Tu comunidad de confianza para cada viaje</p>
          </div>
          <div className="benefits-grid">
            <div className="benefit-card">
              <div className="benefit-icon">
                <Users size={40} strokeWidth={1.5} />
              </div>
              <h3 className="benefit-title">Comunidad activa</h3>
              <p className="benefit-description">
                Miles de viajeros compartiendo experiencias reales y recomendaciones verificadas
              </p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <CheckCircle2 size={40} strokeWidth={1.5} />
              </div>
              <h3 className="benefit-title">Información confiable</h3>
              <p className="benefit-description">
                Todas nuestras reseñas son de usuarios verificados que realmente visitaron el lugar
              </p>
            </div>
            <div className="benefit-card">
              <div className="benefit-icon">
                <Map size={40} strokeWidth={1.5} />
              </div>
              <h3 className="benefit-title">Cobertura completa</h3>
              <p className="benefit-description">
                Desde destinos populares hasta joyas escondidas en todo el país
              </p>
            </div>
          </div>
        </section>
      </div>
      <VirtualAssistant />
    </>
  );
}