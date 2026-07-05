export type CalendarAuthType = 'public' | 'basic' | 'bearer';

export interface CalendarSubscription {
  id: string;
  user_id: string;
  name: string;
  ical_url: string | null;
  auth_type: CalendarAuthType;
  caldav_server_url: string | null;
  caldav_calendar_url: string | null;
  vault_secret_id: string | null;
  color: string;
  visibility_days_before: number;
  visibility_days_after: number;
  last_synced_at: string | null;
  ctag: string | null;
  etag: string | null;
  active: boolean;
  created_at: string;
  user?: {
    full_name: string | null;
    email: string | null;
  };
}

export interface CalendarEvent {
  id: string;
  subscription_id: string;
  user_id: string;
  event_uid: string;
  article_id: string | null;
  event_start: string;
  locally_modified: boolean;
  source_hash: string | null;
  last_synced_at: string;
}

export interface CalendarAttachment {
  url: string;
  filename: string;
  mimeType?: string;
}

export interface ParsedCalendarEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: Date;
  dtend: Date;
  location: string;
  url: string;
  attachments: CalendarAttachment[];
}

export interface CreatePublicSubscriptionData {
  name: string;
  ical_url: string;
  color: string;
  visibility_days_before: number;
  visibility_days_after: number;
}

export interface CreateCalDAVSubscriptionData {
  name: string;
  caldav_server_url: string;
  caldav_calendar_url: string;
  auth_type: 'basic' | 'bearer';
  username?: string;
  secret: string;
  color: string;
  visibility_days_before: number;
  visibility_days_after: number;
}

export interface DiscoveredCalendar {
  url: string;
  name: string;
}

export interface SyncResult {
  subscriptionId: string;
  status: 'success' | 'not_modified' | 'error';
  added: number;
  updated: number;
  deleted: number;
  error?: string;
}
