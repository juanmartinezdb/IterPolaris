// frontend/src/components/calendar/CustomEventComponent.jsx
import React from 'react';
import { getContrastColor } from '../../utils/colorUtils';

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

    let iconSymbol = '';
    let iconTitle = '';

    if (eventType === 'SCHEDULED_MISSION') {
        iconSymbol = '🎯';
        iconTitle = 'Scheduled Mission';
    } else if (eventType === 'HABIT_OCCURRENCE') {
        iconSymbol = '🔄';
        iconTitle = 'Habit';
    }

    const baseBgColor = getEventBaseColor(event, questColors);
    let effectiveBgColor = baseBgColor;
    let opacity = 1;
    let textDecoration = 'none';
    // Use a more subtle border, or make it match background for PENDING unless selected
    let borderColor = isSelected ? 'var(--color-accent-gold-hover, #c9a36a)' : effectiveBgColor;


    if (status === 'COMPLETED') {
        opacity = 0.65; // Slightly less opaque
        textDecoration = 'line-through';
        effectiveBgColor = '#4A5568'; 
        borderColor = isSelected ? 'var(--color-accent-gold-hover, #c9a36a)' : '#3E4C59';
    } else if (status === 'SKIPPED') {
        opacity = 0.5; // More opaque
        textDecoration = 'line-through';
        effectiveBgColor = '#3A3A3A'; 
        borderColor = isSelected ? 'var(--color-accent-gold-hover, #c9a36a)' : '#2D2D2D';
    }
    
    const textColor = getContrastColor(effectiveBgColor);

    const eventWrapperStyle = {
        backgroundColor: effectiveBgColor,
        color: textColor,
        opacity: opacity,
        border: `1px solid ${borderColor}`, // Keep a border for definition, color matches bg for pending
        borderRadius: 'var(--border-radius-button, 3px)', // Slightly less radius
        padding: '1px 3px', // Minimal padding
        fontSize: '0.8em', 
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: '100%', // Fill the event slot
        boxSizing: 'border-box',
        boxShadow: isSelected ? '0 0 3px 1px var(--color-accent-gold)' : '0 1px 1px rgba(0,0,0,0.2)', // Softer shadow
    };

    const titleStyle = {
        textDecoration: textDecoration,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flexGrow: 1,
        // Ensure the library's own time label isn't pushing things around
        // The global CSS .rbc-event-label { display: none !important; } should handle this.
    };

    // The component itself should not render time.
    // The default `eventTimeRangeFormat` of react-big-calendar might still try to add it.
    // We can override `eventTimeRangeFormat` in CalendarPage.jsx to return an empty string.

    return (
        <div style={eventWrapperStyle} title={`${iconTitle}: ${title}`}>
            {iconSymbol && (
                <span role="img" aria-label={iconTitle} style={{ fontSize: '0.9em', flexShrink: 0, marginRight: '2px' }}>
                    {iconSymbol}
                </span>
            )}
            <span style={titleStyle}>
                {title}
            </span>
        </div>
    );
}

export default CustomEventComponent;