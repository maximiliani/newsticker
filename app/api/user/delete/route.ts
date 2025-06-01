import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/features/users/services/user-service';

/**
 * API route for user account deletion
 * This handles deletion of all user data including auth account
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create server supabase client
    const supabase = await createClient();

    // Get current authenticated user
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      );
    }

    // Only allow users to delete their own account (or admins to delete any account)
    if (currentUser.id !== userId) {
      // Check if admin
      const isAdmin = await UserService.isCurrentUserAdmin();
      if (!isAdmin) {
        return NextResponse.json(
          { message: 'Unauthorized: You can only delete your own account' },
          { status: 403 }
        );
      }
    }

    // Delete all user data
    // 1. Delete Instagram accounts
    await UserService.cleanupUserInstagramData(userId);

    // 2. Delete articles
    await UserService.cleanupUserArticles(userId);

    // 3. Create deletion record
    await supabase
      .from('user_deletion_requests')
      .insert({
        user_id: userId,
        requested_by: currentUser.id,
        all_data_removed: true
      });

    // If self-deletion, use auth endpoints
    if (currentUser.id === userId) {
      // For self-deletion, we'll handle the auth account deletion on the client side
      // after signing out
      return NextResponse.json({ message: 'User data deleted successfully' });
    } else {
      // For admin deletions, delete the auth user account
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) {
        throw new Error(`Failed to delete auth user: ${error.message}`);
      }

      return NextResponse.json({ message: 'User deleted successfully' });
    }
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { message: `Error deleting user: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
