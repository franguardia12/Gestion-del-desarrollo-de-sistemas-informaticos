import requests
from typing import List, Dict, Optional
from settings import get_settings
import time

class LocationIQClient:
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.locationiq_api_key
        if not self.api_key:
            raise ValueError("LOCATIONIQ_API_KEY no está configurada")
        self.base_url = "https://us1.locationiq.com/v1"
        self.last_request_time = 0
        self.min_request_interval = 0.2  # 200ms entre requests
    
    def search_places(self, query: str, country: str = None, limit: int = 3) -> List[Dict]:
        """Busca lugares usando LocationIQ con rate limiting"""
        # Rate limiting simple
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time
        if time_since_last_request < self.min_request_interval:
            time.sleep(self.min_request_interval - time_since_last_request)
        
        self.last_request_time = time.time()
        
        try:
            params = {
                'key': self.api_key,
                'q': query,
                'format': 'json',
                'limit': limit,
                'addressdetails': 1,
                'dedupe': 1,
                'accept-language': 'es'
            }

            response = requests.get(f"{self.base_url}/search", params=params, timeout=5)
            
            if response.status_code == 429:
                print(f"Rate limit alcanzado para query: {query}. Esperando...")
                time.sleep(1)  # Esperar 1 segundo antes de reintentar
                return []
            elif response.status_code == 404:
                # No results found - no es un error, solo no hay resultados
                return []
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            print(f"Error en búsqueda LocationIQ: {e}")
            return []
    
    def geocode_address(self, address: Dict) -> Optional[Dict]:
        """Convierte una dirección en coordenadas"""
        try:
            address_str = self._build_address_string(address)
            params = {
                'key': self.api_key,
                'q': address_str,
                'format': 'json',
                'limit': 1
            }
            
            response = requests.get(f"{self.base_url}/search", params=params)
            response.raise_for_status()
            results = response.json()
            
            if results:
                return {
                    'latitude': float(results[0]['lat']),
                    'longitude': float(results[0]['lon'])
                }
            return None
        except Exception as e:
            print(f"Error en geocoding: {e}")
            return None
    
    def _build_address_string(self, address: Dict) -> str:
        """Construye string de dirección para geocoding"""
        parts = []
        if address.get('street') and address.get('street_number'):
            parts.append(f"{address['street']} {address['street_number']}")
        elif address.get('street'):
            parts.append(address['street'])
        
        if address.get('city_state'):
            parts.append(address['city_state'])
        
        if address.get('country'):
            parts.append(address['country'])
        
        return ", ".join(parts)

# Instancia global
try:
    locationiq_client = LocationIQClient()
except ValueError as e:
    print(f"Advertencia: {e}. El servicio de geocoding no estará disponible.")
    locationiq_client = None