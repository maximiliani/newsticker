import {createClient} from "@/lib/supabase/client";

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

        const {data: {user}} = await supabase.auth.getUser();

        if (!user) return false;

        const {data, error} = await supabase
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
            const {data: users, error} = await supabase
                .from('users_secure')
                .select('*');

            if (error) {
                console.error('Error fetching users:', error);

                // If this is a permission error, try using a more specific fallback approach
                if (error.code === 'PGRST301' || error.message.includes('permission denied')) {
                    try {
                        // Call a specialized API endpoint or use a different table with safer permissions
                        const {data: adminCheckResponse, error: adminCheckError} = await supabase
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
        const {data: user, error} = await supabase
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
        const {error} = await supabase
            .from('user_roles')
            .upsert({user_id: userId, is_admin: isAdmin})
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

        try {
            // 1. Delete all user's Instagram accounts
            await this.cleanupUserInstagramData(userId);

            // 2. Delete all user's articles
            await this.cleanupUserArticles(userId);

            // 3. Create a deletion request record
            const {error} = await supabase
                .from('user_deletion_requests')
                .insert({
                    user_id: userId,
                    requested_by: (await supabase.auth.getUser()).data.user?.id,
                    all_data_removed: true
                });

            if (error) {
                throw new Error(`Failed to create user deletion request: ${error.message}`);
            }
        } catch (error) {
            console.error('Error in user deletion process:', error);
            throw new Error(`Failed to delete user: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Update a user's profile (admin only)
     */
    static async updateUserProfile(userId: string, profileData: {
        full_name?: string;
        email?: string;
        avatar_url?: string;
        is_admin?: boolean
    }): Promise<UserWithRole>
    {
        const supabase = createClient();

        // First check if current user is admin
        const isAdmin = await this.isCurrentUserAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Only admins can update user profiles');
        }

        try {
            // Split data into auth data and profile data
            const {email, ...profileUpdateData} = profileData;

            // Update profile data
            const {data: updatedProfile, error: profileError} = await supabase
                .from('users')
                .update(profileUpdateData)
                .eq('id', userId)
                .select()
                .single();

            if (profileError) {
                throw new Error(`Failed to update user profile: ${profileError.message}`);
            }

            // Update admin status if provided
            if (typeof profileData.is_admin === 'boolean') {
                await this.updateUserAdminStatus(userId, profileData.is_admin);
            }

            // Return the updated user with role
            return await this.getUserById(userId) as UserWithRole;
        } catch (error) {
            throw new Error(`Failed to update user profile: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Clean up all Instagram data for a user being deleted
     */
    private static async cleanupUserInstagramData(userId: string): Promise<void> {
        const {InstagramService} = await import('@/features/instagram/services/instagram-service');
        const supabase = createClient();

        try {
            // Get all Instagram accounts for the user
            const {data: accounts, error} = await supabase
                .from('instagram_accounts')
                .select('id')
                .eq('user_id', userId);

            if (error) throw error;

            // Delete each account (this will cascade to posts and media)
            if (accounts && accounts.length > 0) {
                for (const account of accounts) {
                    await InstagramService.deleteAccount(account.id);
                }
            }
        } catch (error) {
            console.error(`Error cleaning up Instagram data for user ${userId}:`, error);
            throw new Error(`Failed to delete Instagram data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Clean up all articles for a user being deleted
     */
    private static async cleanupUserArticles(userId: string): Promise<void> {
        const {ArticleService} = await import('@/features/articles/services/article-service');
        const supabase = createClient();

        try {
            // Get all articles for the user
            const {data: articles, error} = await supabase
                .from('articles')
                .select('id')
                .eq('user_id', userId);

            if (error) throw error;

            // Delete each article (this will handle media cleanup)
            if (articles && articles.length > 0) {
                for (const article of articles) {
                    await ArticleService.deleteArticle(article.id, userId);
                }
            }
        } catch (error) {
            console.error(`Error cleaning up articles for user ${userId}:`, error);
            throw new Error(`Failed to delete articles: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
