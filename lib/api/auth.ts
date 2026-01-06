/**
 * Server-side auth helpers for Next.js Route Handlers.
 * These utilities centralize common authentication and authorization patterns
 * and keep route files cleaner and easier to maintain.
 */
import { createClient as createCookieAwareClient } from "@/lib/supabase/server";

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createCookieAwareClient>>;
  userId: string;
  isAdmin: boolean;
}

/**
 * Ensures there is an authenticated user session.
 * Returns Supabase client, current user id, and admin flag (via check_is_admin RPC).
 * Throws an Error with message 'Unauthorized' if not authenticated.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await createCookieAwareClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: isAdminData } = await supabase.rpc("check_is_admin");
  return { supabase, userId: user.id, isAdmin: !!isAdminData };
}

/**
 * Allows either an internal shared secret (X-Internal-Secret) or an authenticated admin.
 * Returns { isAdmin, supabase? } (supabase present only for session-based auth path).
 */
export async function allowInternalOrAdmin(request: Request): Promise<{ isAdmin: boolean; supabase?: Awaited<ReturnType<typeof createCookieAwareClient>>; }> {
  const secretHeader = request.headers.get("x-internal-secret");
  const internalSecret = process.env.INTERNAL_ADMIN_SECRET;
  if (internalSecret && secretHeader && internalSecret === secretHeader) {
    return { isAdmin: true };
  }
  const supabase = await createCookieAwareClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { isAdmin: false };
  const { data: isAdminData } = await supabase.rpc("check_is_admin");
  return { isAdmin: !!isAdminData, supabase };
}
