/**
 * Validation utility functions
 */

/**
 * Validate an email address format
 */
export function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Validate a URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate required fields in an object
 * @returns Array of missing field names or empty array if valid
 */
export function validateRequiredFields<T extends Record<string, any>>(data: T, requiredFields: (keyof T)[]): string[] {
  return requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  }).map(field => String(field));
}

