/**
 * Central export file for all application types
 * This makes it easier to import types from a common place
 */

// Re-export all types from their specialized files
export * from './article';
export * from './instagram';

// Add common types here
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
