// frontend/src/components/gamification/EnergyBalanceBar.jsx
import React, { useContext, useEffect, useRef, useState } from 'react';
import { UserContext } from '../../contexts/UserContext';
import '../../styles/gamification.css'; // Ensure this CSS provides a container for the canvas

// Thresholds from PRD 2.6.1
const NEGATIVE_THRESHOLD = 39; // 0-39% is Red
const POSITIVE_THRESHOLD = 60; // 40-60% is Green, 61-100% is Yellow

// Asset paths (assuming they are in public/assets/)
const indicatorImageSources = {
    RED: '/assets/burned.png',
    GREEN: '/assets/balance.png',
    YELLOW: '/assets/lazy.png',
    NEUTRAL: '/assets/balance.png' // Default
};

function EnergyBalanceBar() {
    const { energyBalance, isLoadingEnergy } = useContext(UserContext);
    const canvasRef = useRef(null);
    const animationFrameIdRef = useRef(null);
    const [images, setImages] = useState({
        RED: null, GREEN: null, YELLOW: null, NEUTRAL: null
    });
    const [imagesLoaded, setImagesLoaded] = useState(false);

    // Load images
    useEffect(() => {
        let loadedCount = 0;
        const numImages = Object.keys(indicatorImageSources).length;
        const loadedImages = {};

        Object.entries(indicatorImageSources).forEach(([key, src]) => {
            const img = new Image();
            img.onload = () => {
                loadedCount++;
                loadedImages[key] = img;
                if (loadedCount === numImages) {
                    setImages(loadedImages);
                    setImagesLoaded(true);
                    console.log("[EnergyBalanceBar] All star images loaded.");
                }
            };
            img.onerror = () => {
                loadedCount++; // Count it as "processed" to not hang loading
                console.error(`[EnergyBalanceBar] Failed to load image: ${src}`);
                if (loadedCount === numImages && Object.keys(loadedImages).length > 0) {
                    setImages(loadedImages); // Set what has loaded
                    setImagesLoaded(true); // Still proceed if some fail, will use fallback
                } else if (loadedCount === numImages){
                     setImagesLoaded(true); // No images loaded, still set loaded to true to avoid hang
                }
            };
            img.src = src;
        });
    }, []);


    useEffect(() => {
        if (!energyBalance || isLoadingEnergy || !imagesLoaded || !canvasRef.current) {
            // If loading or no data, or images not ready, cancel any existing animation
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
            // Optionally, draw a static loading/neutral state on canvas here if desired
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { balance_percentage, zone } = energyBalance;
        let animationRunning = true;

        // Canvas drawing logic
        const draw = (timestamp) => {
            if (!animationRunning || !canvasRef.current) return;
            
            const dpr = window.devicePixelRatio || 1;
            const parentElement = canvasRef.current.parentElement;
            if (!parentElement) return;

            const rect = parentElement.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                 animationFrameIdRef.current = requestAnimationFrame(draw);
                return;
            }
            
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
            }
            const renderWidth = rect.width;
            const renderHeight = rect.height;

            ctx.clearRect(0, 0, renderWidth, renderHeight);

            // --- Define state-specific visual parameters ---
            let baseColor, glowColor, particleColor, waveFrequency, waveAmplitude, particleSpeed, starImage;
            const now = timestamp / 1000; // time in seconds

            switch (zone) {
                case 'RED': // Stress/Burnout
                    baseColor = `rgba(231, 76, 60, 0.7)`; // var(--color-error) with alpha
                    glowColor = `rgba(231, 76, 60, 0.5)`;
                    particleColor = `rgba(255, 107, 107, 0.8)`;
                    waveFrequency = 0.05;
                    waveAmplitude = renderHeight * 0.15;
                    particleSpeed = 0.8;
                    starImage = images.RED || images.NEUTRAL;
                    break;
                case 'YELLOW': // Lazy/Boredom
                    baseColor = `rgba(241, 196, 15, 0.7)`; // var(--color-warning) with alpha
                    glowColor = `rgba(241, 196, 15, 0.4)`;
                    particleColor = `rgba(255, 215, 0, 0.6)`;
                    waveFrequency = 0.02;
                    waveAmplitude = renderHeight * 0.05;
                    particleSpeed = 0.2;
                    starImage = images.YELLOW || images.NEUTRAL;
                    break;
                case 'GREEN': // Balanced/Optimal
                default:
                    baseColor = `rgba(46, 204, 113, 0.7)`; // var(--color-success) with alpha
                    glowColor = `rgba(80, 200, 120, 0.5)`;
                    particleColor = `rgba(80, 200, 120, 0.7)`;
                    waveFrequency = 0.03;
                    waveAmplitude = renderHeight * 0.1;
                    particleSpeed = 0.5;
                    starImage = images.GREEN || images.NEUTRAL;
                    break;
            }
            
            // --- Background fill (subtle) ---
            ctx.fillStyle = 'rgba(30, 41, 59, 0.4)'; // slate-800 with transparency
            ctx.fillRect(0, 0, renderWidth, renderHeight);

            // --- Central Optimal Zone Highlight (Greenish Glow) ---
            const optimalZoneStartPercent = 40;
            const optimalZoneEndPercent = 60;
            const optimalZoneCanvasStart = renderWidth * (optimalZoneStartPercent / 100);
            const optimalZoneCanvasEnd = renderWidth * (optimalZoneEndPercent / 100);
            const optimalZoneWidth = optimalZoneCanvasEnd - optimalZoneCanvasStart;

            const optimalGradient = ctx.createLinearGradient(optimalZoneCanvasStart - optimalZoneWidth * 0.3, 0, optimalZoneCanvasEnd + optimalZoneWidth * 0.3, 0);
            optimalGradient.addColorStop(0, "rgba(46, 204, 113, 0)");
            optimalGradient.addColorStop(0.3, "rgba(46, 204, 113, 0.15)");
            optimalGradient.addColorStop(0.5, "rgba(46, 204, 113, 0.25)");
            optimalGradient.addColorStop(0.7, "rgba(46, 204, 113, 0.15)");
            optimalGradient.addColorStop(1, "rgba(46, 204, 113, 0)");
            ctx.fillStyle = optimalGradient;
            ctx.fillRect(optimalZoneCanvasStart - optimalZoneWidth * 0.3, 0, (optimalZoneWidth * 1.6), renderHeight);


            // --- Cosmic Waves (state-dependent) ---
            const centerY = renderHeight / 2;
            const numWaves = 2;
            for (let i = 0; i < numWaves; i++) {
                ctx.beginPath();
                const wavePhase = now * particleSpeed * (0.8 + i * 0.4);
                const currentWaveAmplitude = waveAmplitude * (1 - i * 0.3);
                ctx.moveTo(0, centerY);
                for (let x = 0; x <= renderWidth; x += 5) {
                    const y = centerY + Math.sin(x * waveFrequency + wavePhase + i * Math.PI / 2) * currentWaveAmplitude * (Math.sin(x / (renderWidth / (Math.PI*2))) + 0.5) ;
                    ctx.lineTo(x, y);
                }
                ctx.lineTo(renderWidth, renderHeight);
                ctx.lineTo(0, renderHeight);
                ctx.closePath();
                ctx.fillStyle = zone === 'RED' ? `rgba(192, 57, 43, ${0.15 - i * 0.05})` : 
                                zone === 'YELLOW' ? `rgba(243, 156, 18, ${0.1 - i * 0.03})` :
                                `rgba(39, 174, 96, ${0.12 - i * 0.04})`; // Green base for waves
                ctx.fill();
            }
            
            // --- Particles (optional, can be intensive) ---
            // For simplicity, this example omits complex particle systems.
            // Could be added here if desired.

            // --- Draw the indicator star ---
            const indicatorPosition = renderWidth * (balance_percentage / 100);
            const starSize = renderHeight * 2.0; // Make star larger than bar height
            const starX = Math.max(starSize / 2, Math.min(renderWidth - starSize / 2, indicatorPosition)) - starSize / 2;
            const starY = centerY - starSize / 2;

            if (starImage && starImage.complete && starImage.naturalWidth > 0) {
                const pulse = (Math.sin(now * 1.5) + 1) / 2; // 0 to 1
                const shadowBlur = 5 + pulse * 10;
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = shadowBlur;
                ctx.drawImage(starImage, starX, starY, starSize, starSize);
                ctx.shadowBlur = 0; // Reset shadow
            } else {
                 // Fallback: Draw a simple circle if image not loaded/failed
                ctx.beginPath();
                ctx.arc(indicatorPosition, centerY, renderHeight * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = particleColor || 'white';
                ctx.fill();
            }
            
            animationFrameIdRef.current = requestAnimationFrame(draw);
        };

        draw(performance.now()); // Start animation

        return () => {
            animationRunning = false;
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, [energyBalance, isLoadingEnergy, imagesLoaded, images]);


    const renderContent = () => {
        if (isLoadingEnergy && !energyBalance) {
            return <div className="energy-balance-bar-status-text">Loading Energy Flow...</div>;
        }
        if (!energyBalance) {
            return <div className="energy-balance-bar-status-text">Energy data unavailable.</div>;
        }
        // Canvas will be rendered if data is available and images loaded
        return null; 
    };

    // The text label part
    let zoneText = 'Neutral';
    let zoneClass = 'NEUTRAL';
    if (energyBalance) {
        switch (energyBalance.zone) {
            case 'RED': zoneText = 'Effort Zone'; zoneClass = 'RED'; break;
            case 'GREEN': zoneText = 'Balance Zone'; zoneClass = 'GREEN'; break;
            case 'YELLOW': zoneText = 'Recovery Zone'; zoneClass = 'YELLOW'; break;
            default: zoneText = 'Neutral'; zoneClass = 'NEUTRAL';
        }
    }
    const displayPercentage = energyBalance ? energyBalance.balance_percentage : '--';

    return (
        <div className="energy-balance-bar-container">
            <div className="energy-balance-bar-label">
                <span>7-Day Energy Flow: <span className={`zone-text ${zoneClass}`}>{zoneText}</span></span>
                <span>{displayPercentage}%</span>
            </div>
            <div className="energy-bar-canvas-wrapper"> {/* This wrapper will define the canvas size */}
                <canvas ref={canvasRef} />
                {renderContent()}
            </div>
        </div>
    );
}

export default EnergyBalanceBar;