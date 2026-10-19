import { epochFor } from '../logic/dates';
import { todayKey, tzNow } from '../db/ops';

/** default timestamp for a new record: now for today, midday for a past day being back-filled */
export function defaultLogTime(dayKey?: string): number {
  if (!dayKey || dayKey === todayKey()) return Date.now();
  return epochFor(dayKey, '12:00', tzNow());
}
/** the day a new record belongs to — frozen at log time */
export const logDay = (dayKey?: string) => dayKey ?? todayKey();
