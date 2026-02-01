import { Routes, Route, Link, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import SearchResults from "./pages/SearchResults";
import PlaceDetail from "./pages/PlaceDetail/PlaceDetail";
import UserProfile from "./pages/UserProfile";
import Auth from "./pages/Auth";
import { useAuth } from "./contexts/AuthContext";
import UserDropdown from "./components/UserDropdown";

import CreatePlace from "./pages/CreatePlace";
import CreateReview from "./pages/CreateReview";


export default function App() {
  const { user, loading } = useAuth();

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh"
      }}>
        Loading...
      </div>
    );
  }

  // If not logged in, show auth page
  if (!user) {
    return <Auth />;
  }

  // User is logged in, show the main app
  return (
    <div className="app-wrapper">
      <header className="header">
        <div className="container">
          <Link to="/" className="brand" aria-label="ViajerosXP">
            <img src="/logoimagen.png" alt="ViajerosXP logo" className="brand-logo" />
          </Link>
          <nav className="header-nav">
            <Link to="/" className="header-nav-link">Inicio</Link>
            <UserDropdown />
          </nav>
        </div>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/places/:id" element={<PlaceDetail />} />
          <Route path="/users/:username" element={<UserProfile />} />
          <Route path="/create-place" element={<CreatePlace />} />
          <Route path="/reviews/new" element={<CreateReview />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">© {new Date().getFullYear()} ViajerosXP</div>
      </footer>
    </div>
  );
}
