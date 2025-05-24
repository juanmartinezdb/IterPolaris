// frontend/src/contexts/UserContext.jsx
import React, { createContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_USER_PROFILE_URL = `${import.meta.env.VITE_API_BASE_URL}/auth/me`;
const API_ENERGY_BALANCE_URL = `${import.meta.env.VITE_API_BASE_URL}/gamification/energy-balance`;

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
            setCurrentUser(null);
            setEnergyBalance(null); 
            setIsLoadingProfile(false);
            setIsLoadingEnergy(false); 
            setAuthError(null);
            localStorage.removeItem('currentUser'); // Asegurarse de limpiar aquí también
            return;
        }

        setIsLoadingProfile(true);
        setAuthError(null);
        try {
            const response = await axios.get(API_USER_PROFILE_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Asegurar que settings sea un objeto y tenga la clave esperada
            const userData = response.data;
            if (userData && typeof userData.settings !== 'object') {
                userData.settings = { sidebar_pinned_tag_ids: [] }; // Default si es null o no es objeto
            } else if (userData && userData.settings && !Array.isArray(userData.settings.sidebar_pinned_tag_ids)) {
                userData.settings.sidebar_pinned_tag_ids = []; // Default si la clave no es un array
            }


            setCurrentUser(userData);
            localStorage.setItem('currentUser', JSON.stringify(userData));
        } catch (err) {
            console.error("UserContext: Failed to fetch user profile:", err.response?.data || err.message);
            setCurrentUser(null);
            setEnergyBalance(null);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('authToken'); // Si falla el fetch del perfil, el token podría ser inválido
            setAuthError(err.response?.data?.error || "Could not load user data.");
        } finally {
            setIsLoadingProfile(false);
        }
    }, []);

    const fetchEnergyBalanceData = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        if (!token || !currentUser) { 
            setEnergyBalance(null);
            setIsLoadingEnergy(false);
            return;
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

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    useEffect(() => {
        if (currentUser && !isLoadingProfile) { 
            fetchEnergyBalanceData();
        } else if (!currentUser) {
            setEnergyBalance(null); 
            setIsLoadingEnergy(false); 
        }
    }, [currentUser, isLoadingProfile, fetchEnergyBalanceData]);

    const refreshUserStatsAndEnergy = useCallback(async (updatedUserDataFromAction) => {
        // Primero, actualiza el perfil del usuario para obtener los últimos puntos, nivel, y settings.
        // Si updatedUserDataFromAction tiene datos, se usarán para una actualización optimista local antes del fetch.
        if (updatedUserDataFromAction && updatedUserDataFromAction.total_points !== undefined) {
             // Actualización optimista local
            setCurrentUser(prevUser => {
                const newUser = { ...prevUser, ...updatedUserDataFromAction };
                localStorage.setItem('currentUser', JSON.stringify(newUser));
                return newUser;
            });
        }
        
        // Siempre refresca el perfil del backend para asegurar consistencia
        await fetchUserProfile(); 
        // fetchEnergyBalanceData se llamará automáticamente por el useEffect que depende de currentUser

    }, [fetchUserProfile]); // fetchEnergyBalanceData no necesita estar aquí si el useEffect de arriba lo maneja
    
    const updateLocalCurrentUser = useCallback((newUserData) => {
        const token = localStorage.getItem('authToken');
        if (token) { 
            const storedUserStr = localStorage.getItem('currentUser');
            let StoredUser = null;
            if (storedUserStr) {
                try { StoredUser = JSON.parse(storedUserStr); } catch(e) { console.error(e); }
            }
            // Asegurar que settings sea un objeto con la clave esperada
            let updatedSettings = newUserData.settings || StoredUser?.settings || {};
            if (typeof updatedSettings !== 'object' || updatedSettings === null) {
                updatedSettings = { sidebar_pinned_tag_ids: [] };
            }
            if (!Array.isArray(updatedSettings.sidebar_pinned_tag_ids)) {
                updatedSettings.sidebar_pinned_tag_ids = [];
            }
            newUserData.settings = updatedSettings;

            const updatedUser = { ...StoredUser, ...currentUser, ...newUserData }; 
            setCurrentUser(updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        } else {
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
        }
    }, [currentUser]);

    const contextValue = {
        currentUser,
        energyBalance,
        isLoadingProfile, 
        isLoadingEnergy,  
        authError,
        refreshUserStatsAndEnergy, // Esta función ahora también refrescará el perfil
        fetchUserProfile, // Exportar para que otras partes puedan forzar un refresh del perfil
        updateLocalCurrentUser // Para actualizaciones locales optimistas si es necesario
    };

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};