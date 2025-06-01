import { createClient as createClientBrowser } from './client';
import { createClient as createServerClient } from './server';

/**
 * Determines whether the code is running on the server or client
 * and returns the appropriate Supabase client
 */
export async function getSupabaseClient() {
  // Check if we're in a browser environment
  const isBrowser = typeof window !== 'undefined';

  if (isBrowser) {
    // Client-side: use browser client
    return createClientBrowser();
  } else {
    // Server-side: use server client
    return await createServerClient();
  }
}

// For backward compatibility
export const createClient = createClientBrowser;
