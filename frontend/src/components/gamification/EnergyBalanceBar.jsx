// frontend/src/components/gamification/EnergyBalanceBar.jsx
import React, { useContext } from 'react'; // No más useState, useEffect, useCallback, axios aquí
import { UserContext } from '../../contexts/UserContext'; // Importar contexto
import '../../styles/gamification.css'; 

// Asegúrate que las imágenes estén en /public/assets/
const indicatorImages = {
    RED: '/assets/burned.png',    // Para energía baja/negativa
    GREEN: '/assets/balance.png', // Para energía balanceada
    YELLOW: '/assets/lazy.png',   // Para energía demasiado positiva/sin retos
    NEUTRAL: '/assets/balance.png'// Default o para cuando no hay datos claros
};

function EnergyBalanceBar() {
    const { energyBalance, isLoadingEnergy } = useContext(UserContext);

    // No necesitamos el error local aquí, el contexto podría manejarlo o simplemente no renderizar si hay error.
    // El isLoading y los datos vienen del contexto.

    if (isLoadingEnergy && !energyBalance) { // Muestra loading solo si realmente no hay datos previos
        return <div className="energy-balance-bar-container loading">Loading Energy Balance...</div>;
    }
    
    // Si no hay datos de balance (podría ser por error en fetch o usuario no logueado)
    // renderizar una barra neutral o vacía para mantener el layout.
    if (!energyBalance) {
        return (
            <div className="energy-balance-bar-container">
                <div className="energy-balance-bar-label">
                    <span>7-Day Energy Flow: <span className="zone-text NEUTRAL">Neutral</span></span>
                    <span>--%</span>
                </div>
                <div className="energy-bar-track">
                    <div 
                        className="energy-bar-fill energy-bar-neutral"
                        style={{ width: `50%` }} // Default a 50% si no hay datos
                    >
                    </div>
                    <img 
                        src={indicatorImages.NEUTRAL} 
                        alt="Neutral Energy" 
                        className="energy-bar-indicator-img" 
                        style={{ left: `calc(50% - 8px)` }}
                    />
                </div>
            </div>
        );
    }

    const { balance_percentage, zone } = energyBalance;
    let barColorClass = '';
    let zoneText = 'Neutral';
    let indicatorSrc = indicatorImages.NEUTRAL;

    switch (zone) {
        case 'RED':
            barColorClass = 'energy-bar-red';
            zoneText = 'Effort Zone';
            indicatorSrc = indicatorImages.RED;
            break;
        case 'GREEN':
            barColorClass = 'energy-bar-green';
            zoneText = 'Balance Zone';
            indicatorSrc = indicatorImages.GREEN;
            break;
        case 'YELLOW':
            barColorClass = 'energy-bar-yellow';
            zoneText = 'Recovery Zone';
            indicatorSrc = indicatorImages.YELLOW;
            break;
        default: // NEUTRAL o cualquier otro caso
            barColorClass = 'energy-bar-neutral';
            zoneText = 'Neutral';
            indicatorSrc = indicatorImages.NEUTRAL; // O una imagen por defecto
    }
    
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
                <img 
                    src={indicatorSrc} 
                    alt={`${zoneText} Indicator`} 
                    className="energy-bar-indicator-img" 
                    style={{ left: `calc(${starPosition} - 8px)` }} // Ajustar para centrar la imagen (asumiendo 16px de ancho)
                />
            </div>
        </div>
    );
}

export default EnergyBalanceBar;