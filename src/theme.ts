export const C = {
  green: '#30D158', blue: '#0A84FF', cyan: '#64D2FF', orange: '#FF9F0A', yellow: '#FFD60A',
  red: '#FF375F', purple: '#BF5AF2', purpleLight: '#D99CFF', text: '#F5F5F7', text2: '#8E8E93', text3: '#AEAEB2',
};

/** category → colour (PLAN §15.1) */
export const CAT: Record<string, string> = {
  training: C.red, food: C.orange, water: C.blue, sleep: C.purple, supplements: C.cyan,
  protein: C.green, carbs: C.orange, fat: C.yellow, calories: C.orange, checkin: C.yellow,
  steps: C.green, consistency: C.green, pr: C.yellow,
};

export const catColor = (cat: string) => CAT[cat] ?? (cat.startsWith('custom:') ? C.cyan : C.green);

/** "#RRGGBB" + alpha 0..1 → rgba() */
export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
