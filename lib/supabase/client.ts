import { createBrowserClient } from '@supabase/ssr';

/**
 * Create a Supabase client for use in browser environments
 * This is for client components only
 */
export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  // If the URL is localhost (standard for local dev),
  // and we are in the browser, replace localhost with the actual hostname
  // to allow remote access via IP or other hostnames.
  if (typeof window !== 'undefined' && url.includes('localhost')) {
    url = url.replace('localhost', window.location.hostname);
  }

  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
