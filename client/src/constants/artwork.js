export const ARTWORK_RARITIES = [
    { value: 'common', label: 'Common' },
    { value: 'uncommon', label: 'Uncommon' },
    { value: 'rare', label: 'Rare' },
    { value: 'epic', label: 'Epic' },
    { value: 'legendary', label: 'Legendary' },
    // Ensure these 'value' strings EXACTLY match your backend ENUM/expected values
];

// Extract just the values for Yup validation
export const RARITY_VALUES = ARTWORK_RARITIES.map(r => r.value);

export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_FILE_SIZE_MB = 10;