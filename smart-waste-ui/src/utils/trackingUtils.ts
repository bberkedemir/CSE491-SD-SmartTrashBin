const DRIVER_COLORS = [
    '#e53935',
    '#8e24aa',
    '#1e88e5',
    '#00897b',
    '#fb8c00',
    '#6d4c41',
    '#e91e63',
    '#546e7a',
];

export function getDriverColor(driverId: number, allDriverIds: number[]): string {
    const sorted = [...allDriverIds].sort((a, b) => a - b);
    const idx = sorted.indexOf(driverId);
    return DRIVER_COLORS[idx % DRIVER_COLORS.length];
}
