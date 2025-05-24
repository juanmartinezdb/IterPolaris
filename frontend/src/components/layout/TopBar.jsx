// frontend/src/components/layout/TopBar.jsx
import React, { useState, useContext, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../../contexts/UserContext';
import EnergyBalanceBar from '../gamification/EnergyBalanceBar';
// Ensure layout.css is created and imported
// import '../../styles/layout.css'; // Will be created next

function TopBar({ isAuthenticated, handleLogout }) {
    const navigate = useNavigate();
    const { currentUser } = useContext(UserContext);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    // const navigate = useNavigate(); // Keep for future use (Profile/Settings)

    const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

    const handleLogoutClick = () => {
        setDropdownOpen(false);
        handleLogout();
    };
    
    // Placeholder actions for Profile and Settings
    const handleProfileClick = () => {
        setDropdownOpen(false);
        alert("Profile page - Coming soon!");
        // navigate('/profile'); // PRD: My Profile (read-only for MVP) - TBD in later tasks
    };

    const handleSettingsClick = () => {
        setDropdownOpen(false);
        navigate('/settings');
        // navigate('/settings'); // PRD: Settings (minimal, including Tag filter configuration) - Part of Task 9
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);


    return (
        <div className="main-header-layout"> {/* Renamed to avoid conflict with App.css's old .main-header */}
            <div className="top-bar-component">
                <Link to={isAuthenticated ? "/dashboard" : "/"} className="app-logo-layout">
                    <img src="/assets/logo_iter_polaris_light.png" alt="Iter Polaris Logo" className="themed-logo-img" />
                    Iter Polaris
                </Link>
                <nav className="main-navigation-layout">
                    {!isAuthenticated ? (
                        <>
                            <Link to="/register" className="nav-link-layout">Register</Link>
                            <Link to="/login" className="nav-link-layout">Login</Link>
                        </>
                    ) : (
                        <div className="user-avatar-dropdown-container" ref={dropdownRef}>
                            <button onClick={toggleDropdown} className="avatar-button" aria-label="User menu">
                                {currentUser?.avatar_url ? (
                                    <img src={currentUser.avatar_url} alt={currentUser.name} className="user-avatar-topbar" />
                                ) : (
                                    <div className="user-avatar-placeholder-topbar">
                                        {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                )}
                            </button>
                            {dropdownOpen && (
                                <ul className="dropdown-menu">
                                    <li className="dropdown-user-info">
                                        Signed in as <br /><strong>{currentUser?.name || 'User'}</strong>
                                    </li>
                                    <hr className="dropdown-divider" />
                                    <li onClick={handleProfileClick}>My Profile</li>
                                    <li onClick={handleSettingsClick}>Settings</li>
                                    <hr className="dropdown-divider" />
                                    <li onClick={handleLogoutClick}>Logout</li>
                                </ul>
                            )}
                        </div>
                    )}
                </nav>
            </div>
            {isAuthenticated && <EnergyBalanceBar />}
        </div>
    );
}

export default TopBar;