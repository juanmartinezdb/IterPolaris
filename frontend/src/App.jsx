// frontend/src/App.jsx
import React, { useContext, useEffect } from 'react'; // useEffect añadido
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import { UserContext } from './contexts/UserContext'; 

import RegistrationForm from './components/auth/RegistrationForm';
import LoginForm from './components/auth/LoginForm';
import DevPasswordResetForm from './components/auth/DevPasswordResetForm';
import ProtectedRoute from './components/routing/ProtectedRoute';

import QuestPage from './pages/QuestPage';
import TagsPage from './pages/TagsPage';
import DashboardPage from './pages/DashboardPage';
import ScheduledMissionsPage from './pages/ScheduledMissionsPage';
import HabitTemplatesPage from './pages/HabitTemplatesPage';

import EnergyBalanceBar from './components/gamification/EnergyBalanceBar';
import UserStatsDisplay from './components/gamification/UserStatsDisplay';

import './App.css';
import './index.css';
import './styles/gamification.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function HomePage() {
    const { currentUser } = useContext(UserContext);
    const isAuthenticated = !!currentUser;
    // ... (sin cambios)
    return (
        <div className="page-container">
            <h1>Welcome to Iter Polaris!</h1>
            <p>Your personal gamified agenda awaits your command.</p>
            {!isAuthenticated && (
                <div style={{ marginTop: '2rem' }}>
                    <Link to="/login" className="auth-button" style={{ marginRight: '1rem', textDecoration: 'none' }}>Login</Link>
                    <Link to="/register" className="auth-button" style={{ textDecoration: 'none' }}>Register</Link>
                </div>
            )}
            {isAuthenticated && (
                <div style={{ marginTop: '2rem' }}>
                    <Link to="/dashboard" className="auth-button" style={{ textDecoration: 'none' }}>Go to Dashboard</Link>
                </div>
            )}
        </div>
    );
}

function App() {
    const { currentUser, isLoadingProfile, fetchUserProfile, refreshUserStatsAndEnergy } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation(); // Para reaccionar a cambios de ruta si es necesario para logout

    // Esta variable determinará si se muestran los elementos protegidos.
    // Solo será true si no estamos cargando el perfil Y tenemos un usuario.
    const isAuthenticatedAndReady = !isLoadingProfile && !!currentUser;


    const handleAuthSuccess = async () => {
        // Al hacer login/registro exitoso, el token se guarda en localStorage.
        // UserContext se re-evaluará debido al cambio de ruta o al montar ProtectedRoute.
        // O podemos forzar un fetch aquí si es necesario.
        await fetchUserProfile(); // Forzar fetch del perfil desde UserContext
        // La navegación ya la manejan los formularios.
    };

    const handleLogout = async () => {
        const token = localStorage.getItem('authToken');
        try {
            if (token && API_BASE_URL) {
                await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
        } finally {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            // Llamar a fetchUserProfile en UserContext hará que currentUser se vuelva null
            await fetchUserProfile(); // Esto debería resetear el estado en UserContext
            navigate('/login');
        }
    };
    
    // Efecto para manejar el caso donde el token es removido externamente (ej. dev tools)
    // o se vuelve inválido y fetchUserProfile lo limpia.
    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'authToken' || event.key === 'currentUser') {
                // console.log("App.jsx: Detected storage change, re-fetching profile.");
                fetchUserProfile();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        // Si al cambiar de ruta, el currentUser del contexto es null pero hay un token,
        // intentar recargar. Esto es por si el contexto no se actualizó a tiempo.
        const token = localStorage.getItem('authToken');
        if (token && !currentUser && !isLoadingProfile) {
            // console.log("App.jsx: Token exists but no current user, attempting profile fetch on route change.");
            fetchUserProfile();
        }

        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [location.pathname, fetchUserProfile, currentUser, isLoadingProfile]);


    if (isLoadingProfile && localStorage.getItem('authToken')) {
        // Si hay un token pero aún estamos cargando el perfil, muestra un loader global
        // para evitar mostrar la página de login/home brevemente.
        return <div className="app-container-loading">Loading Your Realm...</div>;
    }

    return (
        <div className="app-container">
            <header className="main-header">
                <div className="top-bar">
                    <Link to="/" className="app-logo">Iter Polaris</Link>
                    <nav className="main-navigation">
                        {!isAuthenticatedAndReady ? ( // Usar isAuthenticatedAndReady
                            <>
                                <Link to="/register" className="nav-link">Register</Link>
                                <Link to="/login" className="nav-link">Login</Link>
                            </>
                        ) : (
                            <>
                                <button onClick={handleLogout} className="nav-button-logout">
                                    Logout ({currentUser?.name || 'User'})
                                </button>
                            </>
                        )}
                    </nav>
                </div>
                {isAuthenticatedAndReady && <EnergyBalanceBar />} {/* Usar isAuthenticatedAndReady */}
            </header>

            <div className="app-body">
                {isAuthenticatedAndReady && ( // Usar isAuthenticatedAndReady
                    <aside className="left-sidebar">
                        <UserStatsDisplay />
                        <nav className="sidebar-navigation">
                             <Link to="/dashboard" className="sidebar-nav-link">
                                <span role="img" aria-label="Dashboard Icon">🗺️</span> Dashboard
                            </Link>
                            <Link to="/scheduled-missions" className="sidebar-nav-link">
                                <span role="img" aria-label="Scheduled Icon">🗓️</span> Scheduled
                            </Link>
                            <Link to="/habit-templates" className="sidebar-nav-link">
                                <span role="img" aria-label="Habits Icon">🔄</span> Habits
                            </Link>
                            <Link to="/quests" className="sidebar-nav-link">
                                <span role="img" aria-label="Quests Icon">🏆</span> My Quests
                            </Link>
                            <Link to="/tags" className="sidebar-nav-link">
                                <span role="img" aria-label="Tags Icon">🏷️</span> My Tags
                            </Link>
                        </nav>
                    </aside>
                )}
                <main className={`main-content ${!isAuthenticatedAndReady ? 'full-width' : ''}`}> {/* Usar isAuthenticatedAndReady */}
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/register" element={<RegistrationForm onAuthSuccess={handleAuthSuccess} />} />
                        <Route path="/login" element={<LoginForm onAuthSuccess={handleAuthSuccess} />} />
                        <Route path="/dev-password-reset" element={<DevPasswordResetForm />} />

                        <Route element={<ProtectedRoute />}> {/* ProtectedRoute ahora usará UserContext implícitamente o se podría pasar currentUser */}
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/scheduled-missions" element={<ScheduledMissionsPage />} />
                            <Route path="/habit-templates" element={<HabitTemplatesPage />} />
                            <Route path="/quests" element={<QuestPage />} />
                            <Route path="/tags" element={<TagsPage />} />
                        </Route>

                        <Route path="*" element={
                            <div className="page-container">
                                <h2>404 - Page Not Found</h2>
                                <p>The page you are looking for does not exist.</p>
                                <Link to="/" className="nav-link">Go to Homepage</Link>
                            </div>
                        } />
                    </Routes>
                </main>
            </div>

            <footer className="main-footer">
                <p>&copy; {new Date().getFullYear()} Iter Polaris. Chart your course.</p>
            </footer>
        </div>
    );
}

export default App;