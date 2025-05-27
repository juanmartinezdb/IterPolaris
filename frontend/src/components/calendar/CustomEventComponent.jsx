// frontend/src/components/calendar/CustomEventComponent.jsx
import React from 'react';
import { getContrastColor } from '../../utils/colorUtils';
// Ensure missions-shared.css is imported if its classes are used, or define styles here
// For simplicity, explicit styling might be better here due to limited space in calendar events

const getEventBaseColor = (event, questColors) => {
    const questId = event.resource?.questId;
    if (questId && questColors && questColors[questId]) {
        return questColors[questId];
    }
    if (event.resource?.type === 'HABIT_OCCURRENCE') {
        return 'var(--color-purple-mystic, #6D21A9)';
    }
    return 'var(--color-accent-gold, #B08D57)';
};

function CustomEventComponent({ event, isSelected, questColors }) {
    const eventType = event.resource?.type;
    const status = event.resource?.status;
    const title = event.title || 'Untitled Event';
    const energyValue = event.resource?.original?.energy_value ?? 0; // Get energy value

    let typeIconSymbol = '';
    let typeIconTitle = '';

    if (eventType === 'SCHEDULED_MISSION') {
        typeIconSymbol = '🎯'; // Target for mission
        typeIconTitle = 'Scheduled Mission';
    } else if (eventType === 'HABIT_OCCURRENCE') {
        typeIconSymbol = '🔄'; // Repeat for habit
        typeIconTitle = 'Habit';
    }

    let energyIconSymbol = '';
    if (energyValue > 0) energyIconSymbol = '✨';
    else if (energyValue < 0) energyIconSymbol = '💪';

    const baseBgColor = getEventBaseColor(event, questColors);
    let effectiveBgColor = baseBgColor;
    let opacity = 1;
    let textDecoration = 'none';
    
    let energyBorderColor = 'transparent'; // Default no energy border
    if (!isSelected) { // Only apply energy border if not selected
        if (energyValue > 0) energyBorderColor = 'var(--color-feedback-info, #529BFF)';
        else if (energyValue < 0) energyBorderColor = 'var(--color-energy-orange, #FFB26B)';
    }
    
    let finalBorderColor = isSelected ? 'var(--color-accent-gold-hover, #c9a36a)' : (energyBorderColor !== 'transparent' ? energyBorderColor : baseBgColor);


    if (status === 'COMPLETED') {
        opacity = 0.60; 
        textDecoration = 'line-through';
        effectiveBgColor = '#4A5568'; 
        finalBorderColor = isSelected ? 'var(--color-accent-gold-hover, #c9a36a)' : '#3E4C59';
    } else if (status === 'SKIPPED') {
        opacity = 0.55; 
        textDecoration = 'line-through';
        effectiveBgColor = '#3A3A3A'; 
        finalBorderColor = isSelected ? 'var(--color-accent-gold-hover, #c9a36a)' : '#2D2D2D';
    }
    
    const textColor = getContrastColor(effectiveBgColor);

    const eventWrapperStyle = {
        backgroundColor: effectiveBgColor,
        color: textColor,
        opacity: opacity,
        border: `1px solid ${finalBorderColor}`,
        borderRadius: 'var(--border-radius-button, 3px)',
        padding: '1px 4px', // Adjusted padding
        fontSize: '0.8em', 
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: '3px', // Small gap between icons and title
        height: '100%', 
        boxSizing: 'border-box',
        boxShadow: isSelected ? '0 0 4px 1px var(--color-accent-gold)' : (energyBorderColor !== 'transparent' ? `0 0 3px ${energyBorderColor}` : '0 1px 1px rgba(0,0,0,0.15)'),
    };

    const titleStyle = {
        textDecoration: textDecoration,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexGrow: 1,
    };
    
    const iconStyle = {
        fontSize: '0.9em',
        flexShrink: 0,
        lineHeight: 1,
    };

    return (
        <div style={eventWrapperStyle} title={`${typeIconTitle}: ${title} (Energy: ${energyValue})`}>
            {typeIconSymbol && (
                <span role="img" aria-label={typeIconTitle} style={iconStyle}>
                    {typeIconSymbol}
                </span>
            )}
            {energyIconSymbol && energyValue !== 0 && ( // Only show energy icon if not zero
                 <span role="img" aria-label={`Energy type: ${energyValue > 0 ? 'Restorative' : 'Effort'}`} style={{...iconStyle, color: energyValue > 0 ? 'var(--color-feedback-info)' : 'var(--color-energy-orange)'}}>
                    {energyIconSymbol}
                </span>
            )}
            <span style={titleStyle}>
                {title}
            </span>
        </div>
    );
}

export default CustomEventComponent;