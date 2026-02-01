import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthUser, getCurrentUser, login as apiLogin, logout as apiLogout, signup as apiSignup, buildApiUrl } from "../lib/api";
import { useDialog } from "./DialogContext";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string, full_name?: string, is_owner?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
//
async function checkAuth(
  setUser: (user: AuthUser | null) => void,
  setLoading: (loading: boolean) => void
) {
  try {
    const currentUser = await getCurrentUser();

    // Verificamos si viene con la forma { user: {...} }
    if (currentUser && typeof currentUser === "object" && "user" in currentUser) {
      const userObj = (currentUser as { user: AuthUser }).user;
      setUser(userObj);
    } else {
      setUser(currentUser as AuthUser);
    }

  } catch (error) {
    console.error("Failed to check auth:", error);
    setUser(null);
  } finally {
    setLoading(false);
  }
}


//
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { alert: showAlert } = useDialog();

// 2. Check if user is logged in on mount
  useEffect(() => {
// Usamos la función helper al montar para verificar la sesión.
 checkAuth(setUser, setLoading);
}, []);

 const login = async (email: string, password: string) => {
 const response = await apiLogin(email, password);
    
    // 🚨 CORRECCIÓN CLAVE 🚨
    // 3. Después del login, forzamos una verificación completa para actualizar el estado global.
    // Esto asegura que el user.id se cargue en el contexto.
  await checkAuth(setUser, setLoading); 
};

 const signup = async (username: string, email: string, password: string, full_name?: string, is_owner?: boolean) => {
    await apiSignup(username, email, password, full_name, is_owner);
    
    // 4. Tras el signup, simplemente avisamos y no hacemos login automático
    await showAlert("¡Cuenta creada exitosamente! Por favor, inicia sesión para continuar.");
 };

  const logout = async () => {
    await apiLogout();
    setUser(null);
 };

return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
     {children}
   </AuthContext.Provider>
 );
}

export function useAuth() {
const context = useContext(AuthContext);
 if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
 }
  return context;
}
