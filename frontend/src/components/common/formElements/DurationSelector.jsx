import React, { useState, useEffect } from 'react';
import '../../../styles/DurationSelector.css'; // To be created

const DURATION_OPTIONS = [
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '45m', value: 45 },
    { label: '1h', value: 60 },
    { label: '1.5h', value: 90 },
    { label: '2h', value: 120 },
    { label: '3h', value: 180 },
];

function DurationSelector({ value = 60, onChange, disabled = false }) {
    const [currentValue, setCurrentValue] = useState(value);
    const [showCustom, setShowCustom] = useState(false);
    const [customHours, setCustomHours] = useState(Math.floor(value / 60));
    const [customMinutes, setCustomMinutes] = useState(value % 60);

    useEffect(() => {
        setCurrentValue(value);
        const isPreset = DURATION_OPTIONS.some(opt => opt.value === value);
        if (!isPreset && value !== 0) { // if value is not 0 and not preset, it's custom
            setShowCustom(true);
            setCustomHours(Math.floor(value / 60));
            setCustomMinutes(value % 60);
        } else {
            setShowCustom(false);
        }
    }, [value]);

    const handleOptionClick = (minutes) => {
        if (disabled) return;
        setCurrentValue(minutes);
        onChange(minutes);
        setShowCustom(false);
    };

    const handleCustomToggle = () => {
        if (disabled) return;
        setShowCustom(prev => !prev);
        if (!showCustom) { // When opening custom, if current value is preset, reset custom inputs
             if (DURATION_OPTIONS.some(opt => opt.value === currentValue)) {
                setCustomHours(Math.floor(currentValue / 60));
                setCustomMinutes(currentValue % 60);
             }
        } else { // When closing custom, if current value was from custom, ensure it's set
            const totalCustomMinutes = customHours * 60 + customMinutes;
            if (totalCustomMinutes > 0 && currentValue !== totalCustomMinutes) {
                 // onChange(totalCustomMinutes); // Option: update immediately on closing custom
            }
        }
    };
    
    const handleCustomHoursChange = (e) => {
        if (disabled) return;
        const hrs = parseInt(e.target.value, 10) || 0;
        setCustomHours(hrs);
        onChange(hrs * 60 + customMinutes);
    };

    const handleCustomMinutesChange = (e) => {
        if (disabled) return;
        const mins = parseInt(e.target.value, 10) || 0;
        setCustomMinutes(mins % 60); // Ensure minutes are within 0-59, or handle larger if desired
        onChange(customHours * 60 + (mins % 60));
    };


    return (
        <div className={`duration-selector-container ${disabled ? 'disabled' : ''}`}>
            <label>Duration:</label>
            <div className="duration-options-group">
                {DURATION_OPTIONS.map(opt => (
                    <button
                        type="button"
                        key={opt.value}
                        className={`duration-option-button ${currentValue === opt.value && !showCustom ? 'active' : ''}`}
                        onClick={() => handleOptionClick(opt.value)}
                        disabled={disabled}
                        aria-pressed={currentValue === opt.value && !showCustom}
                    >
                        {opt.label}
                    </button>
                ))}
                <button
                    type="button"
                    className={`duration-option-button custom-toggle ${showCustom ? 'active' : ''}`}
                    onClick={handleCustomToggle}
                    disabled={disabled}
                    aria-expanded={showCustom}
                >
                    Custom
                </button>
            </div>
            {showCustom && (
                <div className="custom-duration-inputs">
                    <input
                        type="number"
                        value={customHours}
                        onChange={handleCustomHoursChange}
                        min="0"
                        max="23"
                        aria-label="Custom duration hours"
                        disabled={disabled}
                    />
                    <span>h</span>
                    <input
                        type="number"
                        value={customMinutes}
                        onChange={handleCustomMinutesChange}
                        min="0"
                        max="59"
                        step="1"
                        aria-label="Custom duration minutes"
                        disabled={disabled}
                    />
                    <span>m</span>
                </div>
            )}
        </div>
    );
}
export default DurationSelector;