// frontend/src/contexts/UserContext.jsx
import React, { createContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL_CONTEXT = import.meta.env.VITE_API_BASE_URL; // e.g., http://localhost:5000/api
const API_USER_PROFILE_URL = `${API_BASE_URL_CONTEXT}/auth/me`;
const API_ENERGY_BALANCE_URL = `${API_BASE_URL_CONTEXT}/gamification/energy-balance`;

// Helper to get the domain root from the API base URL
const getBackendDomainRoot = (apiUrl) => {
    try {
        const url = new URL(apiUrl);
        return `${url.protocol}//${url.host}`; // Returns http://localhost:5000
    } catch (e) {
        console.error("Error parsing API_BASE_URL_CONTEXT to get domain root:", e);
        return ''; // Fallback, though this should ideally be a valid URL
    }
};
const BACKEND_DOMAIN_ROOT = getBackendDomainRoot(API_BASE_URL_CONTEXT);


export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [energyBalance, setEnergyBalance] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true); 
    const [isLoadingEnergy, setIsLoadingEnergy] = useState(true);  
    const [authError, setAuthError] = useState(null);

    const fetchUserProfile = useCallback(async (tokenOverride = null) => {
        const token = tokenOverride || localStorage.getItem('authToken');
        
        if (!token) {
            setCurrentUser(null); setEnergyBalance(null); 
            setIsLoadingProfile(false); setIsLoadingEnergy(false); 
            setAuthError(null); localStorage.removeItem('currentUser');
            return;
        }

        setIsLoadingProfile(true); setAuthError(null);
        try {
            const response = await axios.get(API_USER_PROFILE_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const userData = response.data;

            if (userData.avatar_url && userData.avatar_url.startsWith('/static/')) {
                // Prepend only the domain root for static assets
                userData.fullAvatarUrl = `${BACKEND_DOMAIN_ROOT}${userData.avatar_url}`;
            } else {
                userData.fullAvatarUrl = userData.avatar_url; // If it's already a full URL or null/empty
            }

            if (userData && typeof userData.settings !== 'object') {
                userData.settings = { sidebar_pinned_tag_ids: [] };
            } else if (userData && userData.settings && !Array.isArray(userData.settings.sidebar_pinned_tag_ids)) {
                userData.settings.sidebar_pinned_tag_ids = [];
            }

            setCurrentUser(userData);
            localStorage.setItem('currentUser', JSON.stringify(userData));
        } catch (err) {
            console.error("UserContext: Failed to fetch user profile:", err.response?.data || err.message);
            setCurrentUser(null); setEnergyBalance(null);
            localStorage.removeItem('currentUser'); localStorage.removeItem('authToken');
            setAuthError(err.response?.data?.error || "Could not load user data.");
        } finally {
            setIsLoadingProfile(false);
        }
    }, []); // Removed BACKEND_DOMAIN_ROOT from dependency array as it's module-level constant now

    const fetchEnergyBalanceData = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !currentUser) { 
            setEnergyBalance(null); setIsLoadingEnergy(false); return;
        }
        setIsLoadingEnergy(true);
        try {
            const response = await axios.get(API_ENERGY_BALANCE_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setEnergyBalance(response.data);
        } catch (err) {
            console.error("UserContext: Failed to fetch energy balance:", err);
            setEnergyBalance(null);
        } finally {
            setIsLoadingEnergy(false);
        }
    }, [currentUser]);

    useEffect(() => { fetchUserProfile(); }, [fetchUserProfile]);

    useEffect(() => {
        if (currentUser && !isLoadingProfile) { fetchEnergyBalanceData(); } 
        else if (!currentUser) { setEnergyBalance(null); setIsLoadingEnergy(false); }
    }, [currentUser, isLoadingProfile, fetchEnergyBalanceData]);

    const refreshUserStatsAndEnergy = useCallback(async (updatedUserDataFromAction) => {
        if (updatedUserDataFromAction && updatedUserDataFromAction.total_points !== undefined) {
            setCurrentUser(prevUser => {
                const newUser = { ...prevUser, ...updatedUserDataFromAction };
                if (newUser.avatar_url && newUser.avatar_url.startsWith('/static/')) {
                    newUser.fullAvatarUrl = `${BACKEND_DOMAIN_ROOT}${newUser.avatar_url}`;
                } else {
                    newUser.fullAvatarUrl = newUser.avatar_url;
                }
                localStorage.setItem('currentUser', JSON.stringify(newUser));
                return newUser;
            });
        }
        await fetchUserProfile(); 
    }, [fetchUserProfile]); // Removed BACKEND_DOMAIN_ROOT
    
    const updateLocalCurrentUser = useCallback((newUserData) => {
        const token = localStorage.getItem('authToken');
        if (token) { 
            let StoredUser = null;
            const storedUserStr = localStorage.getItem('currentUser');
            if (storedUserStr) { try { StoredUser = JSON.parse(storedUserStr); } catch(e) { console.error(e); } }
            
            const updatedUser = { ...(StoredUser || {}), ...currentUser, ...newUserData }; 
            
            if (updatedUser.avatar_url && updatedUser.avatar_url.startsWith('/static/')) {
                updatedUser.fullAvatarUrl = `${BACKEND_DOMAIN_ROOT}${updatedUser.avatar_url}`;
            } else {
                updatedUser.fullAvatarUrl = updatedUser.avatar_url;
            }

            let updatedSettings = updatedUser.settings || {};
            if (typeof updatedSettings !== 'object' || updatedSettings === null) {
                updatedSettings = { sidebar_pinned_tag_ids: [] };
            }
            if (!Array.isArray(updatedSettings.sidebar_pinned_tag_ids)) {
                updatedSettings.sidebar_pinned_tag_ids = [];
            }
            updatedUser.settings = updatedSettings;

            setCurrentUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        } else {
            setCurrentUser(null); localStorage.removeItem('currentUser');
        }
    }, [currentUser]); // Removed BACKEND_DOMAIN_ROOT

    const contextValue = {
        currentUser, energyBalance, isLoadingProfile, isLoadingEnergy,  
        authError, refreshUserStatsAndEnergy, fetchUserProfile, updateLocalCurrentUser
    };

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};