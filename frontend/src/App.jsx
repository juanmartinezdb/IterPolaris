// frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
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

import './App.css';
import './index.css'; // Asegurarse que las variables globales de CSS estén disponibles

// API_AUTH_URL puede moverse a un archivo de constantes o configuración si se usa en múltiples lugares
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // http://localhost:5000/api

function HomePage() { // Esta podría ser la página de bienvenida o redirigir al dashboard si está logueado
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
    const [currentUser, setCurrentUser] = useState(null); // Para nombre de usuario, etc.
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        const userString = localStorage.getItem('currentUser');
        setIsAuthenticated(!!token);
        if (userString) {
            try {
                setCurrentUser(JSON.parse(userString));
            } catch (e) {
                console.error("Error parsing currentUser from localStorage", e);
                localStorage.removeItem('currentUser'); // limpiar si está corrupto
                setCurrentUser(null);
            }
        } else {
            setCurrentUser(null);
        }
    }, [location.pathname]); // Re-evaluar en cada cambio de ruta


    const handleAuthSuccess = () => {
        setIsAuthenticated(true);
        const userString = localStorage.getItem('currentUser');
        if (userString) {
            setCurrentUser(JSON.parse(userString));
        }
        // No es necesario navegar aquí, los formularios de Auth ya lo hacen
    };

    const handleLogout = async () => {
        const token = localStorage.getItem('authToken');
        try {
            if (token && API_BASE_URL) { // Asegurarse que API_BASE_URL está definido
                await axios.post(`${API_BASE_URL}/auth/logout`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
            // Continuar con el logout del cliente de todas formas
        } finally {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            setIsAuthenticated(false);
            setCurrentUser(null);
            navigate('/login');
        }
    };

    // Placeholder para los filtros de tags globales (se manejará en Tarea 9)
    // const [activeTagFilters, setActiveTagFilters] = useState([]);
    // const handleTagFilterChange = (tagId) => { /* ... lógica para añadir/quitar tagId ... */ }

    return (
        <div className="app-container">
            <nav className="main-nav">
                <Link to="/" className="nav-link" style={{ fontSize: '1.5em', fontWeight: 'bold' }}>Iter Polaris</Link>
                <div className="nav-links-group">
                    {/* Tarea 9: Aquí iría el TagFilterSidebar si se decide ponerlo en el nav global
                        <TagFilterSidebar 
                            availableTags={allUserTags} 
                            selectedTags={activeTagFilters} 
                            onFilterChange={handleTagFilterChange} 
                        /> 
                    */}
                    {!isAuthenticated ? (
                        <>
                            <Link to="/register" className="nav-link">Register</Link>
                            <Link to="/login" className="nav-link">Login</Link>
                        </>
                    ) : (
                        <>
                            <Link to="/dashboard" className="nav-link">Dashboard</Link>
                            <Link to="/scheduled-missions" className="nav-link">Scheduled</Link>
                            <Link to="/habit-templates" className="nav-link">Habits</Link>
                            <Link to="/quests" className="nav-link">My Quests</Link>
                            <Link to="/tags" className="nav-link">My Tags</Link>
                            {/* <Link to="/calendar" className="nav-link">Calendar</Link> */} {/* Tarea 6 */}
                            {/* Tarea 9: Avatar Dropdown con Profile, Settings, Logout */}
                            <button onClick={handleLogout} className="nav-button-logout">Logout ({currentUser?.name})</button>
                        </>
                    )}
                </div>
            </nav>

            <main className="main-content">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/register" element={<RegistrationForm onAuthSuccess={handleAuthSuccess} />} />
                    <Route path="/login" element={<LoginForm onAuthSuccess={handleAuthSuccess} />} />
                    <Route path="/dev-password-reset" element={<DevPasswordResetForm />} />

                    <Route element={<ProtectedRoute />}> {/* Wrapper para todas las rutas protegidas */}
                        <Route path="/dashboard" element={<DashboardPage />} />
                        <Route path="/scheduled-missions" element={<ScheduledMissionsPage />} />
                        <Route path="/habit-templates" element={<HabitTemplatesPage />} />
                        <Route path="/quests" element={<QuestPage />} />
                        <Route path="/tags" element={<TagsPage />} />
                        {/* <Route path="/calendar" element={<CalendarPage />} /> */} {/* Tarea 6 */}
                        {/* <Route path="/settings" element={<SettingsPage />} /> */} {/* Tarea 9 */}
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

            <footer className="main-footer">
                <p>&copy; {new Date().getFullYear()} Iter Polaris. Chart your course.</p>
            </footer>
        </div>
    );
}

export default App;