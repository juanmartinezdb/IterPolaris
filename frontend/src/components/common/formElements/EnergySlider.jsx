import React from 'react';
import '../../../styles/EnergySlider.css';

function EnergySlider({ value, onChange, min = -10, max = 10, step = 1, disabled = false }) {
    const handleSliderChange = (event) => {
        onChange(parseInt(event.target.value, 10));
    };

    let valueColorClass = 'neutral';
    let valueIcon = ''; // No icon for neutral by default

    if (value < 0) {
        valueColorClass = 'effort'; // Changed from 'negative'
        valueIcon = '💪'; // Effort icon
    } else if (value > 0) {
        valueColorClass = 'restorative'; // Changed from 'positive'
        valueIcon = '✨'; // Restorative icon
    }
    
    const simpleFillPercent = ((value - min) / (max - min)) * 100;

    return (
        <div className={`energy-slider-container ${disabled ? 'disabled' : ''}`}>
            <label htmlFor="energy-slider-input">Energy Value:
                <span className={`energy-value-display ${valueColorClass}`}>
                    {valueIcon && <span className="energy-icon" role="img" aria-label={valueColorClass}>{valueIcon}</span>}
                    {value > 0 ? `+${value}` : value}
                </span>
            </label>
            <input
                type="range"
                id="energy-slider-input"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleSliderChange}
                disabled={disabled}
                className="energy-slider-input"
                style={{ '--fill-percent': `${simpleFillPercent}%` }} 
            />
            <div className="energy-slider-labels">
                <span>{min}</span>
                <span>0</span>
                <span>{max}</span>
            </div>
        </div>
    );
}

export default EnergySlider;