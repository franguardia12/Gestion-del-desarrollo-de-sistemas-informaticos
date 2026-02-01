import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { buildApiUrl } from "../lib/api";
import { Button } from "../components/Button";
import { DayPicker, DateRange } from "react-day-picker";
import { format } from "date-fns";
import "react-day-picker/style.css";
import { useDialog } from "../contexts/DialogContext";

type CreatePlaceData = {
  name: string;
  country: string;
  city_state: string;
  street: string;
  street_number: string;
  category: string;
  description: string;
  capacity: string;
  price_per_night: string;
};

type UnavailabilityRange = {
  start_date: string;
  end_date: string;
};

type ScheduleDay = {
  day_of_week: number; // 0=Monday, 6=Sunday
  opening_time: string | null;
  closing_time: string | null;
  is_closed: boolean;
};

export default function CreatePlace() {
  const navigate = useNavigate();
  const { alert: showAlert } = useDialog();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Estados para la validación de ubicación
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [foundLocation, setFoundLocation] = useState<{lat: number, lng: number, address: string} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Estados para fechas no disponibles
  const [unavailabilities, setUnavailabilities] = useState<UnavailabilityRange[]>([]);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();

  // Estados para horarios
  const [schedules, setSchedules] = useState<ScheduleDay[]>([]);
  const [hasSchedules, setHasSchedules] = useState(false);

  const [formData, setFormData] = useState<CreatePlaceData>({
    name: "",
    country: "",
    city_state: "",
    street: "",
    street_number: "",
    category: "",
    description: "",
    capacity: "",
    price_per_night: "",
  });

  // Obtener la API Key desde las variables de entorno
  const locationiqApiKey = import.meta.env.VITE_LOCATIONIQ_API_KEY;

  // Cargar categorías desde la API
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
        // Fallback to empty array if API fails
        setCategories([]);
      }
    }
    loadCategories();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newPhotos = Array.from(e.target.files);
      setPhotos(prev => [...prev, ...newPhotos]);

      // Crear previews para mostrar
      newPhotos.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoPreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Manejadores para fechas no disponibles
  const handleAddUnavailability = () => {
    if (selectedRange?.from && selectedRange?.to) {
      const newUnavailability: UnavailabilityRange = {
        start_date: format(selectedRange.from, "yyyy-MM-dd"),
        end_date: format(selectedRange.to, "yyyy-MM-dd"),
      };
      setUnavailabilities(prev => [...prev, newUnavailability]);
      setSelectedRange(undefined); // Limpiar selección
    }
  };

  const removeUnavailability = (index: number) => {
    setUnavailabilities(prev => prev.filter((_, i) => i !== index));
  };

  // Manejadores para horarios
  const daysOfWeek = [
    { value: 0, label: "Lunes" },
    { value: 1, label: "Martes" },
    { value: 2, label: "Miércoles" },
    { value: 3, label: "Jueves" },
    { value: 4, label: "Viernes" },
    { value: 5, label: "Sábado" },
    { value: 6, label: "Domingo" },
  ];

  const handleScheduleChange = (dayOfWeek: number, field: keyof ScheduleDay, value: string | boolean) => {
    setSchedules(prev => {
      const existingIndex = prev.findIndex(s => s.day_of_week === dayOfWeek);

      if (existingIndex >= 0) {
        // Update existing schedule
        return prev.map((schedule, i) =>
          i === existingIndex ? { ...schedule, [field]: value } : schedule
        );
      } else {
        // Create new schedule if it doesn't exist
        const newSchedule: ScheduleDay = {
          day_of_week: dayOfWeek,
          opening_time: field === "opening_time" ? value as string : "09:00",
          closing_time: field === "closing_time" ? value as string : "17:00",
          is_closed: field === "is_closed" ? value as boolean : false,
        };
        return [...prev, newSchedule].sort((a, b) => a.day_of_week - b.day_of_week);
      }
    });
  };

  const getScheduleForDay = (dayOfWeek: number): ScheduleDay | undefined => {
    return schedules.find(s => s.day_of_week === dayOfWeek);
  };

  // Función para buscar la ubicación
  const searchLocation = async () => {
    if (!formData.country || !formData.city_state) {
      setLocationError("País y ciudad/estado son obligatorios");
      return;
    }

    setIsSearchingLocation(true);
    setLocationError(null);

    try {
      const response = await fetch(buildApiUrl("/api/places/autocomplete/validate-address"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          country: formData.country,
          city_state: formData.city_state,
          street: formData.street,
          street_number: formData.street_number,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al buscar la ubicación");
      }

      const result = await response.json();
      
      if (result.coordinates) {
        setFoundLocation({
          lat: result.coordinates.latitude,
          lng: result.coordinates.longitude,
          address: result.full_address
        });
        setLocationError(null);
      } else {
        setLocationError("No se pudo encontrar la ubicación. Verifica los datos.");
        setFoundLocation(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido al buscar ubicación";
      setLocationError(message);
      setFoundLocation(null);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // 1. Crear el establecimiento
      const placeResponse = await fetch(buildApiUrl("/api/places/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name,
          country: formData.country || undefined,
          city_state: formData.city_state || undefined,
          street: formData.street || undefined,
          street_number: formData.street_number || undefined,
          category: formData.category || undefined,
          description: formData.description || undefined,
          capacity: formData.capacity ? parseInt(formData.capacity) : undefined,
          price_per_night: formData.price_per_night ? parseFloat(formData.price_per_night) : undefined,
          latitude: foundLocation?.lat || undefined,
          longitude: foundLocation?.lng || undefined,
          full_address: foundLocation?.address || undefined,
          unavailabilities: unavailabilities.length > 0 ? unavailabilities : undefined,
          schedules: schedules.length > 0 ? schedules : undefined,
        }),
      });

      if (!placeResponse.ok) {
        if (placeResponse.status === 403) {
          throw new Error("No tienes permisos para publicar establecimientos. Debes ser un propietario.");
        }
        if (placeResponse.status === 401) {
          throw new Error("Debes iniciar sesión para publicar establecimientos.");
        }
        throw new Error("Error al crear el establecimiento");
      }

      const placeResult = await placeResponse.json();
      const placeId = placeResult.id;

      // 2. Si hay fotos, subirlas
      if (photos.length > 0) {
        const formDataPhotos = new FormData();
        photos.forEach(photo => {
          formDataPhotos.append("photos", photo);
        });

        const photosResponse = await fetch(buildApiUrl(`/api/places/${placeId}/photos`), {
          method: "POST",
          credentials: "include",
          body: formDataPhotos,
        });

        if (!photosResponse.ok) {
          console.warn("Las fotos no se pudieron subir, pero el lugar fue creado");
        }
      }

      await showAlert(`Se publicó tu establecimiento "${formData.name}".`);
      // 3. Redirigir a la página del lugar creado
      navigate(`/places/${placeId}`);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido al crear el establecimiento";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    fontSize: "15px",
    transition: "all 0.3s ease",
    outline: "none",
    boxSizing: "border-box" as const,
  };

  const labelStyle = {
    display: "block",
    marginBottom: "8px",
    color: "#333",
    fontWeight: "500",
    fontSize: "14px",
  };

  return (
    <div className="container page">
      <Link to="/" className="back-link" style={{ marginBottom: "12px", display: "inline-block" }}>
        ← Volver al inicio
      </Link>
      <div style={{ maxWidth: 600, margin: "0 auto", position: "relative" }}>
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,255,255,0.75)",
              backdropFilter: "blur(2px)",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              borderRadius: 16,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                border: "5px solid #00eb5b",
                borderTopColor: "#0b3d2c",
                animation: "spin 0.9s linear infinite",
              }}
            />
            <span style={{ fontWeight: 600, color: "#0b3d2c" }}>Publicando establecimiento...</span>
          </div>
        )}
        <h1 style={{
          fontSize: "32px",
          fontWeight: "600",
          color: "#1a1a1a",
          marginBottom: "24px"
        }}>
          Publicar Nuevo Establecimiento
        </h1>

        {error && (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px 16px",
              backgroundColor: "#f8d7da",
              color: "#721c24",
              borderRadius: "12px",
              fontSize: "14px",
              border: "1px solid #f5c6cb"
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
          {/* Nombre */}
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="name" style={labelStyle}>
              Nombre del establecimiento *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isLoading}
              placeholder="Ej: Casa en la montaña"
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />
          </div>

          {/* Ubicación */}
          <div style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "1.1rem", color: "#333" }}>Ubicación</h3>
            
            {/* País */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="country" style={labelStyle}>
                País
              </label>
              <input
                type="text"
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="Ej: Argentina"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />
            </div>

            {/* Ciudad/Estado */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="city_state" style={labelStyle}>
                Ciudad y Estado/Provincia
              </label>
              <input
                type="text"
                id="city_state"
                name="city_state"
                value={formData.city_state}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="Ej: CABA"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />
            </div>

            {/* Calle */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="street" style={labelStyle}>
                Calle
              </label>
              <input
                type="text"
                id="street"
                name="street"
                value={formData.street}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="Ej: Av. Corrientes"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />
            </div>

            {/* Número */}
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="street_number" style={labelStyle}>
                Número
              </label>
              <input
                type="text"
                id="street_number"
                name="street_number"
                value={formData.street_number}
                onChange={handleChange}
                disabled={isLoading}
                placeholder="Ej: 1234"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />
            </div>

            {/* Botón de búsqueda de ubicación */}
            {formData.country && formData.city_state && (
              <div style={{ marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={searchLocation}
                  disabled={isSearchingLocation}
                  style={{
                    padding: "10px 16px",
                    backgroundColor: "#007bff",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "14px"
                  }}
                >
                  {isSearchingLocation ? "Buscando ubicación..." : "Buscar en Mapa"}
                </button>
                
                {locationError && (
                  <div style={{ color: "red", marginTop: "8px", fontSize: "14px" }}>
                    {locationError}
                  </div>
                )}
                
                {foundLocation && (
                  <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#f8f9fa", borderRadius: "8px" }}>
                    <p style={{ margin: "0 0 12px 0", fontWeight: "500" }}>
                      ✅ Ubicación encontrada: 
                    </p>
                    <p style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#666" }}>
                      {foundLocation.address}
                    </p>
                    {locationiqApiKey ? (
                      <div style={{ height: "200px", width: "100%", marginTop: "12px", position: "relative" }}>
                        <img 
                          src={`https://maps.locationiq.com/v3/staticmap?key=${locationiqApiKey}&center=${foundLocation.lat},${foundLocation.lng}&zoom=15&size=600x200&format=png&markers=icon:small-red-cutlet|${foundLocation.lat},${foundLocation.lng}`}
                          alt="Mapa de la ubicación"
                          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "4px" }}
                          onError={(e) => {
                            // Si falla la imagen del mapa, mostrar un mensaje
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                              const errorDiv = document.createElement('div');
                              errorDiv.innerHTML = `
                                <div style="text-align: center; padding: 20px; color: #666;">
                                  <p>⚠️ No se pudo cargar el mapa</p>
                                  <p style="font-size: 12px;">Coordenadas: ${foundLocation.lat.toFixed(6)}, ${foundLocation.lng.toFixed(6)}</p>
                                  <a href="https://www.openstreetmap.org/?mlat=${foundLocation.lat}&mlon=${foundLocation.lng}#map=15/${foundLocation.lat}/${foundLocation.lng}" 
                                    target="_blank" 
                                    style="color: #007bff; text-decoration: none;">
                                    Ver en OpenStreetMap
                                  </a>
                                </div>
                              `;
                              parent.appendChild(errorDiv);
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ textAlign: "center", padding: "20px", color: "#666", backgroundColor: "#fff3cd", borderRadius: "4px" }}>
                        <p>⚠️ API Key de LocationIQ no configurada</p>
                        <p style={{ fontSize: "12px" }}>Coordenadas: {foundLocation.lat.toFixed(6)}, {foundLocation.lng.toFixed(6)}</p>
                      </div>
                    )}
                    <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
                      Coordenadas: {foundLocation.lat.toFixed(6)}, {foundLocation.lng.toFixed(6)}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Categoría */}
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="category" style={labelStyle}>
              Categoría
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              disabled={isLoading}
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            >
              <option value="">Seleccionar categoría</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="description" style={labelStyle}>
              Descripción
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              disabled={isLoading}
              rows={4}
              placeholder="Describe tu establecimiento..."
              style={{
                ...inputStyle,
                resize: "vertical" as const,
                minHeight: "100px",
              }}
              onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
              onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
            />
          </div>

          {/* Capacidad y Precio */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="capacity" style={labelStyle}>
                Capacidad (huéspedes)
              </label>
              <input
                type="number"
                id="capacity"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                disabled={isLoading}
                min="1"
                placeholder="Ej: 4"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="price_per_night" style={labelStyle}>
                Precio por noche
              </label>
              <input
                type="number"
                id="price_per_night"
                name="price_per_night"
                value={formData.price_per_night}
                onChange={handleChange}
                disabled={isLoading}
                min="0"
                step="0.01"
                placeholder="Ej: 75.00"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = "#00eb5b"}
                onBlur={(e) => e.target.style.borderColor = "#e0e0e0"}
              />
            </div>
          </div>

          {/* Fotos */}
          <div style={{ marginBottom: "20px" }}>
            <label htmlFor="photos" style={labelStyle}>
              Fotos del establecimiento
            </label>
            <input
              type="file"
              id="photos"
              multiple
              accept="image/*"
              onChange={handlePhotoChange}
              disabled={isLoading}
              style={{
                ...inputStyle,
                cursor: "pointer",
                paddingTop: "10px",
                paddingBottom: "10px",
              }}
            />
            <small style={{ color: "#666", fontSize: "12px", marginTop: "4px", display: "block" }}>
              Puedes seleccionar múltiples fotos (máximo 10)
            </small>

            {/* Previews de fotos */}
            {photoPreviews.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 8, marginTop: 12 }}>
                {photoPreviews.map((preview, index) => (
                  <div key={index} style={{ position: "relative" }}>
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      style={{
                        width: "100%",
                        height: 80,
                        objectFit: "cover",
                        borderRadius: 8
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        background: "red",
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: 20,
                        height: 20,
                        fontSize: 12,
                        cursor: "pointer"
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fechas no disponibles */}
          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>
              Fechas no disponibles (opcional)
            </label>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
              Selecciona períodos en los que el establecimiento no estará disponible para reservas (mantenimiento, uso personal, etc.)
            </p>

            <div style={{
              border: "2px solid #e0e0e0",
              borderRadius: "12px",
              padding: "20px",
              backgroundColor: "#fafafa",
              display: selectedRange?.from && selectedRange?.to ? "grid" : "inline-block",
              gridTemplateColumns: "auto 1fr",
              gap: "20px",
              alignItems: "start"
            }}>
              <DayPicker
                mode="range"
                selected={selectedRange}
                onSelect={setSelectedRange}
                disabled={{ before: new Date() }}
              />

              {selectedRange?.from && selectedRange?.to && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  padding: "20px"
                }}>
                  <p style={{ marginBottom: "16px", color: "#333", fontSize: "14px", textAlign: "center" }}>
                    <strong>Período seleccionado:</strong><br />
                    {format(selectedRange.from, "dd/MM/yyyy")} - {format(selectedRange.to, "dd/MM/yyyy")}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddUnavailability}
                    style={{
                      padding: "10px 20px",
                      backgroundColor: "#00eb5b",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "500"
                    }}
                  >
                    Agregar período
                  </button>
                </div>
              )}
            </div>

            {/* Lista de períodos agregados */}
            {unavailabilities.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <p style={{ ...labelStyle, marginBottom: "12px" }}>
                  Períodos bloqueados ({unavailabilities.length}):
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {unavailabilities.map((unavail, index) => (
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
                        📅 {new Date(unavail.start_date + 'T00:00:00').toLocaleDateString("es-ES", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric"
                        })} - {new Date(unavail.end_date + 'T00:00:00').toLocaleDateString("es-ES", {
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
          </div>

          {/* Horarios de apertura */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <input
                type="checkbox"
                checked={hasSchedules}
                onChange={(e) => {
                  setHasSchedules(e.target.checked);
                  if (!e.target.checked) {
                    setSchedules([]);
                  } else {
                    // Initialize all days with default schedules (open 09:00-17:00)
                    setSchedules(daysOfWeek.map(day => ({
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
                <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
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
                  {daysOfWeek.map(day => {
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
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Botón de envío */}
          <Button
            type="submit"
            disabled={isLoading || !formData.name.trim()}
            variant="primary"
            style={{ width: "100%", marginTop: "8px" }}
          >
            {isLoading ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: "50%",
                    border: "3px solid rgba(255,255,255,0.4)",
                    borderTopColor: "#fff",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Publicando...
              </span>
            ) : (
              "Publicar Establecimiento"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
