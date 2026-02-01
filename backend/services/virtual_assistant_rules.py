from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
import unicodedata


def _normalize(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text.lower())
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def _personalize(text: str, user_name: Optional[str]) -> str:
    name = user_name or "viajero"
    return text.replace("{user}", name)


@dataclass(frozen=True)
class ScriptedRule:
    triggers: tuple[str, ...]
    response_template: str
    next_intent: Optional[str] = None

    def matches(self, normalized_text: str) -> bool:
        return any(trigger in normalized_text for trigger in self.triggers)


@dataclass(frozen=True)
class MatchedResponse:
    message: str
    next_intent: Optional[str] = None


_RULES: tuple[ScriptedRule, ...] = (
    ScriptedRule(
        triggers=("quien sos", "quien eres", "quien sos?", "quien eres?", "que sos"),
        response_template=(
            "Soy la asistente virtual de ViajerosXP, una guía que vive dentro de la plataforma. "
            "Te cuento cómo usar cada sección, te recuerdo atajos y te aviso si algo todavía no está disponible. "
            "Cuando necesites una mano, escribime y te acompaño paso a paso."
        ),
    ),
    ScriptedRule(
        triggers=("que puedo hacer en esta pagina", "que puedo hacer aca", "que puedo hacer en viajerosxp"),
        response_template=(
            "En ViajerosXP podés buscar hoteles, restaurantes y alojamientos, leer y escribir reseñas reales, publicar "
            "tus propios establecimientos si sos propietario y desbloquear diferentes retos y logros. Todo se maneja desde "
            "la home, el detalle del establecimiento, tu perfil y el panel de Retos y Logros."
        ),
    ),
    ScriptedRule(
        triggers=("como funciona la busqueda", "como funciona la busqueda de establecimientos", "como buscar establecimientos"),
        response_template=(
            "En la home usás la barra de búsqueda para elegir entre hoteles, restaurantes o alojamientos (o todos a la vez), escribís una ciudad "
            "o nombre y podés aplicar diferentes tipos de filtros. Apenas encontrás uno que te interese, abrís su "
            "ficha para ver fotos, reseñas y más detalles. Si querés conocer los filtros puntuales, preguntame y te explico."
        ),
    ),
    ScriptedRule(
        triggers=("como puedo publicar una resena", "como publico una resena", "como escribir una resena", "como puedo publicar resenas"),
        response_template=(
            "Para publicar una reseña buscá el establecimiento desde la barra de búsqueda, abrí su ficha y presioná “Escribir reseña sobre este "
            "lugar”. Elegís la puntuación de 1 a 5 estrellas, agregás título, descripción y hasta 10 fotos. Después "
            "podés editarla o eliminarla desde la sección Reseñas de tu perfil."
        ),
    ),
    ScriptedRule(
        triggers=("como puedo publicar un establecimiento", "como publico un establecimiento", "quiero publicar un establecimiento"),
        response_template=(
            "En la home aparece el botón “Publicar tu Establecimiento”. Si todavía no sos propietario, andá a Perfil > "
            "Editar perfil y activá la casilla “Soy propietario”. Luego completás nombre, ubicación, categoría, "
            "capacidad, precio por noche, hasta 10 fotos, fechas no disponibles y horarios por día. Guardás y listo."
        ),
    ),
    ScriptedRule(
        triggers=("como puedo editar o eliminar mis establecimientos", "como edito mis establecimientos", "como elimino mis establecimientos"),
        response_template=(
            "Desde tu perfil encontrás la sección Establecimientos. Ahí podés abrir cada publicación para actualizar "
            "datos, fotos, disponibilidad u horarios, o eliminarla si ya no querés mostrarla. Los cambios impactan al instante."
        ),
    ),
    ScriptedRule(
        triggers=("como puedo personalizar mi perfil", "como personalizo mi perfil", "personalizar perfil"),
        response_template=(
            "Entrá a Perfil > Editar perfil para cambiar tu foto, nombre público, descripción y marcar si sos propietario. "
            "Tip: usá una foto cuadrada, contá brevemente qué tipo de viajes te gustan y más cosas acerca de vos, y activá la casilla de propietario "
            "si querés habilitar la publicación de establecimientos (si querés luego podés volver a desmarcarla)."
        ),
    ),
    ScriptedRule(
        triggers=(
            "como funcionan los retos y los logros",
            "retos y logros",
            "retos logros",
        ),
        response_template=(
            "Puedes encontrarlos en el ícono inferior izquierdo de la pantalla principal, allí se muestran aquellos que no"
            " has completado todavía. Primero se muestran los que estén en progreso (es decir los que estás realizando ahora mismo) "
            "y luego los que no has comenzado a realizar aún, en dos secciones diferentes separados por retos y logros. En tu perfil "
            " tienes también una sección de Retos y Logros, pero "
            "allí solo se muestran las que has completado y que puedes reclamar. Si necesitas más información acerca de algún reto "
            "o logro en particular puedes preguntarme y te ayudo."
        ),
    ),
    ScriptedRule(
        triggers=("que tipos de filtros de busqueda existen", "como funcionan los filtros", "filtros de busqueda", "filtrar resultados"),
        response_template=(
            "En la búsqueda principal filtrás por rango de fechas (check-in y check-out), precio mínimo y máximo, cantidad de "
            "huéspedes, categoría y texto libre por nombre o ciudad. Dentro del detalle podés filtrar reseñas por rango "
            "de fechas o puntuación mínima y ordenarlas por más recientes, antiguas, útiles o menos útiles."
        ),
    ),
    ScriptedRule(
        triggers=("que destinos me recomendas para viajar", "que destinos recomiendas", "recomendame destinos", "donde me recomendas viajar", "que lugares me recomendas para viajar", "que lugares me recomendas conocer"),
        response_template=(
            "¡Tengo algunas ideas! Decime primero si buscás un hotel, un restaurante o un alojamiento."
        ),
        next_intent="travel_recommendation",
    ),
    ScriptedRule(
        triggers=("cual es la diferencia entre los retos y los logros", "diferencias entre los retos y los logros", "retos vs logros"),
        response_template=(

            "Los logros pueden entregarte diferentes tipos de insignias que se muestran en tu perfil (cada una con un diseño y título "
            " identificativos), mientras que los retos te entregan recompensas en forma de beneficios para usar dentro de la plataforma "
            " (como descuentos o promociones especiales) y que puedes ver en la sección de Beneficios de tu perfil aquellos que estén vigentes. " \
            "Por otro lado las tareas asociadas a los logros son más sencillas de completar y básicas, mientra que las tareas asociadas " \
            "a los retos son más complejas y requieren más tiempo para ser completadas."
        ),
    ),
    ScriptedRule(
        triggers=("como puedo ver las resenas de otros usuarios", "resenas de otros usuarios", "ver otras resenas"),
        response_template=(
            "Cuando busques un establecimiento y abras su ficha en la última sección verás las reseñas publicadas por otros usuarios" \
            "(incluida la tuya si es que ya escribiste una). Cuando las leas puedes votarlas como útiles o no útiles dependiendo de " \
            "si te parecieron de ayuda o no. A su vez puedes filtrarlas u ordenarlas para encontrar las que más te interesen."
        ),
    ),
)


