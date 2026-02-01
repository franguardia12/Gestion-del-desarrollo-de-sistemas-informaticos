import { useState, useEffect, useRef, useCallback } from 'react';
import { buildApiUrl } from '../lib/api';

interface LocationAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  endpoint: string;
  queryParams?: Record<string, string>;
  minChars?: number;
}

interface Suggestion {
  name: string;
  code?: string;
}

export default function LocationAutocomplete({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  endpoint,
  queryParams = {},
  minChars = 1
}: LocationAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number>(); // Cambiado a number

  // Función para fetch con memoización
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < minChars || query === lastQuery) {
      return;
    }

    setIsLoading(true);
    setLastQuery(query);
    
    try {
      const params = new URLSearchParams({
        query: query,
        ...queryParams
      }).toString();

      const response = await fetch(buildApiUrl(`${endpoint}?${params}`));
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data);
      } else {
        setSuggestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, queryParams, minChars, lastQuery]);

  // Efecto con debounce mejorado
  useEffect(() => {
    // Limpiar el timeout anterior
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Si el input está vacío o tiene menos de minChars, limpiar sugerencias
    if (value.length < minChars) {
      setSuggestions([]);
      setLastQuery('');
      return;
    }

    // Si el valor actual es igual al último query, no hacer nada
    if (value === lastQuery) {
      return;
    }

    // Solo hacer fetch si el valor ha cambiado y cumple los requisitos
    debounceRef.current = window.setTimeout(() => {
      fetchSuggestions(value);
    }, 400); // Aumentado a 400ms para reducir requests

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchSuggestions, minChars, lastQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Mostrar sugerencias solo si hay texto
    if (newValue.length >= minChars) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    onChange(suggestion.name);
    setShowSuggestions(false);
    setSuggestions([]); // Limpiar sugerencias después de seleccionar
    setLastQuery(suggestion.name); // Marcar como último query
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Pequeño delay para permitir hacer click en las sugerencias
    setTimeout(() => {
      setShowSuggestions(false);
    }, 200);
  };

  const handleFocus = () => {
    // Solo mostrar sugerencias si ya hay un valor y no estamos cargando
    if (value.length >= minChars && !isLoading) {
      setShowSuggestions(true);
    }
  };

  // Determinar si debemos mostrar el dropdown
  const shouldShowDropdown = showSuggestions && (suggestions.length > 0 || isLoading);

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <label htmlFor={label} style={{ fontWeight: '500' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          id={label}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '8px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        />
        
        {shouldShowDropdown && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {isLoading ? (
              <div style={{ padding: '8px 12px', color: '#666' }}>Cargando...</div>
            ) : suggestions.length > 0 ? (
              suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0',
                    backgroundColor: suggestion.name === value ? '#f0f0f0' : 'white'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {suggestion.name}
                </div>
              ))
            ) : (
              <div style={{ padding: '8px 12px', color: '#666', fontStyle: 'italic' }}>
                No se encontraron resultados
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}