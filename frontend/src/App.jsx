// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react'; // useCallback añadido
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import RegistrationForm from './components/auth/RegistrationForm';
import LoginForm from './components/auth/LoginForm';
import DevPasswordResetForm from './components/auth/DevPasswordResetForm';
import ProtectedRoute from './components/routing/ProtectedRoute';

import QuestPage from './pages/QuestPage';
import TagsPage from './pages/TagsPage';
import DashboardPage from './pages/DashboardPage';
import ScheduledMissionsPage from './pages/ScheduledMissionsPage';
import HabitTemplatesPage from './pages/HabitTemplatesPage';

// Nuevos componentes de gamificación
import EnergyBalanceBar from './components/gamification/EnergyBalanceBar';
import UserStatsDisplay from './components/gamification/UserStatsDisplay';

import './App.css';
import './index.css';
import './styles/gamification.css'; // Importar los nuevos estilos

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function HomePage() {
    const isAuthenticated = !!localStorage.getItem('authToken');
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
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('authToken'));
    const [currentUser, setCurrentUser] = useState(null);
    const [reloadUserStats, setReloadUserStats] = useState(0); // Para forzar recarga de UserStatsDisplay
    const navigate = useNavigate();
    const location = useLocation();

    const updateCurrentUserState = useCallback(() => {
        const userString = localStorage.getItem('currentUser');
        if (userString) {
            try {
                setCurrentUser(JSON.parse(userString));
            } catch (e) {
                console.error("Error parsing currentUser from localStorage", e);
                localStorage.removeItem('currentUser');
                setCurrentUser(null);
            }
        } else {
            setCurrentUser(null);
        }
        setReloadUserStats(prev => prev + 1); // Trigger re-render of UserStatsDisplay
    }, []);


    useEffect(() => {
        const token = localStorage.getItem('authToken');
        setIsAuthenticated(!!token);
        updateCurrentUserState();
    }, [location.pathname, updateCurrentUserState]);


    const handleAuthSuccess = () => {
        setIsAuthenticated(true);
        updateCurrentUserState(); // Actualiza el estado del usuario y fuerza la recarga de UserStats
        // Navegación ya se maneja en los formularios de auth
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
            setIsAuthenticated(false);
            setCurrentUser(null);
            setReloadUserStats(prev => prev + 1); // Actualizar UI
            navigate('/login');
        }
    };
    
    // El PRD indica que el Left Sidebar tiene "User Avatar, User Name, User stats"
    // y el Energy Balance Bar está debajo del Top Bar.

    return (
        <div className="app-container">
            <header className="main-header"> {/* Cambiado nav a header para más semántica */}
                <div className="top-bar">
                    <Link to="/" className="app-logo">Iter Polaris</Link>
                    <nav className="main-navigation">
                        {!isAuthenticated ? (
                            <>
                                <Link to="/register" className="nav-link">Register</Link>
                                <Link to="/login" className="nav-link">Login</Link>
                            </>
                        ) : (
                            <>
                                {/* User Avatar Dropdown (Placeholder Tarea 9) */}
                                {/* <div className="user-avatar-dropdown"> */}
                                    {/* <img src={currentUser?.avatar_url || "/default-avatar.png"} alt="User"/> */}
                                    <button onClick={handleLogout} className="nav-button-logout">
                                        Logout ({currentUser?.name || 'User'})
                                    </button>
                                {/* </div> */}
                            </>
                        )}
                    </nav>
                </div>
                {isAuthenticated && <EnergyBalanceBar />}
            </header>

            <div className="app-body"> {/* Nuevo contenedor para sidebar y contenido principal */}
                {isAuthenticated && (
                    <aside className="left-sidebar">
                        <UserStatsDisplay key={reloadUserStats} /> {/* key para forzar re-render si es necesario */}
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
                            {/* TODO Tarea 9: "Add New" button */}
                            {/* TODO Tarea 9: Tag Filters */}
                        </nav>
                    </aside>
                )}
                <main className={`main-content ${!isAuthenticated ? 'full-width' : ''}`}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/register" element={<RegistrationForm onAuthSuccess={handleAuthSuccess} />} />
                        <Route path="/login" element={<LoginForm onAuthSuccess={handleAuthSuccess} />} />
                        <Route path="/dev-password-reset" element={<DevPasswordResetForm />} />

                        <Route element={<ProtectedRoute />}>
                            <Route path="/dashboard" element={<DashboardPage />} />
                            <Route path="/scheduled-missions" element={<ScheduledMissionsPage />} />
                            <Route path="/habit-templates" element={<HabitTemplatesPage />} />
                            <Route path="/quests" element={<QuestPage />} />
                            <Route path="/tags" element={<TagsPage />} />
                            {/* <Route path="/calendar" element={<CalendarPage />} /> */}
                            {/* <Route path="/settings" element={<SettingsPage />} /> */}
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
            </div> {/* Fin de app-body */}

            <footer className="main-footer">
                <p>&copy; {new Date().getFullYear()} Iter Polaris. Chart your course.</p>
            </footer>
        </div>
    );
}

export default App;