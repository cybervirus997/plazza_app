export interface RepeatInterval { readonly unit: 'day' | 'week' | 'month'; readonly every: number; readonly anchorDay: number; readonly hour?: number; readonly minute?: number }
interface WallTime { year: number; month: number; day: number; hour: number; minute: number; second: number }
export function validTimeZone(zone: string): string { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return zone; }
function parts(at: string | number, zone: string): WallTime {
  const fields = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at));
  return Object.fromEntries(fields.filter((item) => item.type !== 'literal').map((item) => [item.type, Number(item.value)])) as unknown as WallTime;
}
const wallStamp = (p: WallTime) => Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
function instant(wall: WallTime, zone: string): string {
  const target = wallStamp(wall);
  const offsets = [-86400000, -21600000, 0, 21600000, 86400000].map((delta) => wallStamp(parts(target + delta, zone)) - (target + delta));
  const candidates = [...new Set(offsets)].map((offset) => target - offset);
  const exact = candidates.filter((at) => wallStamp(parts(at, zone)) === target).sort((a, b) => a - b);
  // Ambiguous wall times use the earlier instant. Nonexistent DST times shift forward by the gap.
  const shifted = candidates.filter((at) => wallStamp(parts(at, zone)) >= target).sort((a, b) => wallStamp(parts(a, zone)) - wallStamp(parts(b, zone)));
  if (!exact.length && !shifted.length) throw new Error('This local date/time could not be resolved.');
  return new Date(exact[0] ?? shifted[0]).toISOString();
}
export function reviewInstant(date: string, time: string, timeZone: string): string {
  validTimeZone(timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Use YYYY-MM-DD and HH:mm.');
  const [year, month, day] = date.split('-').map(Number); const [hour, minute] = time.split(':').map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (year < 1970 || year > 9999 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) throw new Error('Enter a valid date and time.');
  return instant({ year, month, day, hour, minute, second: 0 }, timeZone);
}
export function reviewInputs(at: string, zone: string) {
  const p = parts(at, zone); const pad = (value: number) => String(value).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}
export function nextReview(at: string, cadence: RepeatInterval, zone: string): string {
  const p = parts(at, zone);
  p.hour = cadence.hour ?? p.hour; p.minute = cadence.minute ?? p.minute;
  if (cadence.unit === 'month') {
    const month = new Date(Date.UTC(p.year, p.month - 1 + cadence.every, 1));
    p.year = month.getUTCFullYear(); p.month = month.getUTCMonth() + 1;
    p.day = Math.min(cadence.anchorDay, new Date(Date.UTC(p.year, p.month, 0)).getUTCDate());
  } else {
    const date = new Date(Date.UTC(p.year, p.month - 1, p.day + cadence.every * (cadence.unit === 'week' ? 7 : 1)));
    p.year = date.getUTCFullYear(); p.month = date.getUTCMonth() + 1; p.day = date.getUTCDate();
  }
  return instant(p, zone);
}
