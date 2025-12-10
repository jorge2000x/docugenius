
/**
 * Converts any valid CSS color string (hex, rgb, rgba) to Hex format.
 * Returns null if invalid or transparent.
 */
export const rgbToHex = (col: string): string | null => {
    if (!col || col === 'rgba(0, 0, 0, 0)' || col === 'transparent') return null;
    if (col.startsWith('#')) return col.toUpperCase();
    
    const digits = col.match(/\d+/g);
    if (!digits || digits.length < 3) return null;
    
    // Check alpha if present
    if (digits.length > 3 && parseInt(digits[3]) === 0) return null; // Fully transparent

    const r = parseInt(digits[0]);
    const g = parseInt(digits[1]);
    const b = parseInt(digits[2]);

    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

/**
 * Normalizes font size strings to 'px'.
 */
export const normalizeFontSize = (val: string): string => {
    if (!val) return '16px';
    if (val.endsWith('px')) return val;
    // Map pt to px approximate
    if (val.endsWith('pt')) return Math.round(parseFloat(val) * 1.333) + 'px';
    return val;
};
