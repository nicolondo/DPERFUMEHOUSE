import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const cleaned = phone.replace(/[\s-]/g, '');
  // +1/+7 are 1-digit country codes; most others are 2-digit (covers Colombia +57)
  const match = cleaned.match(/^(\+(?:1|7|\d{2}))(\d+)$/);
  if (match) return `${match[1]}-${match[2]}`;
  return phone;
}
