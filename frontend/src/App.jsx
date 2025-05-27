// frontend/src/App.jsx
import React, { useContext, useEffect, useState } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

import { UserContext } from './contexts/UserContext';

// Import Layout Components
import TopBar from './components/layout/TopBar';
import LeftSidebar from './components/layout/LeftSidebar';
import MainContentArea from './components/layout/MainContentArea';

// Import Pages and Auth components
import RegistrationForm from './components/auth/RegistrationForm';
import LoginForm from './components/auth/LoginForm';
import DevPasswordResetForm from './components/auth/DevPasswordResetForm';
import ProtectedRoute from './components/routing/ProtectedRoute';
import QuestPage from './pages/QuestPage'; // This is the OLD Quests CRUD page
import TagsPage from './pages/TagsPage';
import DashboardPage from './pages/DashboardPage';
import ScheduledMissionsPage from './pages/ScheduledMissionsPage';
import HabitTemplatesPage from './pages/HabitTemplatesPage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';
import ProfilePage from './pages/ProfilePage';
import PoolMissionsPage from './pages/PoolMissionsPage';

// NEW Pages for Quest Overview and Detail
import QuestsOverviewPage from './pages/QuestsOverviewPage';
import QuestDetailPage from './pages/QuestDetailPage';
import LogbookPage from './pages/LogbookPage';


import './App.css';
import './index.css';
import './styles/layout.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function HomePage() {
    const { currentUser } = useContext(UserContext);
    const isAuthenticated = !!currentUser;
    return (
        <div className="page-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
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
    const { currentUser, isLoadingProfile, fetchUserProfile } = useContext(UserContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [activeTagFilters, setActiveTagFilters] = useState([]);
    const isAuthenticatedAndReady = !isLoadingProfile && !!currentUser;

    const handleTagFilterChange = (tagId) => {
        setActiveTagFilters(prevFilters =>
            prevFilters.includes(tagId)
                ? prevFilters.filter(id => id !== tagId)
                : [...prevFilters, tagId]
        );
    };

    useEffect(() => {
        // This effect was for loading sidebarTagFilters from currentUser.settings
        // We can keep it or manage activeTagFilters purely in App state if preferred
        // For now, let's assume activeTagFilters is primarily driven by user interaction via TagFilter component
    }, [currentUser]);

    const handleAuthSuccess = async () => {
        await fetchUserProfile();
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
            setActiveTagFilters([]); // Reset tag filters on logout
            await fetchUserProfile(); // This will set currentUser to null
            navigate('/login');
        }
    };
    
    useEffect(() => {
        const handleStorageChange = (event) => {
            if (event.key === 'authToken' || event.key === 'currentUser') {
                fetchUserProfile();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        const token = localStorage.getItem('authToken');
        if (token && !currentUser && !isLoadingProfile) {
             fetchUserProfile();
        }
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, fetchUserProfile, currentUser, isLoadingProfile]);


    if (isLoadingProfile && localStorage.getItem('authToken')) {
        return <div className="app-container-loading">Loading Your Realm...</div>;
    }

    return (
        <div className="app-container">
            <TopBar isAuthenticated={isAuthenticatedAndReady} handleLogout={handleLogout} />

            <div className="app-body-layout">
                {isAuthenticatedAndReady && (
                    <LeftSidebar
                        activeTagFilters={activeTagFilters}
                        onTagFilterChange={handleTagFilterChange}
                    />
                )}
                <MainContentArea isAuthenticated={isAuthenticatedAndReady}>
                    <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/register" element={<RegistrationForm onAuthSuccess={handleAuthSuccess} />} />
                        <Route path="/login" element={<LoginForm onAuthSuccess={handleAuthSuccess} />} />
                        <Route path="/dev-password-reset" element={<DevPasswordResetForm />} />

                        <Route element={<ProtectedRoute />}>
                            <Route
                                path="/dashboard"
                                element={<DashboardPage activeTagFilters={activeTagFilters} />}
                            />
                             <Route
                                path="/calendar"
                                element={<CalendarPage activeTagFilters={activeTagFilters} />}
                            />
                            {/* New Quests Overview Page */}
                            <Route 
                                path="/quests-overview" 
                                element={<QuestsOverviewPage activeTagFilters={activeTagFilters} />} 
                            />
                            {/* New Quest Detail Page */}
                            <Route 
                                path="/quests/:questId" 
                                element={<QuestDetailPage activeTagFilters={activeTagFilters} />} 
                            />
                            <Route path="/logbook" element={<LogbookPage />} /> {/* General Logbook */}
                            <Route path="/logbook/quest/:questId" element={<LogbookPage />} /> {/* Quest-specific Logbook */}
              
                            
                            {/* Pages under "Lists" dropdown */}
                            <Route
                                path="/pool-missions"
                                element={<PoolMissionsPage activeTagFilters={activeTagFilters} />}
                            />
                            <Route
                                path="/scheduled-missions"
                                element={<ScheduledMissionsPage activeTagFilters={activeTagFilters} />}
                            />
                            <Route
                                path="/habit-templates"
                                element={<HabitTemplatesPage activeTagFilters={activeTagFilters} />}
                            />
                            <Route path="/quests" element={<QuestPage />} /> {/* This is for Manage Quests (CRUD) */}
                            <Route path="/tags" element={<TagsPage />} />   {/* This is for Manage Tags (CRUD) */}
                            
                            {/* Settings and Profile */}
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/profile" element={<ProfilePage />} />
                        </Route>

                        <Route path="*" element={
                            <div className="page-container" style={{ textAlign: 'center', paddingTop: '5rem' }}>
                                <h2>404 - Page Not Found</h2>
                                <p>The page you are looking for does not exist.</p>
                                <Link to="/" className="nav-link-layout">Go to Homepage</Link>
                            </div>
                        } />
                    </Routes>
                </MainContentArea>
            </div>

            <footer className="main-footer">
                <p>&copy; {new Date().getFullYear()} Iter Polaris. Chart your course.</p>
            </footer>
        </div>
    );
}

export default App;