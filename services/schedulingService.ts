
import { db } from './organizerDb';
import { OrgEvent, PlanningContext, ActionProposal } from '../types';

// Helpers
const parseTime = (hhmm: string): number => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

// Returns start/end of day in ms
const getDayBounds = (date: Date) => {
    const start = new Date(date); start.setHours(0,0,0,0);
    const end = new Date(date); end.setHours(23,59,59,999);
    return { start: start.getTime(), end: end.getTime() };
};

export const getUserAvailability = async (date: Date): Promise<{ start: number, end: number }[]> => {
    const config = await db.planning_context.get('default');
    if (!config) return [];

    const { start: dayStartMs, end: dayEndMs } = getDayBounds(date);
    
    // 1. Parse Working Hours / Sleep to find "Wake Window"
    // Assuming workHours is "09:00-17:00", we actually want "Wake Window".
    // If sleepWindow is "23:00-07:00", then available day is 07:00 -> 23:00
    
    const sleepParts = config.sleepWindow.split('-');
    if (sleepParts.length !== 2) return [];
    
    const sleepStartMins = parseTime(sleepParts[0]); // e.g. 23:00 -> 1380
    const sleepEndMins = parseTime(sleepParts[1]);   // e.g. 07:00 -> 420

    const dayStartMins = sleepEndMins; 
    const dayEndMins = sleepStartMins > dayStartMins ? sleepStartMins : 24 * 60; // Handle midnight crossing slightly simply for single day logic

    const availStartMs = dayStartMs + (dayStartMins * 60 * 1000);
    const availEndMs = dayStartMs + (dayEndMins * 60 * 1000);

    // 2. Fetch Events for this day
    const events = await db.events.where('startAt').between(dayStartMs, dayEndMs).toArray();
    
    // 3. Subtract Events from Available Window
    // Simple 1D line subtraction
    let freeRanges = [{ start: availStartMs, end: availEndMs }];

    events.forEach(ev => {
        const busyStart = Math.max(ev.startAt, availStartMs);
        const busyEnd = Math.min(ev.endAt, availEndMs);

        if (busyStart < busyEnd) {
            const newRanges: { start: number, end: number }[] = [];
            freeRanges.forEach(range => {
                // No overlap
                if (busyEnd <= range.start || busyStart >= range.end) {
                    newRanges.push(range);
                } 
                // Partial or full overlap
                else {
                    if (range.start < busyStart) {
                        newRanges.push({ start: range.start, end: busyStart });
                    }
                    if (range.end > busyEnd) {
                        newRanges.push({ start: busyEnd, end: range.end });
                    }
                }
            });
            freeRanges = newRanges;
        }
    });

    return freeRanges;
};

export const proposeSlots = async (
    durationMinutes: number = 60, 
    date: Date = new Date(),
    preferences?: string
): Promise<{ start: number, end: number, confidence: number }[]> => {
    const freeRanges = await getUserAvailability(date);
    const durationMs = durationMinutes * 60 * 1000;
    const candidates: { start: number, end: number, confidence: number }[] = [];

    // 1. Chunk free ranges into slots
    freeRanges.forEach(range => {
        let cursor = range.start;
        while (cursor + durationMs <= range.end) {
            candidates.push({
                start: cursor,
                end: cursor + durationMs,
                confidence: 0.8 // Base confidence
            });
            // Advance by 30 mins to offer staggered options
            cursor += 30 * 60 * 1000;
        }
    });

    // 2. Simple Heuristic Scoring
    // Prefer: 09:00-11:00 (Focus) or 14:00-16:00
    // Avoid: Lunch 12:00-13:00
    
    candidates.forEach(slot => {
        const hour = new Date(slot.start).getHours();
        if (hour >= 9 && hour < 12) slot.confidence += 0.1;
        if (hour >= 14 && hour < 17) slot.confidence += 0.05;
        if (hour === 12) slot.confidence -= 0.2; // Lunch penalty
    });

    // Sort by confidence
    return candidates.sort((a,b) => b.confidence - a.confidence).slice(0, 3);
};

export const checkConflicts = async (event: OrgEvent): Promise<OrgEvent[]> => {
    const overlaps = await db.events
        .where('startAt').below(event.endAt)
        .and(e => e.endAt > event.startAt && e.id !== event.id)
        .toArray();
    return overlaps;
};