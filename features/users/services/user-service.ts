import { createClient } from "@/lib/supabase/client";

export interface UserWithRole {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  is_admin: boolean;
  created_at: string;
}

export class UserService {
  /**
   * Check if the current user is an admin
   */
  static async isCurrentUserAdmin(): Promise<boolean> {
    // Use the appropriate createClient function
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    const { data, error } = await supabase
      .from('user_roles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return false;

    return data.is_admin;
  }

  /**
   * Get all users with their roles
   */
  static async getAllUsers(): Promise<UserWithRole[]> {
    // Use the appropriate createClient function
    const supabase = createClient();

    // First check if current user is admin
    const isAdmin = await this.isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only admins can access user list');
    }

    try {
      // Use the secured users table with proper RLS instead of the view
      const { data: users, error } = await supabase
        .from('users_secure')
        .select('*');

    if (error) {
      console.error('Error fetching users:', error);

      // If this is a permission error, try using a more specific fallback approach
      if (error.code === 'PGRST301' || error.message.includes('permission denied')) {
        try {
          // Call a specialized API endpoint or use a different table with safer permissions
          const { data: adminCheckResponse, error: adminCheckError } = await supabase
            .from('admin_functions')
            .select('*')
            .eq('function_name', 'get_all_users')
            .single();

          if (adminCheckError || !adminCheckResponse) {
            throw new Error('Admin function check failed');
          }

          return adminCheckResponse.result as UserWithRole[];
        } catch (fallbackError) {
          console.error('Fallback approach failed:', fallbackError);
          throw new Error('You do not have permission to access the user list. Please contact an administrator.');
        }
      }

      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    if (!users || users.length === 0) {
      return [];
    }

    // Map database users directly (they already have role information)
    return users.map(user => ({
      id: user.id,
      email: user.email || '',
      full_name: user.full_name || '',
      avatar_url: user.avatar_url,
      is_admin: user.is_admin || false,
      created_at: user.created_at
    }));
    } catch (err) {
      console.error('Error in getAllUsers:', err);

      // Try the API endpoint as a last resort
      try {
        const response = await fetch('/api/admin/users');
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        const data = await response.json();
        return data.users;
      } catch (apiError) {
        console.error('API fallback failed:', apiError);
        throw new Error('Failed to retrieve users. Please try again later.');
      }
    }
  }

  /**
   * Get a user by ID
   */
  static async getUserById(userId: string): Promise<UserWithRole | null> {
    const supabase = createClient();

    // First check if current user is admin
    const isAdmin = await this.isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only admins can access user details');
    }

    // Get user from the secured users table
    const { data: user, error } = await supabase
      .from('users_secure')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      throw new Error(`Failed to fetch user: ${error.message}`);
    }

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email || '',
      full_name: user.full_name || '',
      avatar_url: user.avatar_url,
      is_admin: user.is_admin || false,
      created_at: user.created_at
    };
  }

  /**
   * Update a user's admin status
   */
  static async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    const supabase = createClient();

    // First check if current user is admin
    const currentUserIsAdmin = await this.isCurrentUserAdmin();
    if (!currentUserIsAdmin) {
      throw new Error('Unauthorized: Only admins can update user roles');
    }

    // Update user role
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, is_admin: isAdmin })
      .select();

    if (error) {
      throw new Error(`Failed to update user role: ${error.message}`);
    }
  }

  /**
   * Delete a user
   */
  static async deleteUser(userId: string): Promise<void> {
    const supabase = createClient();

    // First check if current user is admin
    const isAdmin = await this.isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only admins can delete users');
    }

    // Instead of directly deleting the user, mark them as inactive in a custom table
    // or trigger a server-side function to handle the deletion
    const { error } = await supabase
      .from('user_deletion_requests')
      .insert({ user_id: userId, requested_by: (await supabase.auth.getUser()).data.user?.id });

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
}
