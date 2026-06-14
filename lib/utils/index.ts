import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility for merging Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


// Re-export all utility functions from other files
export * from './date';
export * from './validation';
export * from './error-handling';
export * from './date';
export * from './validation';
