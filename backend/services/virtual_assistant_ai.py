from __future__ import annotations

from functools import lru_cache
from typing import Iterable

from fastapi import HTTPException
from openai import APIConnectionError, OpenAI, OpenAIError
import logging

from settings import get_settings
from services.virtual_assistant_context import build_context_block

settings = get_settings()
logger = logging.getLogger(__name__)

FALLBACK_MESSAGE = "No entendí tu pregunta, ¿podés volver a escribirla?"

ASSISTANT_INSTRUCTIONS = (
    "Sos la asistente virtual oficial de ViajerosXP. Tu objetivo es responder únicamente con funciones reales de la "
    "plataforma. Reglas obligatorias:\n"
    "- Respondé SIEMPRE en español rioplatense, tono cercano y profesional.\n"
    "- Usá solo la información confirmada del contexto. Si algo no existe en ViajerosXP, decilo y ofrecé la alternativa "
    "más parecida dentro del producto.\n"
    "- Sé concreta: máximo tres párrafos breves o viñetas claras.\n"
    "- Si la consulta excede la plataforma (p. ej. soporte humano), sugerí contactar al equipo o dejar la consulta para la demo.\n"
)


def _ensure_openai_configured() -> None:
    if not _is_openai_configured():
        raise HTTPException(status_code=503, detail="El asistente inteligente no está disponible.")


def _is_openai_configured() -> bool:
    return bool(settings.openai_api_key)


def is_ai_enabled() -> bool:
    return _is_openai_configured()


@lru_cache()
def _get_openai_client() -> OpenAI:
    _ensure_openai_configured()
    client_kwargs = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        client_kwargs["base_url"] = settings.openai_base_url
    return OpenAI(**client_kwargs)


def _convert_messages(messages: Iterable[dict[str, str]]) -> list[dict[str, object]]:
    converted: list[dict[str, object]] = []
    for message in messages:
        converted.append(
            {
                "role": message["role"],
                "content": [
                    {
                        "type": "text",
                        "text": message["content"],
                    }
                ],
            }
        )
    return converted


def generate_ai_response(messages: list[dict[str, str]]) -> str:
    """
    Calls the OpenAI Responses API using the configured model and returns the assistant reply.
    """
    if not _is_openai_configured():
        logger.warning("Asistente IA deshabilitado (falta OPENAI_API_KEY o se desactivó). Respondiendo fallback.")
        return FALLBACK_MESSAGE
    client = _get_openai_client()
    payload_messages = _convert_messages(messages)
    context_block = build_context_block(messages)
    system_text = f"{ASSISTANT_INSTRUCTIONS}\n\nContexto confirmado:\n{context_block}"
    system_block = {
        "role": "system",
        "content": [
            {
                "type": "text",
                "text": system_text,
            }
        ],
    }
    try:
        if hasattr(client, "responses"):
            response = client.responses.create(
                model=settings.openai_model,
                input=[
                    system_block,
                    *payload_messages,
                ],
            )
            parts: list[str] = []
            for item in response.output:
                if item.type == "output_text":
                    parts.append(item.text)
            if not parts:
                raise HTTPException(status_code=502, detail="No se pudo generar la respuesta del asistente.")
            return "".join(parts).strip()
        # Fallback for older SDKs without Responses API
        chat_messages = [
            {"role": "system", "content": system_text},
            *[
                {"role": msg["role"], "content": msg["content"][0]["text"]}
                for msg in payload_messages
            ],
        ]
        response = client.chat.completions.create(
            model=settings.openai_model,
            messages=chat_messages,
        )
        choice = response.choices[0]
        content = choice.message.content
        if isinstance(content, list):
            parts = []
            for block in content:
                text = block.get("text")
                if text:
                    parts.append(text)
            content = "".join(parts)
        if not isinstance(content, str):
            raise HTTPException(status_code=502, detail="Respuesta inválida del asistente.")
        return content.strip()
    except APIConnectionError as exc:
        logger.exception("Error al conectar con el proveedor de IA")
        hint = (
            " Revisá OPENAI_BASE_URL: usá una URL accesible desde el contenedor (o vacía para la API pública)."
        )
        logger.error("Fallo de conexión con IA. %s", hint)
        return FALLBACK_MESSAGE
    except OpenAIError as exc:
        logger.exception("Error al consultar OpenAI")
        return FALLBACK_MESSAGE
    except Exception as exc:  # pragma: no cover - fallback for redacted errors
        logger.exception("Error inesperado al consultar OpenAI")
        return FALLBACK_MESSAGE
