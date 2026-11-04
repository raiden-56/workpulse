import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export { dayjs };

export function formatDuration(seconds: number | null | undefined, options: { compact?: boolean } = {}): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return '–';
  }
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return options.compact ? `${h}h ${m}m` : `${h}h ${m}m`;
  }
  if (m > 0) {
    return `${m}m${options.compact || s === 0 ? '' : ` ${s}s`}`;
  }
  return `${s}s`;
}

export function formatHours(seconds: number | null | undefined): string {
  if (!seconds) {
    return '0h';
  }
  const hours = seconds / 3600;
  return hours >= 10 ? `${Math.round(hours)}h` : `${Math.round(hours * 10) / 10}h`;
}

export function formatDateTime(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) {
    return '–';
  }
  const d = tz ? dayjs(iso).tz(tz) : dayjs(iso);
  return d.format('DD MMM YYYY, HH:mm');
}

export function formatTime(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) {
    return '–';
  }
  const d = tz ? dayjs(iso).tz(tz) : dayjs(iso);
  return d.format('HH:mm');
}

export function formatDate(iso: string | null | undefined, tz?: string | null): string {
  if (!iso) {
    return '–';
  }
  const d = tz ? dayjs(iso).tz(tz) : dayjs(iso);
  return d.format('DD MMM YYYY');
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) {
    return 'never';
  }
  return dayjs(iso).fromNow();
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '–';
  }
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '–';
  }
  return new Intl.NumberFormat().format(value);
}

export function initials(name: string | null | undefined): string {
  if (!name) {
    return '?';
  }
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function humanize(code: string | null | undefined): string {
  if (!code) {
    return '';
  }
  return code
    .toLowerCase()
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function todayIso(tz?: string | null): string {
  return (tz ? dayjs().tz(tz) : dayjs()).format('YYYY-MM-DD');
}
