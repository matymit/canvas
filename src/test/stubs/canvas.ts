// Minimal stub for 'canvas' to satisfy accidental Node build imports in tests.
export const createCanvas = () => ({ getContext: () => ({}) });
export default {} as any;
