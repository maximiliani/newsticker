export const COOKIE_NAME = 'NEXT_LOCALE';
export const DEFAULT_LOCALE = 'en';
export const SUPPORTED_LOCALES = ['en', 'de'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const LOCALE_LABELS: Record<AppLocale, string> = { en: 'English', de: 'Deutsch' };
export const DEFAULT_TIMEZONE = 'Europe/Berlin';

export function isSupportedLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isValidTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
