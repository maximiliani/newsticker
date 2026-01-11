// Shared API response/request DTOs to keep route handlers and clients in sync

export type ApiError = { error: string };

export type Paged<T> = {
  items: T[];
  total?: number;
  limit?: number;
  offset?: number;
};

export type Success<T> = { ok: true } & T;
