import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PlaceCard, PlaceSummary } from "../components/PlaceCard/PlaceCard";
import { buildApiUrl, fetchJson } from "../lib/api";
import {
  Search,
  House,
  Calendar,
  DollarSign,
  Users,
  SlidersHorizontal,
  X
} from "lucide-react";

// Nota: La constante CATEGORY_OPTIONS ha sido eliminada.

type CategoryOption = {
  value: string;
  label: string;
};

type FormState = {
  q: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  checkIn: string;
  checkOut: string;
  guests: string; 
};

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<PlaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<"relevance" | "rating_desc" | "price_asc" | "price_desc" | "name_asc">("relevance");

  // 🚨 NUEVO ESTADO: Para guardar las opciones de categoría que vienen de la API 🚨
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([
    { value: "", label: "Todas" },
    { value: "lodging", label: "Alojamientos" },     // Usar el valor exacto de la DB
    { value: "experience", label: "Hoteles" },      // Usar el valor exacto de la DB
    { value: "restaurantes", label: "Restaurantes" }        // Usar el valor exacto de la DB
]);

  const q = params.get("q") || "";
  const category = params.get("category") || "";
  const minPrice = params.get("min_price") || "";
  const maxPrice = params.get("max_price") || "";
  const checkIn = params.get("check_in") || "";
  const checkOut = params.get("check_out") || "";
  const guests = params.get("guests") || "";

  const [form, setForm] = useState<FormState>({
    q,
    category,
    minPrice,
    maxPrice,
    checkIn,
    checkOut,
    guests,
  });

  // Sincroniza el estado del formulario con los parámetros de la URL
  useEffect(() => {
    setForm({
      q,
      category,
      minPrice,
      maxPrice,
      checkIn,
      checkOut,
      guests,
    });
  }, [q, category, minPrice, maxPrice, checkIn, checkOut, guests]);

  // 🚨 NUEVO useEffect: Carga las categorías desde el Backend 🚨
  useEffect(() => {
    async function loadCategories() {
      const url = buildApiUrl("/api/places/categories");

      try {
        // Hacemos la petición GET que devuelve un array de strings (ej: ["hotel", "restaurante", "alojamiento"])
        const categories = await fetchJson<string[]>(url);

        // Mapeo de categorías a sus plurales en español
        const labelMap: Record<string, string> = {
          hotel: "Hoteles",
          restaurante: "Restaurantes",
          alojamiento: "Alojamientos"
        };

        // Mapeamos los strings al formato que necesita el <select>
        const options: CategoryOption[] = categories.map(cat => ({
          value: cat,
          label: labelMap[cat] || cat.charAt(0).toUpperCase() + cat.slice(1)
        }));

        // Establecemos las opciones, asegurando que 'Todas' esté siempre al inicio
        setCategoryOptions([{ value: "", label: "Todas" }, ...options]);

      } catch (err: unknown) {
        console.error("Error al cargar categorías:", err);
      }
    }
    loadCategories();
  }, []); // El array vacío asegura que la carga solo ocurra una vez al montar

  // useEffect existente: Carga los resultados de la búsqueda
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    const url = buildApiUrl("/api/search", {
      q: q || undefined,
      category: category || undefined,
      min_price: minPrice || undefined,
      max_price: maxPrice || undefined,
      check_in: checkIn || undefined,
      check_out: checkOut || undefined,
      guests: guests || undefined,
    });

    fetchJson<PlaceSummary[]>(url)
      .then(setItems)
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Ocurrió un error al cargar los resultados.";
        setError(message);
        setItems([]);
      })
      .finally(() => setIsLoading(false));
  }, [q, category, minPrice, maxPrice, checkIn, checkOut, guests]);

  function updateParams(nextState: FormState) {
    const next = new URLSearchParams();
    if (nextState.q.trim()) next.set("q", nextState.q.trim());
    if (nextState.category) next.set("category", nextState.category);
    if (nextState.minPrice) next.set("min_price", nextState.minPrice);
    if (nextState.maxPrice) next.set("max_price", nextState.maxPrice);
    if (nextState.checkIn) next.set("check_in", nextState.checkIn);
    if (nextState.checkOut) next.set("check_out", nextState.checkOut);
    if (nextState.guests) next.set("guests", nextState.guests);
    setParams(next, { replace: true });
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateParams(form);
  }

  function handleReset() {
    const cleared: FormState = { q: "", category: "", minPrice: "", maxPrice: "", checkIn: "", checkOut: "" , guests: ""};
    setForm(cleared);
    updateParams(cleared);
  }

  function clearFilter(field: keyof FormState) {
    const next = { ...form, [field]: "" };
    setForm(next);
    updateParams(next);
  }

  const hasNoResults = !isLoading && !error && items.length === 0;
  const activeCategoryLabel =
    categoryOptions.find(opt => opt.value === category)?.label ?? null;
  const hasActiveFilters =
    Boolean(q || category || minPrice || maxPrice || checkIn || checkOut || guests);

  const displayedItems = useMemo(() => {
    const list = [...items];
    switch (sortOption) {
      case "rating_desc":
        return list.sort((a, b) => (b.rating_avg ?? 0) - (a.rating_avg ?? 0));
      case "price_asc":
        return list.sort(
          (a, b) =>
            (a.price_per_night ?? Number.POSITIVE_INFINITY) -
            (b.price_per_night ?? Number.POSITIVE_INFINITY)
        );
      case "price_desc":
        return list.sort(
          (a, b) => (b.price_per_night ?? 0) - (a.price_per_night ?? 0)
        );
      case "name_asc":
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case "relevance":
      default:
        return list;
    }
  }, [items, sortOption]);

  const resultsLabel = isLoading
    ? "Cargando..."
    : `${items.length} resultado${items.length === 1 ? "" : "s"}`;

  // -------------------------------------------------------------
  // El return debe ir aquí, usando categoryOptions.map
  // -------------------------------------------------------------


