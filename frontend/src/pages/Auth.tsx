import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | null>(null);
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setMessageType(null);
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        navigate("/");
      } else {
        await signup(username, email, password, fullName || undefined, isOwner);
        // After signup, switch to login mode
        setIsLogin(true);
        setMessage("¡Cuenta creada! Por favor inicia sesión.");
        setMessageType("success");
        setPassword("");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "An error occurred");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page auth-page--single">
      <div className="auth-card">
        {loading && (
          <div className="auth-loading">
            <div className="auth-spinner" />
            <span>{isLogin ? "Iniciando sesión..." : "Creando cuenta..."}</span>
          </div>
        )}

        <div className="auth-top">
          <img src="/logoimagen.png" alt="ViajerosXP" className="auth-logo" />
          <div className="auth-copy">
            <p className="auth-eyebrow">{isLogin ? "Bienvenido de vuelta" : "Sumate a la comunidad"}</p>
            <h2>{isLogin ? "Iniciar Sesión" : "Crear Cuenta"}</h2>
            <p className="auth-subtitle">
              Descubrí lugares, compartí reseñas y ganá recompensas por ayudar a otros viajeros.
            </p>
            <ul className="auth-highlights">
              <li>✔️ Reseñas verificadas y útiles</li>
              <li>✔️ Recompensas y badges por tu actividad</li>
              <li>✔️ Propietarios con herramientas para sus lugares</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-form__header">
            <h3>{isLogin ? "Datos de acceso" : "Completa tus datos"}</h3>
            <p className="auth-muted">
              {isLogin ? "Ingresá con tu email y contraseña." : "Crear una cuenta lleva menos de un minuto."}
            </p>
          </div>

          {!isLogin && (
            <label className="auth-field">
              <span>Nombre de Usuario</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </label>
          )}

          <label className="auth-field">
            <span>Correo Electrónico</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="auth-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
          </label>

          {!isLogin && (
            <>
              <label className="auth-field">
                <span>Nombre Completo (opcional)</span>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                />
              </label>

              <label className={`auth-toggle ${isOwner ? "auth-toggle--active" : ""}`}>
                <input
                  type="checkbox"
                  checked={isOwner}
                  onChange={(e) => setIsOwner(e.target.checked)}
                />
                <div>
                  <div className="auth-toggle__title">Soy propietario de un establecimiento</div>
                  <div className="auth-toggle__desc">Podré publicar y gestionar establecimientos</div>
                </div>
              </label>
            </>
          )}

          {message && (
            <div className={`notice ${messageType === "success" ? "success" : "error"}`}>
              {message}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            variant="primary"
            style={{ width: "100%" }}
          >
            {loading ? "Cargando..." : isLogin ? "Iniciar Sesión" : "Crear Cuenta"}
          </Button>
        </form>

        <div className="auth-switch">
          <span>{isLogin ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}</span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage("");
              setMessageType(null);
            }}
          >
            {isLogin ? "Regístrate" : "Inicia sesión"}
          </button>
        </div>
      </div>
    </div>
  );
}
