/** 1 → "1st", 2 → "2nd", 3 → "3rd", 4 → "4th", 11 → "11th"… */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${suffix}`;
}
