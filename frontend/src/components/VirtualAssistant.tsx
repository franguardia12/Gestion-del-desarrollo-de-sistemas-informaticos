import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { AssistantState, ChatbotAIMessage, fetchChatbotAIResponse } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

type ChatMessage = {
  id: string;
  author: "bot" | "user";
  text: string;
};

function createMessage(author: "bot" | "user", text: string): ChatMessage {
  return {
    id: `${author}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    author,
    text,
  };
}

const WELCOME_MESSAGE =
  "¡Hola! Soy la asistente de ViajerosXP. Escribime lo que necesites saber y te guío paso a paso.";
const MIN_RESPONSE_DELAY_MS = 5000;

export function VirtualAssistant() {
  const { user } = useAuth();
  const displayName = user?.full_name?.split(" ")[0] || user?.full_name || user?.username || "viajero";

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [createMessage("bot", WELCOME_MESSAGE)]);
  const [assistantState, setAssistantState] = useState<AssistantState | null>(null);
  const [userInput, setUserInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNeedsRetry, setAiNeedsRetry] = useState(false);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const lastRequestRef = useRef<{ payload: ChatbotAIMessage[]; state: AssistantState | null } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const container = chatLogRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    inputRef.current?.focus();
  }, [messages, isOpen]);

  function toPayload(conversation: ChatMessage[]): ChatbotAIMessage[] {
    return conversation.map((message) => ({
      role: message.author === "user" ? "user" : "assistant",
      content: message.text,
    }));
  }

  async function handleSend(event?: React.FormEvent) {
    event?.preventDefault();
    const text = userInput.trim();
    if (!text || loading) return;

    const userMessage = createMessage("user", text);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setUserInput("");
    setError(null);
    setAiNeedsRetry(false);
    setLoading(true);

    const payload = toPayload(nextMessages);
    lastRequestRef.current = { payload, state: assistantState };

    try {
      const requestStartedAt = performance.now();
      const reply = await fetchChatbotAIResponse(payload, {
        state: assistantState,
        userName: displayName,
      });
      await ensureArtificialDelay(requestStartedAt);
      const botMessage = createMessage("bot", reply.message);
      setMessages((prev) => [...prev, botMessage]);
      setAssistantState(reply.state ?? null);
      setAiNeedsRetry(false);
      lastRequestRef.current = null;
    } catch (err) {
      handleError(err, "No pude obtener la respuesta del asistente.");
      setAiNeedsRetry(true);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  async function retryLastResponse() {
    if (!lastRequestRef.current) return;
    setLoading(true);
    setError(null);
    setAiNeedsRetry(false);
    try {
      const requestStartedAt = performance.now();
      const reply = await fetchChatbotAIResponse(lastRequestRef.current.payload, {
        state: lastRequestRef.current.state,
        userName: displayName,
      });
      await ensureArtificialDelay(requestStartedAt);
      const botMessage = createMessage("bot", reply.message);
      setMessages((prev) => [...prev, botMessage]);
      setAssistantState(reply.state ?? null);
      lastRequestRef.current = null;
    } catch (err) {
      handleError(err, "No pude obtener la respuesta del asistente.");
      setAiNeedsRetry(true);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleError(err: unknown, fallback: string) {
    if (err instanceof Error) {
      setError(err.message || fallback);
    } else {
      setError(fallback);
    }
  }

  async function ensureArtificialDelay(startedAt: number) {
    const elapsed = performance.now() - startedAt;
    const remaining = MIN_RESPONSE_DELAY_MS - elapsed;
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend(event);
    }
  }

  return (
    <div className="assistant-widget" aria-live="polite">
      {isOpen && (
        <section id="assistant-panel" className="assistant-panel" aria-label="Asistente virtual">
          <header className="assistant-panel__header">
            <div>
              <p className="assistant-panel__title">Asistente virtual</p>
              <p className="assistant-panel__subtitle">Estoy acá para ayudarte a usar ViajerosXP.</p>
            </div>
            <button
              type="button"
              className="assistant-panel__close"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar asistente virtual"
            >
              ×
            </button>
          </header>

          <div className="assistant-panel__body">
            <div className="assistant-chat-log" ref={chatLogRef}>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`assistant-message assistant-message--${message.author}`}
                >
                  {message.text}
                </div>
              ))}

              {loading && (
                <div className="assistant-message assistant-message--bot assistant-message--typing">
                  Pensando...
                </div>
              )}
            </div>

            {error && (
              <div className="assistant-error">
                <span>{error}</span>
                {aiNeedsRetry ? (
                  <button type="button" className="assistant-error__retry" onClick={retryLastResponse}>
                    Reintentar
                  </button>
                ) : (
                  <button type="button" className="assistant-error__retry" onClick={() => setError(null)}>
                    Ocultar
                  </button>
                )}
              </div>
            )}

            <form className="assistant-ai-form" onSubmit={handleSend}>
              <textarea
                className="assistant-ai-input"
                placeholder="Escribí tu consulta..."
                value={userInput}
                onChange={(event) => setUserInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                rows={3}
                ref={inputRef}
              />
              <button type="submit" className="assistant-ai-send" disabled={loading}>
                Enviar
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        className="assistant-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="assistant-panel"
      >
        <span className="assistant-trigger__icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="26" height="26" role="presentation">
            <path d="M16 4v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <rect
              x="7"
              y="8"
              width="18"
              height="14"
              rx="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
            <circle cx="13" cy="15" r="2" fill="currentColor" />
            <circle cx="19" cy="15" r="2" fill="currentColor" />
            <path d="M12 20h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M6 12l-2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M26 12l2-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <span className="assistant-trigger__label">Consulta al asistente virtual</span>
      </button>
    </div>
  );
}