return (
    <div className="container page">
      <div className="search-results__header">
        <div className="search-results__title">
          <p className="search-results__eyebrow">Explorá resultados</p>
          <p className="search-results__meta">
            {hasActiveFilters
              ? `Filtrando ${q ? `por “${q}”` : "la búsqueda"}${activeCategoryLabel ? ` · ${activeCategoryLabel}` : ""} · ${resultsLabel}`
              : `Mostrando todos los lugares disponibles · ${resultsLabel}`}
          </p>
        </div>
        <div className="search-results__actions">
          <label className="search-results__sort">
            <span>Ordenar</span>
            <select
              value={sortOption}
              onChange={e => setSortOption(e.target.value as typeof sortOption)}
            >
              <option value="relevance">Relevancia</option>
              <option value="rating_desc">Mejor puntuados</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name_asc">Nombre A-Z</option>
            </select>
          </label>
        </div>
      </div>

      <form className="filters filters--enhanced" onSubmit={handleSubmit} onReset={handleReset}>
        <div className="filters__header">
          <div className="filters__title">
            <SlidersHorizontal size={20} strokeWidth={2} />
            <span>Refinar búsqueda</span>
          </div>
        </div>

        {/* Primera fila: Búsqueda (más ancha), Categoría, Huéspedes */}
        <div
          className="filters-group"
          style={{
            display: 'grid',
            gridTemplateColumns: '2.06fr 1fr 1fr',
            gap: '1em',
            alignItems: 'end'
          }}
        >
          <label className="filter-input-wrapper">
            <span className="filter-label">
              <Search size={16} strokeWidth={2} />
              Búsqueda
            </span>
            <div className="input-with-icon">
              <input
                name="q"
                value={form.q}
                onChange={(e) => setForm((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="Ej: Tigre, Palermo..."
              />
            </div>
          </label>
          <label className="filter-input-wrapper">
            <span className="filter-label">
              <House size={16} strokeWidth={2} />
              Categoría
            </span>
            <select
              name="category"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-input-wrapper">
            <span className="filter-label">
              <Users size={16} strokeWidth={2} />
              Huéspedes
            </span>
            <input
              name="guests"
              type="number"
              min="1"
              value={form.guests}
              onChange={(e) => setForm((prev) => ({ ...prev, guests: e.target.value }))}
              placeholder="Ej: 2"
            />
          </label>
        </div>

        {/* Segunda fila: Check-in, Check-out, Precio mínimo, Precio máximo */}
        <div
          className="filters-group"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '1rem',
            alignItems: 'end'
          }}
        >
          <label className="filter-input-wrapper">
            <span className="filter-label">
              <Calendar size={16} strokeWidth={2} />
              Check-in
            </span>
            <input
              name="check_in"
              type="date"
              value={form.checkIn}
              onChange={(e) => setForm((prev) => ({ ...prev, checkIn: e.target.value }))}
            />
          </label>
          <label className="filter-input-wrapper">
            <span className="filter-label">
              <Calendar size={16} strokeWidth={2} />
              Check-out
            </span>
            <input
              name="check_out"
              type="date"
              value={form.checkOut}
              onChange={(e) => setForm((prev) => ({ ...prev, checkOut: e.target.value }))}
            />
          </label>
          <label className="filter-input-wrapper">
            <span className="filter-label">
              <DollarSign size={16} strokeWidth={2} />
              Precio mínimo
            </span>
            <input
              name="min_price"
              type="number"
              min={0}
              value={form.minPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, minPrice: e.target.value }))}
              placeholder="Min"
            />
          </label>
          <label className="filter-input-wrapper">
            <span className="filter-label">
              <DollarSign size={16} strokeWidth={2} />
              Precio máximo
            </span>
            <input
              name="max_price"
              type="number"
              min={0}
              value={form.maxPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, maxPrice: e.target.value }))}
              placeholder="Max"
            />
          </label>
        </div>

        {/* Botones */}
        <div className="filters-actions" style={{
          display: 'flex',
          gap: '1rem',
          justifyContent: 'flex-end',
          marginTop: '0.5rem'
        }}>
          <button type="submit" className="btn btn--primary">
            <Search size={18} strokeWidth={2} />
            Aplicar filtros
          </button>
          <button type="reset" className="btn btn--outline">
            <X size={18} strokeWidth={2} />
            Limpiar
          </button>
        </div>
      </form>

      {hasActiveFilters ? (
        <div className="filter-chips">
          {q ? (
            <button type="button" className="filter-chip" onClick={() => clearFilter("q")}>
              Búsqueda: “{q}” <span aria-hidden>×</span>
            </button>
          ) : null}
          {category ? (
            <button type="button" className="filter-chip" onClick={() => clearFilter("category")}>
              {activeCategoryLabel ?? category} <span aria-hidden>×</span>
            </button>
          ) : null}
          {guests ? (
            <button type="button" className="filter-chip" onClick={() => clearFilter("guests")}>
              Huéspedes: {guests} <span aria-hidden>×</span>
            </button>
          ) : null}
          {checkIn ? (
            <button type="button" className="filter-chip" onClick={() => clearFilter("checkIn")}>
              Check-in: {checkIn} <span aria-hidden>×</span>
            </button>
          ) : null}
          {checkOut ? (
            <button type="button" className="filter-chip" onClick={() => clearFilter("checkOut")}>
              Check-out: {checkOut} <span aria-hidden>×</span>
            </button>
          ) : null}
          {minPrice ? (
            <button type="button" className="filter-chip" onClick={() => clearFilter("minPrice")}>
              Min ${minPrice} <span aria-hidden>×</span>
            </button>
          ) : null}
          {maxPrice ? (
            <button type="button" className="filter-chip" onClick={() => clearFilter("maxPrice")}>
              Max ${maxPrice} <span aria-hidden>×</span>
            </button>
          ) : null}
          <button type="button" className="filter-chip filter-chip--clear" onClick={handleReset}>
            Limpiar todo
          </button>
        </div>
      ) : null}

      {error ? <div className="notice error">{error}</div> : null}
      {hasNoResults ? <div className="notice muted">No encontramos resultados para tu búsqueda.</div> : null}

      <div className="grid results-grid">
        {isLoading
          ? Array.from({ length: 3 }, (_, idx) => (
              <div key={idx} className="card skeleton" aria-hidden="true">
                <div className="skeleton-image" />
                <div className="skeleton-content">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line" />
                </div>
              </div>
            ))
          : displayedItems.map((place) => <PlaceCard key={place.id} place={place} />)}
      </div>
    </div>
  );
}
