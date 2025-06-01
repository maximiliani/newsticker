"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Server action to update a user's admin status
 */
export async function updateUserAdminStatus(userId: string, isAdmin: boolean) {
  const supabase = await createClient();

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify current user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!roleData?.is_admin) {
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

  revalidatePath('/protected/admin/users');
  return { success: true };
}

/**
 * Server action to delete a user
 */
export async function deleteUser(userId: string) {
  const supabase = await createClient();

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Verify current user is admin
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!roleData?.is_admin) {
    throw new Error('Unauthorized: Only admins can delete users');
  }

  try {
    // Create a deletion request record
    const { error } = await supabase
      .from('user_deletion_requests')
      .insert({
        user_id: userId,
        requested_by: user.id,
        all_data_removed: true
      });

    if (error) {
      throw new Error(`Failed to create user deletion request: ${error.message}`);
    }

    revalidatePath('/protected/admin/users');
    return { success: true };
  } catch (error) {
    console.error('Error in user deletion process:', error);
    throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : String(error)}`);
  }
}
