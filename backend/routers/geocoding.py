from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from geocoding import locationiq_client
from pydantic import BaseModel

router = APIRouter(prefix="/api/places/autocomplete", tags=["autocomplete"])

class ValidateAddressRequest(BaseModel):
    country: str
    city_state: str
    street: Optional[str] = None
    street_number: Optional[str] = None

@router.post("/validate-address")
async def validate_address(address_data: ValidateAddressRequest):
    if not locationiq_client:
        raise HTTPException(status_code=500, detail="Servicio de geocoding no configurado")
    
    # Construir la dirección en formato que LocationIQ entienda mejor
    address_parts = []
    
    if address_data.street_number and address_data.street:
        address_parts.append(f"{address_data.street_number} {address_data.street}")
    elif address_data.street:
        address_parts.append(address_data.street)
    
    address_parts.append(address_data.city_state)
    address_parts.append(address_data.country)
    
    address_query = ", ".join(address_parts)
    
    print(f"Buscando dirección: {address_query}")
    
    # Hacer la búsqueda
    results = locationiq_client.search_places(address_query, limit=1)
    
    if not results:
        return {"coordinates": None, "message": "No se encontró la dirección"}
    
    first_result = results[0]
    lat = first_result.get('lat')
    lon = first_result.get('lon')
    display_name = first_result.get('display_name', 'Ubicación encontrada')
    
    if not lat or not lon:
        return {"coordinates": None, "message": "No se pudieron obtener coordenadas"}
    
    return {
        "coordinates": {
            "latitude": float(lat),
            "longitude": float(lon)
        },
        "full_address": display_name,
        "message": "Dirección encontrada correctamente"
    }

# Mantenemos los endpoints de autocomplete simples para países como fallback
@router.get("/countries")
async def autocomplete_countries(
    query: str = Query(..., min_length=1, description="Texto para buscar países")
):
    if not locationiq_client:
        raise HTTPException(status_code=500, detail="Servicio de geocoding no configurado")
    
    results = locationiq_client.search_places(query, limit=5)
    countries = []
    
    for result in results:
        address = result.get('address', {})
        country = address.get('country')
        if country and not any(c['name'] == country for c in countries):
            countries.append({
                'name': country,
                'code': address.get('country_code', '').upper()
            })
    
    # Ordenar alfabéticamente y devolver máximo 3
    countries.sort(key=lambda x: x['name'])
    return countries[:3]
    
# Buenas, te comento, estoy haciendo un trabajo práctico y la idea es hacer una especie TripAdvisor, por ahora con los chicos del grupo ya hicimos lo siguiente:
# registro
# iniciar sesión
# cerrar sesión
# ver el perfil
# publicar establecimiento
# editar datos básicos del establecimiento
# cargar ubicación del establecimiento
# Particularmente yo hice lo de cargar ubicación del establecimiento. La cosa es que ahora lo quiero cambiar un poco, más bien agregar algo. Porque te comento, lo próximo a hacer son filtros de los lugares y a mí me tocó del establecimiento, actualmente para cargar ubicación del establecimiento, se hace llenando unos campos de: País, Ciudad y Estado/Provincia, Calle y Número. Que actualmente funciona, y al darselo a una API (LocationIQ) devuelve las coordenadas, una mapa y una dirección más completa. Lo que quiero hacer ahora es guardarme esa dirección completa parseada ¿Cómo? Así. Con un ejemplo te lo muestro, al poner la información así:
# Ubicación
# País: Argentina
# Ciudad y Estado/Provincia: CABA
# Calle: Corrientes
# Número: 900
# Además del mapa (para que el usuario verifique que es donde quiere), se muestra la dirección completa esta: "900, Avenida Corrientes, Microcentro, San Nicolás, Buenos Aires, Comuna 1, Ciudad Autónoma de Buenos Aires, C1043AAV, Argentina". Como ves al final está el país (Argentina), antes unos numeros raros que no me importan (C1043AAV), luego varios lugares (Microcentro, San Nicolás, Buenos Aires, Comuna 1, Ciudad Autónoma de Buenos Aires), luego la calle (Avenida Corrientes) y finalmente el número(900). Entonces la idea es agarrar esto, dividirlo y guardarlo como algo de país_para_filtrar = Argentina
# Ciudad_y_Estado/Provincia_para_filtar = Microcentro, San Nicolás, Buenos Aires, Comuna 1, Ciudad Autónoma de Buenos Aires
# Calle_para_filtar = Avenida Corrientes
# Entonces esos 3 campos solo se usarían para filtrar, serían cosas internar para estandarizar la búsqueda, osea hay gente que pondrá su establecimiento como CABA, otros como Buenos Aires u otros como Ciudad Autónoma de Buenos Aires, o de otra forma... Lo importante es que quizas todos esos hablan de estableciemientos en el mismo lugar y la idea es que se pueda filtrar todos bien sin problema, para eso se usarían esos campos. Luego los otros (los que ingresa el usuario), querían para mostrarlos al ver el detalle del lugar y para "inpuetarlos" (hacer imput) y ver el mapra tambíen en el detalle del lugar así como se ve a la hora de crear el establecimiento.

# Ahora te paso mis archivos que tienen que ver con esto para que me digas que hacer.



