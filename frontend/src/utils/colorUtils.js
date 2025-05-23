// frontend/src/utils/colorUtils.js

/**
 * Calculates a contrasting text color (black or white) for a given HEX background color.
 * Adheres to PRD guidelines for text contrast on Quest colors.
 * @param {string} hexColor - The background color in HEX format (e.g., "#RRGGBB" or "#RGB").
 * @returns {string} The contrasting text color ('var(--color-text-on-accent)' for dark text or 'var(--color-text-on-dark)' for light text).
 */
export function getContrastColor(hexColor) {
    if (!hexColor || typeof hexColor !== 'string' || !hexColor.startsWith('#')) {
        // Default to light text if hexColor is invalid, as backgrounds are generally dark.
        return 'var(--color-text-on-dark, #EAEAEA)'; 
    }

    let r, g, b;
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hexColor.replace(shorthandRegex, (m, rVal, gVal, bVal) => {
        return rVal + rVal + gVal + gVal + bVal + bVal;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    if (!result) {
        return 'var(--color-text-on-dark, #EAEAEA)';
    }

    r = parseInt(result[1], 16);
    g = parseInt(result[2], 16);
    b = parseInt(result[3], 16);

    // Calculate the YIQ (luminance) value
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;

    // PRD specifies --color-text-on-accent (dark text) for light backgrounds,
    // and --color-text-on-dark (light text) for dark backgrounds.
    // Threshold of 128 is common for YIQ.
    return (yiq >= 128) ? 'var(--color-text-on-accent, #0A192F)' : 'var(--color-text-on-dark, #EAEAEA)';
}