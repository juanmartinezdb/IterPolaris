import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import RegistrationForm from './components/auth/RegistrationForm';
import LoginForm from './components/auth/LoginForm';
import DevPasswordResetForm from './components/auth/DevPasswordResetForm'; // Importar nuevo componente
import ProtectedRoute from './components/routing/ProtectedRoute';

import QuestPage from './pages/QuestPage'; 
import TagsPage from './pages/TagsPage';

import './App.css';

const API_AUTH_URL = import.meta.env.VITE_API_BASE_URl+'/auth';

function HomePage() {
    return (
        <div className="page-container">
            <h1>Welcome to Iter Polaris!</h1>
            <p>Your personal gamified agenda awaits your command.</p>
        </div>
    );
}

function DashboardPage() {
    const userString = localStorage.getItem('currentUser');
    const user = userString ? JSON.parse(userString) : { name: 'Adventurer' };
    return (
        <div className="page-container">
            <h2>Dashboard</h2>
            <p>Welcome back, {user.name}! Ready for your next Quest?</p>
            <p style={{marginTop: '1rem'}}>
                <Link to="/quests" className="nav-link" style={{padding: '0.5em 1em', border: '1px solid var(--color-accent-gold)', borderRadius: '4px'}}>
                    Manage Your Quests
                </Link>
            </p>
        </div>
    );
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('authToken'));
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        setIsAuthenticated(!!localStorage.getItem('authToken'));
    }, [location.pathname]);


    const handleAuthSuccess = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = async () => {
        const token = localStorage.getItem('authToken');
        try {
            if (token) {
                await axios.post(`${API_AUTH_URL}/logout`, {}, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
            }
        } catch (error) {
            console.error('Logout API call failed:', error);
        } finally {
            localStorage.removeItem('authToken');
            localStorage.removeItem('currentUser');
            setIsAuthenticated(false);
            navigate('/login');
        }
    };

    return (
        <div className="app-container">
            <nav className="main-nav">
                <Link to="/" className="nav-link">Iter Polaris</Link>
                <div className="nav-links-group">
                    {!isAuthenticated ? (
                        <>
                            <Link to="/register" className="nav-link">Register</Link>
                            <Link to="/login" className="nav-link">Login</Link>
                        </>
                    ) : (
                        <>
                            <Link to="/dashboard" className="nav-link">Dashboard</Link>
                            <Link to="/quests" className="nav-link">My Quests</Link> 
                            <Link to="/tags" className="nav-link">My Tags</Link>
                            <button onClick={handleLogout} className="nav-button-logout">Logout</button>
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
                    
                    <Route 
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <DashboardPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/quests" 
                        element={
                            <ProtectedRoute>
                                <QuestPage />
                            </ProtectedRoute>
                        } 
                    />
                    <Route 
                        path="/tags" 
                        element={
                            <ProtectedRoute>
                                <TagsPage />
                            </ProtectedRoute>
                        } 
                    />
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