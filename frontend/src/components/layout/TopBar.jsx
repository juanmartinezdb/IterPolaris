// frontend/src/components/layout/TopBar.jsx
import React, { useState, useContext, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserContext } from '../../contexts/UserContext';
import EnergyBalanceBar from '../gamification/EnergyBalanceBar'; // Old bar
import '../../styles/layout.css'; 

function TopBar({ isAuthenticated, handleLogout }) {
    const { currentUser, energyBalance, isLoadingEnergy } = useContext(UserContext); // Get energyBalance and isLoadingEnergy
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();

    const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

    const handleLogoutClick = () => {
        setDropdownOpen(false);
        handleLogout();
    };
    
    const handleProfileClick = () => {
        setDropdownOpen(false);
        navigate('/profile');
    };

    const handleSettingsClick = () => {
        setDropdownOpen(false);
        navigate('/settings');
    };

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
        <div className="main-header-layout">
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
                                    {currentUser?.fullAvatarUrl ? (
                                        <img src={currentUser.fullAvatarUrl} alt={currentUser.name} className="user-avatar-topbar" />
                                    ) : (
                                    <div className="user-avatar-placeholder-topbar">
                                        {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
                                    </div>
                                )}
                            </button>
                            {dropdownOpen && (
                                <ul className={`dropdown-menu ${dropdownOpen ? 'open' : ''}`}>
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