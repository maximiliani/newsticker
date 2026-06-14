/**
 * Format a date to a human-readable string
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Format a date range to a human-readable string
 */
export function formatDateRange(from: Date, to: Date | null): string {
  const formattedFrom = formatDate(from);

  if (!to) return `${formattedFrom} - Ongoing`;

  const formattedTo = formatDate(to);
  return `${formattedFrom} - ${formattedTo}`;
}

/**
 * Check if a date is in the future
 */
export function isFutureDate(date: Date): boolean {
  return date > new Date();
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: Date): boolean {
  return date < new Date();
}

export function isDateInRange(date: Date, from: Date, to: Date | null): boolean {
  return date >= from && (!to || date <= to);
}
