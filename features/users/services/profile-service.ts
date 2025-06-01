import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { UserService } from './user-service';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  created_at: string;
  email_confirmed_at?: string;
}

export class ProfileService {
  /**
   * Get the current user's profile
   */
  static async getCurrentUserProfile(): Promise<UserProfile | null> {
    const supabase = createClient();

    try {
      // Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return null;

      // Extract profile data from user metadata
      const profile: UserProfile = {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata.full_name || '',
        first_name: user.user_metadata.first_name,
        last_name: user.user_metadata.last_name,
        avatar_url: user.user_metadata.avatar_url,
        created_at: user.created_at,
        email_confirmed_at: user.email_confirmed_at
      };

      return profile;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Update user profile information
   */
  static async updateProfile(profileData: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }): Promise<UserProfile> {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not found');
      }

      // Prepare data for update
      const updateData: Record<string, any> = {};

      // Build full name if either first or last name is provided
      if (profileData.firstName || profileData.lastName) {
        const currentProfile = await this.getCurrentUserProfile();
        const firstName = profileData.firstName || currentProfile?.first_name || '';
        const lastName = profileData.lastName || currentProfile?.last_name || '';

        updateData.full_name = `${firstName} ${lastName}`.trim();
        updateData.first_name = firstName;
        updateData.last_name = lastName;
      }

      // Update user metadata
      if (Object.keys(updateData).length > 0) {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: updateData
        });

        if (metadataError) {
          throw metadataError;
        }
      }

      // Update email if provided
      if (profileData.email && profileData.email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profileData.email
        });

        if (emailError) {
          throw emailError;
        }
      }

      // Get updated profile
      return await this.getCurrentUserProfile() as UserProfile;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error(`Failed to update profile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update user password
   */
  static async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const supabase = createClient();

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      // Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (passwordError) {
        throw passwordError;
      }
    } catch (error) {
      console.error('Error updating password:', error);
      throw new Error(`Failed to update password: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Handle avatar operations
   */
  static async uploadAvatar(avatarFile: File): Promise<string> {
    const supabase = createClient();

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not found');
      }

      // Validate file
      if (avatarFile.size > 5 * 1024 * 1024) {
        throw new Error('Avatar file size must be less than 5MB');
      }

      if (!avatarFile.type.startsWith('image/')) {
        throw new Error('File must be an image');
      }

      // Delete existing avatar if it exists
      await this.deleteExistingAvatar();

      // Upload new avatar
      const fileExt = avatarFile.name.split('.').pop();
      const filePath = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Add cache buster to URL
      const avatarUrl = this.addCacheBuster(urlData.publicUrl);

      // Update user metadata with new avatar URL
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: avatarUrl,
        },
      });

      if (updateError) {
        throw updateError;
      }

      return avatarUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw new Error(`Failed to upload avatar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete the user's avatar
   */
  static async deleteAvatar(): Promise<void> {
    const supabase = createClient();

    try {
      // Delete the avatar file
      await this.deleteExistingAvatar();

      // Update user metadata to remove avatar URL
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          avatar_url: null,
        },
      });

      if (updateError) {
        throw updateError;
      }
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw new Error(`Failed to delete avatar: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete user account
   */
  static async deleteAccount(password: string): Promise<void> {
    const supabase = createClient();

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not found');
      }

      // Verify password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: password,
      });

      if (signInError) {
        throw new Error('Password verification failed. Please check your password.');
      }

      // Delete user's avatar from storage if it exists
      await this.deleteExistingAvatar();

      // Call backend API to delete user data
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user data');
      }

      // Sign out the user
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error deleting account:', error);
      throw new Error(`Failed to delete account: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Helper to add cache buster to URLs
   */
  private static addCacheBuster(url: string): string {
    const timestamp = new Date().getTime();
    return `${url}?t=${timestamp}`;
  }

  /**
   * Helper to delete existing avatar files
   */
  private static async deleteExistingAvatar(): Promise<void> {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existingFiles } = await supabase.storage
        .from('avatars')
        .list();

      const existingAvatar = existingFiles?.find(file => 
        file.name.startsWith(`${user.id}.`)
      );

      if (existingAvatar) {
        await supabase.storage
          .from('avatars')
          .remove([existingAvatar.name]);
      }
    } catch (error) {
      console.warn('Error deleting existing avatar:', error);
      // We'll continue even if this fails
    }
  }
}
