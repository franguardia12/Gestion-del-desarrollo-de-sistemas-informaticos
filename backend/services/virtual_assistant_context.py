from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class KnowledgeChunk:
    id: str
    keywords: tuple[str, ...]
    text: str


AI_KNOWLEDGE_BASE: tuple[KnowledgeChunk, ...] = (
    KnowledgeChunk(
        id="platform_overview",
        keywords=("viajerosxp", "asistente", "general"),
        text=(
            "ViajerosXP es una plataforma donde las personas buscan hoteles, restaurantes y alojamientos, publican sus "
            "propios establecimientos y comparten reseñas con fotos y puntuaciones. Toda la experiencia se centra en una "
            "home con filtros claros, fichas de detalle completas y perfiles editables para la demo."
        ),
    ),
    KnowledgeChunk(
        id="search_and_filters",
        keywords=(
            "buscar",
            "busqueda",
            "filtro",
            "hotel",
            "restaurante",
            "alojamiento",
            "precio",
            "fecha",
            "check",
            "huésped",
            "huesped",
            "categoria",
            "nombre",
        ),
        text=(
            "En la home se puede alternar entre hoteles, restaurantes, alojamientos o buscar en los tres. Los filtros "
            "habilitados son: check-in y check-out, precio mínimo/máximo, cantidad de huéspedes, categoría, y texto libre "
            "por nombre o ciudad. El resultado lleva al detalle del establecimiento."
        ),
    ),
    KnowledgeChunk(
        id="profile_edit",
        keywords=("perfil", "editar", "foto", "propietario", "dueño", "owner", "bio"),
        text=(
            "Para editar el perfil se ingresa a Perfil > 'Editar perfil'. Allí se cambian foto, nombre público y "
            "descripción, y se marca o desmarca la casilla 'Soy propietario'. Marcarla habilita el botón para publicar "
            "establecimientos; al desmarcarla no se pueden crear nuevos, pero los que ya existen permanecen hasta que se "
            "editen o eliminen."
        ),
    ),
    KnowledgeChunk(
        id="publish_establishments",
        keywords=("publicar", "establecimiento", "owner", "propietario", "cargar", "fotos", "horario", "disponibilidad"),
        text=(
            "El botón 'Publicar tu Establecimiento' pide: nombre, país, ciudad/estado, calle y número, categoría "
            "(hotel/restaurante/alojamiento), descripción, capacidad, precio por noche, hasta 10 fotos, rangos de fechas "
            "no disponibles y horarios por día (incluyendo días cerrados). Desde la sección de establecimientos en el "
            "perfil se pueden editar o eliminar las publicaciones."
        ),
    ),
    KnowledgeChunk(
        id="reviews_create",
        keywords=("reseña", "review", "calificacion", "opinion", "escribir", "star"),
        text=(
            "Para escribir una reseña se ingresa al detalle del establecimiento y se presiona 'Escribir reseña sobre este "
            "lugar'. Se completa una puntuación de 1 a 5 estrellas, título, descripción y hasta 10 fotos. Las reseñas "
            "propias pueden editarse o eliminarse desde el perfil, sección reseñas."
        ),
    ),
    KnowledgeChunk(
        id="reviews_filters_votes",
        keywords=("filtrar", "ordenar", "feedback", "comunidad", "mas utiles", "fecha", "votar"),
        text=(
            "En el detalle del lugar se filtran reseñas por rango de fechas o por puntuación mínima. Se ordenan por más "
            "recientes, más antiguas, más útiles o menos útiles. Cada reseña admite votos de 'útil' o 'no útil', lo que "
            "influye en los listados. Los propietarios pueden responder, pero esas respuestas no se votan."
        ),
    ),
    KnowledgeChunk(
        id="support_contact",
        keywords=("ayuda", "soporte", "contacto", "duda"),
        text=(
            "Si una solicitud excede lo que está disponible en ViajerosXP, se recomienda dejar la consulta para el equipo "
            "durante la demo o a través de soporte interno. El asistente debe reconocer cuándo no tiene datos confiables."
        ),
    ),
)


def select_relevant_chunks(text: str, limit: int = 4) -> list[KnowledgeChunk]:
    normalized = text.lower()
    scored: list[tuple[int, int, KnowledgeChunk]] = []
    for idx, chunk in enumerate(AI_KNOWLEDGE_BASE):
        score = 0
        for keyword in chunk.keywords:
            if keyword and keyword in normalized:
                score += 1
        scored.append((score, idx, chunk))
    scored.sort(key=lambda item: (item[0], -item[1]), reverse=True)
    selected = [chunk for score, _, chunk in scored if score > 0][:limit]
    if not selected:
        selected = [AI_KNOWLEDGE_BASE[0]]
    elif AI_KNOWLEDGE_BASE[0] not in selected:
        selected = [AI_KNOWLEDGE_BASE[0], *selected[:-1]]
    return selected


def build_context_block(messages: Iterable[dict[str, str]], limit: int = 4) -> str:
    user_text = " ".join(msg["content"] for msg in messages if msg["role"] == "user").strip()
    if not user_text:
        user_text = "consulta general sobre ViajerosXP"
    chunks = select_relevant_chunks(user_text, limit=limit)
    lines = [f"- {chunk.text}" for chunk in chunks]
    return "\n".join(lines)
