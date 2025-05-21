// frontend/src/components/gamification/EnergyBalanceBar.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../../styles/gamification.css'; // Crearemos este archivo CSS

const API_ENERGY_BALANCE_URL = `${import.meta.env.VITE_API_BASE_URL}/gamification/energy-balance`;

function EnergyBalanceBar() {
    const [balanceData, setBalanceData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchEnergyBalance = useCallback(async () => {
        setIsLoading(true);
        setError('');
        const token = localStorage.getItem('authToken');
        if (!token) {
            setIsLoading(false);
            // No establecer error si el usuario simplemente no está logueado
            // setError('User not authenticated.'); 
            return;
        }

        try {
            const response = await axios.get(API_ENERGY_BALANCE_URL, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setBalanceData(response.data);
        } catch (err) {
            console.error("Failed to fetch energy balance:", err);
            setError(err.response?.data?.error || "Could not load energy balance.");
            setBalanceData(null); // Clear data on error
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEnergyBalance();
        // Podríamos añadir un intervalo para refrescar la barra periódicamente si es necesario
        // const interval = setInterval(fetchEnergyBalance, 60000); // cada minuto
        // return () => clearInterval(interval);
    }, [fetchEnergyBalance]);

    if (isLoading) {
        return <div className="energy-balance-bar-container loading">Loading Energy Balance...</div>;
    }

    if (error) {
        // No mostrar error directamente en la barra, podría ser intrusivo.
        // Console log es suficiente o un indicador sutil.
        console.error("EnergyBalanceBar Error:", error);
        return <div className="energy-balance-bar-container error">Energy data unavailable.</div>;
    }

    if (!balanceData) {
        return <div className="energy-balance-bar-container"></div>; // No mostrar nada si no hay datos y no hay error (ej. no logueado)
    }

    const { balance_percentage, zone } = balanceData;
    let barColorClass = '';
    let zoneText = 'Balanced';

    switch (zone) {
        case 'RED':
            barColorClass = 'energy-bar-red';
            zoneText = 'Effort Zone'; // O "Danger Zone", "Burnout Risk", etc.
            break;
        case 'GREEN':
            barColorClass = 'energy-bar-green';
            zoneText = 'Balance Zone';
            break;
        case 'YELLOW':
            barColorClass = 'energy-bar-yellow';
            zoneText = 'Recovery Zone'; // O "Overly Positive", "Relaxed"
            break;
        default:
            barColorClass = 'energy-bar-neutral';
            zoneText = 'Neutral';
    }
    
    // Para el indicador de estrella
    const starPosition = `${Math.max(0, Math.min(100, balance_percentage))}%`;

    return (
        <div className="energy-balance-bar-container">
            <div className="energy-balance-bar-label">
                <span>7-Day Energy Flow: <span className={`zone-text ${zone}`}>{zoneText}</span></span>
                <span>{balance_percentage}%</span>
            </div>
            <div className="energy-bar-track">
                <div 
                    className={`energy-bar-fill ${barColorClass}`} 
                    style={{ width: `${balance_percentage}%` }}
                >
                </div>
                <div className="energy-bar-indicator" style={{ left: `calc(${starPosition} - 8px)` }}> {/* Ajustar -8px para centrar el indicador */}
                    {/* Podríamos usar un SVG o un carácter de estrella aquí */}
                    ★
                </div>
            </div>
        </div>
    );
}

export default EnergyBalanceBar;