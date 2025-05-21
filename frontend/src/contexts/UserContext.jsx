// frontend/src/contexts/UserContext.jsx
import React, { createContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

const API_USER_PROFILE_URL = `${import.meta.env.VITE_API_BASE_URL}/auth/me`;
const API_ENERGY_BALANCE_URL = `${import.meta.env.VITE_API_BASE_URL}/gamification/energy-balance`;

// frontend/src/contexts/UserContext.jsx
// ... (imports) ...

export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [energyBalance, setEnergyBalance] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true); // Inicia como true
    const [isLoadingEnergy, setIsLoadingEnergy] = useState(true);  // Inicia como true
    const [authError, setAuthError] = useState(null);

    const fetchUserProfile = useCallback(async (tokenOverride = null) => {
        const token = tokenOverride || localStorage.getItem('authToken'); // Permite pasar un token (ej. post-login)
        
        if (!token) {
            setCurrentUser(null);
            setEnergyBalance(null); // Limpiar también el balance de energía
            setIsLoadingProfile(false);
            setIsLoadingEnergy(false); // Asegurar que este también se ponga en false
            setAuthError(null);
            // console.log("UserContext: No token, user set to null");
            return;
        }

        // console.log("UserContext: Token found, fetching profile...");
        setIsLoadingProfile(true);
        setAuthError(null);
        try {
            const response = await axios.get(API_USER_PROFILE_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setCurrentUser(response.data);
            localStorage.setItem('currentUser', JSON.stringify(response.data));
            // console.log("UserContext: Profile fetched", response.data);
        } catch (err) {
            console.error("UserContext: Failed to fetch user profile:", err.response?.data || err.message);
            setCurrentUser(null);
            setEnergyBalance(null);
            localStorage.removeItem('currentUser');
            // Considerar si remover el authToken aquí es muy agresivo. 
            // Podría ser un error de red temporal.
            // Mejor manejarlo en el interceptor de axios o en ProtectedRoute si el token es inválido.
            // localStorage.removeItem('authToken'); 
            setAuthError(err.response?.data?.error || "Could not load user data.");
            if (err.response?.status === 401) {
                // Token inválido, limpiar y posiblemente forzar logout en App.jsx
                localStorage.removeItem('authToken');
            }
        } finally {
            setIsLoadingProfile(false);
        }
    }, []);

    const fetchEnergyBalanceData = useCallback(async () => {
        const token = localStorage.getItem('authToken');
        // Modificado: solo cargar si hay currentUser y token
        if (!token || !currentUser) { 
            setEnergyBalance(null);
            setIsLoadingEnergy(false);
            return;
        }
        // console.log("UserContext: Fetching energy balance for user:", currentUser?.id);
        setIsLoadingEnergy(true);
        try {
            const response = await axios.get(API_ENERGY_BALANCE_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setEnergyBalance(response.data);
            // console.log("UserContext: Energy balance fetched", response.data);
        } catch (err) {
            console.error("UserContext: Failed to fetch energy balance:", err);
            setEnergyBalance(null);
        } finally {
            setIsLoadingEnergy(false);
        }
    }, [currentUser]); // Depende de currentUser

    useEffect(() => {
        // console.log("UserContext: Initial profile fetch effect");
        fetchUserProfile();
    }, [fetchUserProfile]);

    useEffect(() => {
        // console.log("UserContext: Energy balance fetch effect, currentUser changed:", currentUser);
        if (currentUser && !isLoadingProfile) { // Asegurarse que el perfil ya se intentó cargar
            fetchEnergyBalanceData();
        } else if (!currentUser) {
            setEnergyBalance(null); // Limpiar si no hay usuario
            setIsLoadingEnergy(false); // No hay energía que cargar
        }
    }, [currentUser, isLoadingProfile, fetchEnergyBalanceData]);

    const refreshUserStatsAndEnergy = useCallback(async (updatedUserDataFromAction) => {
        // console.log("UserContext: Refreshing user stats and energy. Updated data from action:", updatedUserDataFromAction);
        let userToUpdateFrom = currentUser;

        if (updatedUserDataFromAction && updatedUserDataFromAction.total_points !== undefined) {
            const newLocalUser = { ...currentUser, ...updatedUserDataFromAction };
            setCurrentUser(newLocalUser);
            localStorage.setItem('currentUser', JSON.stringify(newLocalUser));
            userToUpdateFrom = newLocalUser; // Usar estos datos para el refresh de energía
        } else {
            await fetchUserProfile(); // Esto actualizará currentUser internamente
             // Necesitamos esperar a que fetchUserProfile termine para tener el currentUser más reciente
             // Esto es un poco complicado sin async/await directo en el setter de estado.
             // Una alternativa es que fetchUserProfile devuelva el usuario.
        }
        
        // Forzar refetch de energía después de que currentUser se haya actualizado.
        // El useEffect que depende de 'currentUser' para fetchEnergyBalanceData se encargará de esto.
        // Si la actualización fue local (con updatedUserDataFromAction), y currentUser ya está actualizado,
        // el siguiente useEffect [currentUser, fetchEnergyBalanceData] lo tomará.
        // Si fue un fetchUserProfile completo, también.
        // Para asegurar que se llama *después* de que el estado de currentUser se propague:
        if (userToUpdateFrom) { // Si tenemos un usuario después de la actualización
            // Llamar directamente a fetchEnergyBalanceData o depender del useEffect.
            // Llamar directamente aquí puede ser más determinista.
            const token = localStorage.getItem('authToken');
            if (token) {
                setIsLoadingEnergy(true);
                try {
                    const response = await axios.get(API_ENERGY_BALANCE_URL, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    setEnergyBalance(response.data);
                } catch (err) {
                    console.error("UserContext: Failed to fetch energy balance post-refresh:", err);
                    setEnergyBalance(null);
                } finally {
                    setIsLoadingEnergy(false);
                }
            }
        } else { // Si no hay usuario (ej. logout), limpiar
            setEnergyBalance(null);
            setIsLoadingEnergy(false);
        }

    }, [currentUser, fetchUserProfile, fetchEnergyBalanceData]);
    
    const updateLocalCurrentUser = useCallback((newUserData) => {
        const token = localStorage.getItem('authToken');
        if (token) { // Solo actualizar si sigue habiendo un token
            const storedUserStr = localStorage.getItem('currentUser');
            let StoredUser = null;
            if (storedUserStr) {
                try { StoredUser = JSON.parse(storedUserStr); } catch(e) { console.error(e); }
            }
            const updatedUser = { ...StoredUser, ...currentUser, ...newUserData }; // Combinar todas las fuentes
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
        isLoadingProfile, // Exponer isLoadingProfile
        isLoadingEnergy,  // Exponer isLoadingEnergy
        authError,
        refreshUserStatsAndEnergy,
        fetchUserProfile,
        updateLocalCurrentUser
    };

    return (
        <UserContext.Provider value={contextValue}>
            {children}
        </UserContext.Provider>
    );
};