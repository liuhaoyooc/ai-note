export const SECONDS_PER_DAY = 86400;

export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function formatDateTime(date: Date): string {
    return date.toISOString();
}

export function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getWeekStart(date: Date): Date {
    const now = new Date();
    const nowDay = now.getDay() || 7;
    const nowDate = now.getDate();

    const weekStart = new Date(now);
    weekStart.setDate(nowDate - nowDay + 1);
    weekStart.setHours(0, 0, 0, 0);

    return weekStart;
}

export function isThisWeek(date: Date): boolean {
    const now = new Date();
    const weekStart = this.getWeekStart(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    return date >= weekStart && date <= weekEnd;
}
