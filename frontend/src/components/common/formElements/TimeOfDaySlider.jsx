import React, { useState, useEffect, useMemo } from 'react';
import '../../../styles/TimeOfDaySlider.css'; // To be created

const TIME_SLOTS = Array.from({ length: 24 * 4 }, (_, i) => { // 15-min intervals
    const hour = Math.floor(i / 4);
    const minute = (i % 4) * 15;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

// Define time sections for styling/labels
const TIME_SECTIONS = [
    { name: 'Madrugada', start: 0, end: 5, color: 'var(--color-time-madrugada, #1C2A4F)' }, // Deep blue/purple
    { name: 'Mañana', start: 6, end: 11, color: 'var(--color-time-manana, #529BFF)' },     // Lighter blue/soft yellow
    { name: 'Tarde', start: 12, end: 18, color: 'var(--color-time-tarde, #B08D57)' },      // Warm parchment/gold
    { name: 'Noche', start: 19, end: 23, color: 'var(--color-time-noche, #304057)' }       // Darker blue/silver
];

function TimeOfDaySlider({ value = "12:00", onChange, disabled = false }) {
    const timeToIndex = (timeStr) => {
        if (!timeStr || !/^\d{2}:\d{2}$/.test(timeStr)) return TIME_SLOTS.indexOf("12:00");
        return TIME_SLOTS.indexOf(timeStr);
    };

    const indexToTime = (index) => TIME_SLOTS[index] || "00:00";

    const [currentIndex, setCurrentIndex] = useState(timeToIndex(value));

    useEffect(() => {
        setCurrentIndex(timeToIndex(value));
    }, [value]);

    const handleSliderChange = (event) => {
        const newIndex = parseInt(event.target.value, 10);
        setCurrentIndex(newIndex);
        onChange(indexToTime(newIndex));
    };

    const currentTime = indexToTime(currentIndex);
    const currentHour = parseInt(currentTime.split(':')[0], 10);

    const getSectionIndicator = () => {
        for (const section of TIME_SECTIONS) {
            if (currentHour >= section.start && currentHour <= section.end) {
                return (
                    <span className="time-section-indicator" style={{ color: section.color }}>
                        {section.name}
                    </span>
                );
            }
        }
        return null;
    };
    
    const sliderBackground = useMemo(() => {
        let gradientString = 'linear-gradient(to right, ';
        let currentPercentage = 0;
        TIME_SECTIONS.forEach((section, idx) => {
            const sectionStartPercentage = (section.start * 4 / TIME_SLOTS.length) * 100;
            const sectionEndPercentage = ((section.end + 1) * 4 / TIME_SLOTS.length) * 100;
            
            if (sectionStartPercentage > currentPercentage) {
                 gradientString += `var(--color-bg-deep-blue) ${currentPercentage}%, var(--color-bg-deep-blue) ${sectionStartPercentage}%, `;
            }
            gradientString += `${section.color} ${sectionStartPercentage}%, ${section.color} ${sectionEndPercentage}%`;
            currentPercentage = sectionEndPercentage;

            if (idx < TIME_SECTIONS.length - 1) {
                gradientString += ', ';
            }
        });
        if (currentPercentage < 100) {
            gradientString += `, var(--color-bg-deep-blue) ${currentPercentage}%`;
        }
        gradientString += ')';
        return gradientString;
    }, []);


    return (
        <div className={`time-of-day-slider-container ${disabled ? 'disabled' : ''}`}>
            <label htmlFor="time-of-day-input">
                Start Time:
                <span className="time-value-display">
                    {currentTime} {getSectionIndicator()}
                </span>
            </label>
            <input
                type="range"
                id="time-of-day-input"
                min="0"
                max={TIME_SLOTS.length - 1}
                value={currentIndex}
                onChange={handleSliderChange}
                disabled={disabled}
                className="time-of-day-slider-input"
                style={{'--slider-track-background': sliderBackground }}
            />
            <div className="time-of-day-slider-labels">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:45</span>
            </div>
        </div>
    );
}

export default TimeOfDaySlider;