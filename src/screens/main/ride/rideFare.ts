/** Rough demo fare from distance & duration (USD-style display). */
export function estimateFareUsd(distanceM: number, durationSec: number): number {
  const km = Math.max(0, distanceM / 1000);
  const min = Math.max(0, durationSec / 60);
  const base = 2.5;
  const perKm = 1.15;
  const perMin = 0.32;
  const raw = base + km * perKm + min * perMin;
  return Math.round(raw * 100) / 100;
}