GREETING_KEYWORDS = ("hola", "buen dia", "buenas", "que tal", "hey")


def match_scripted_response(message: str, user_name: Optional[str]) -> Optional[MatchedResponse]:
    normalized = _normalize(message)
    if _is_greeting(normalized):
        return MatchedResponse(
            message=_personalize(
                "¡Hola {user}! Soy la asistente de ViajerosXP. Contame qué necesitás y te ayudo.",
                user_name,
            )
        )
    for rule in _RULES:
        if rule.matches(normalized):
            return MatchedResponse(
                message=_personalize(rule.response_template, user_name),
                next_intent=rule.next_intent,
            )
    if "quien sos" in normalized or "quien eres" in normalized:
        return MatchedResponse(
            message=_personalize(
                "Soy la guía virtual de ViajerosXP: traduzco la plataforma en pasos simples y te aviso qué está disponible.",
                user_name,
            )
        )
    return None


def _is_greeting(normalized: str) -> bool:
    if not normalized:
        return False
    if any(word in normalized for word in ("gracias", "como", "publicar")):
        return False
    return any(normalized.startswith(word) for word in GREETING_KEYWORDS) and len(normalized.split()) <= 4


CATEGORY_ALIASES = {
    "hotel": ("hotel", "hoteles"),
    "restaurante": ("restaurante", "restaurantes", "comida", "gastronomia"),
    "alojamiento": ("alojamiento", "alojamientos", "cabanas", "cabañas", "casa", "departamento"),
}


def detect_category_keyword(text: str) -> Optional[str]:
    normalized = _normalize(text)
    for category, keywords in CATEGORY_ALIASES.items():
        if any(keyword in normalized for keyword in keywords):
            return category
    return None


def get_category_label(category: str) -> str:
    return {
        "hotel": "hotel",
        "restaurante": "restaurante",
        "alojamiento": "alojamiento",
    }.get(category, category)
