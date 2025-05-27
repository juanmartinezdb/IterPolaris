import React from 'react';
import '../../../styles/PointsSelector.css';

const POINTS_OPTIONS = [
    { value: 1, label: '1', sizeClass: 'points-sm' },
    { value: 3, label: '3', sizeClass: 'points-md' },
    { value: 5, label: '5', sizeClass: 'points-lg' },
    { value: 10, label: '10', sizeClass: 'points-xl' } // 'points-xl' can be used for special styling
];

function PointsSelector({ value, onChange, disabled = false }) {
    const handlePointSelection = (pointsValue) => {
        if (!disabled) {
            onChange(pointsValue);
        }
    };

    return (
        <div className={`points-selector-container ${disabled ? 'disabled' : ''}`}>
            <label>Points Value:</label>
            <div className="points-options-group">
                {POINTS_OPTIONS.map((option) => (
                    <button
                        type="button"
                        key={option.value}
                        className={`point-option-button ${option.sizeClass} ${value === option.value ? 'active' : ''} ${option.value === 10 && value === 10 ? 'points-10-active' : ''}`}
                        onClick={() => handlePointSelection(option.value)}
                        disabled={disabled}
                        aria-pressed={value === option.value}
                    >
                        <span className="point-value">{option.label}</span>
                        <span className="point-label">pts</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

export default PointsSelector;