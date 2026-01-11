import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseServerClient } from '@supabase/supabase-js';
import { UserService } from '@/features/users/services/user-service';
import { requireAuth } from '@/lib/api/auth';
import { UserUpdateDTO, UserWithRoleDTO } from '@/types/users';

/**
 * GET /api/features/users/:id
 * Admins can fetch any user. Non-admins can fetch only themselves.
 */
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, userId, isAdmin } = await requireAuth();
    const { id: targetUserId } = await context.params;
    if (!targetUserId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    if (!isAdmin && userId !== targetUserId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: user, error } = await supabase
      .from('users_secure')
      .select('*')
      .eq('id', targetUserId)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const dto: UserWithRoleDTO = {
      id: user.id,
      email: user.email || '',
      full_name: user.full_name || '',
      avatar_url: user.avatar_url,
      is_admin: !!user.is_admin,
      created_at: user.created_at,
    };
    return NextResponse.json(dto);
  } catch (e: any) {
    const msg = e?.message || 'Unexpected error';
    const status = msg === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * PATCH /api/features/users/:id
 * Admin-only: update profile fields and role.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, isAdmin } = await requireAuth();
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: targetUserId } = await context.params;
    if (!targetUserId) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    const body = (await req.json()) as UserUpdateDTO;

    // Update profile data in users table if present
    const profileUpdate: any = {};
    if (typeof body.full_name !== 'undefined') profileUpdate.full_name = body.full_name;
    if (typeof body.avatar_url !== 'undefined') profileUpdate.avatar_url = body.avatar_url;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileErr } = await supabase
        .from('users')
        .update(profileUpdate)
        .eq('id', targetUserId);
      if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    // Update role if provided
    if (typeof body.is_admin === 'boolean') {
      const { error: roleErr } = await supabase
        .from('user_roles')
        .upsert({ user_id: targetUserId, is_admin: body.is_admin });
      if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.message || 'Unexpected error';
    const status = msg === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

/**
 * RESTful user deletion endpoint
 * DELETE /api/users/:id
 *
 * Notes:
 * - If :id equals the current user's id, this performs data cleanup and records a deletion request.
 *   Final auth user deletion is expected to happen client-side after sign-out or via the admin processor.
 * - If the caller is an admin deleting another user, this attempts to delete the auth user using the
 *   service role key, falling back to background processing if not configured.
 */
export async function DELETE(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
    }

    const { id: targetUserId } = await context.params;
    if (!targetUserId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    let isAdmin = false;
    if (currentUser.id !== targetUserId) {
      const { data: isAdminData, error: isAdminErr } = await supabase.rpc('check_is_admin');
      isAdmin = !!isAdminData && !isAdminErr;
      if (!isAdmin) {
        return NextResponse.json({ message: 'Unauthorized: You can only delete your own account' }, { status: 403 });
      }
    }

    // 1) Cleanup user-related data in app tables/storage
    await UserService.cleanupUserInstagramData(targetUserId);
    await UserService.cleanupUserArticles(targetUserId);

    // 2) Record deletion request
    await supabase
      .from('user_deletion_requests')
      .insert({ user_id: targetUserId, requested_by: currentUser.id, all_data_removed: true });

    if (currentUser.id === targetUserId) {
      // Self deletion: stop here; account removal happens after sign-out
      return NextResponse.json({ message: 'User data deleted successfully. Account removal will complete after sign-out.' });
    }

    if (isAdmin) {
      // Attempt to remove auth user using service role
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        const adminClient = createSupabaseServerClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
        const { error: delErr } = await adminClient.auth.admin.deleteUser(targetUserId);
        if (delErr) {
          console.warn('Admin API failed to delete user immediately; background processor will handle it.', delErr.message);
        }
      } else {
        console.warn('Service-role credentials not configured; auth user deletion will be processed by background task.');
      }
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user via RESTful route:', error);
    return NextResponse.json({ message: `Error deleting user: ${error instanceof Error ? error.message : 'Unknown error'}` }, { status: 500 });
  }
}
