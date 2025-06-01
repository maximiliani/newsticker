import {createClient as getSupabaseClient} from '@/lib/supabase/client';
import {InstagramAccount, InstagramPost} from '@/types/instagram';
import {logError} from '@/lib/utils/error-handling';
import {UserService} from "@/features/users/services/user-service";

export interface InstagramAccountsByUser {
    userId: string;
    userEmail: string;
    userFullName: string;
    accounts: InstagramAccount[];
}

export class InstagramService {
    static async getAccountsByUserId(userId: string): Promise<InstagramAccount[]> {
        const supabase = getSupabaseClient();

        const {data, error} = await supabase
            .from("instagram_accounts")
            .select("id, username, profile_image_url, user_id")
            .eq("user_id", userId);

        if (error) {
            logError(error, 'InstagramService.getAccountsByUserId');
            throw error;
        }

        return data || [];
    }

    static async getAllAccountsGroupedByUser(): Promise<InstagramAccountsByUser[]> {
        const supabase = getSupabaseClient();

        // First check if current user is admin
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const isAdmin = await UserService.isCurrentUserAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Only admins can access all accounts');
        }

        // First, get all Instagram accounts
        const {data: accounts, error: accountsError} = await supabase
            .from("instagram_accounts")
            .select("id, username, profile_image_url, user_id");

        if (accountsError) {
            logError(accountsError, 'InstagramService.getAllAccountsGroupedByUser');
            throw accountsError;
        }

        if (!accounts || accounts.length === 0) {
            return [];
        }

        // Get unique user IDs from accounts
        const userIds = Array.from(new Set(accounts.map(account => account.user_id)));

        // Fetch user information for all users who have accounts
        let usersData: any[] = [];
        
        try {
            // Try auth.users first
            const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
            
            if (!authError && authUsers?.users) {
                usersData = authUsers.users.filter(user => userIds.includes(user.id));
            } else {
                throw new Error('Auth users not accessible');
            }
        } catch (authError) {
            console.warn('Could not fetch from auth.users, trying alternative approach:', authError);
            
            try {
                // Try users_secure table
                const { data: secureUsers, error: secureError } = await supabase
                    .from('users_secure')
                    .select('id, email, full_name')
                    .in('id', userIds);

                if (!secureError && secureUsers) {
                    usersData = secureUsers;
                } else {
                    throw new Error('users_secure not accessible');
                }
            } catch (secureError) {
                console.warn('Could not fetch from users_secure, using fallback:', secureError);
                
                // Fallback: create user objects with just IDs
                usersData = userIds.map(id => ({
                    id,
                    email: 'Unknown',
                    full_name: 'Unknown User'
                }));
            }
        }

        // Group accounts by user
        const groupedAccounts = new Map<string, InstagramAccountsByUser>();

        accounts.forEach((account: InstagramAccount) => {
            const userId = account.user_id;
            const user = usersData.find(u => u.id === userId);

            if (!groupedAccounts.has(userId)) {
                groupedAccounts.set(userId, {
                    userId,
                    userEmail: user?.email || user?.user_metadata?.email || 'Unknown',
                    userFullName: user?.full_name || user?.user_metadata?.full_name || 'Unknown User',
                    accounts: []
                });
            }

            groupedAccounts.get(userId)?.accounts.push(account);
        });

        return Array.from(groupedAccounts.values());
    }

    static async getAllPosts(): Promise<InstagramPost[]> {
        const supabase = getSupabaseClient();

        // First check if current user is admin
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const isAdmin = await UserService.isCurrentUserAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Only admins can access all posts');
        }

        const {data, error} = await supabase
            .from("instagram_posts")
            .select("*");

        if (error) {
            logError(error, 'InstagramService.getAllPosts');
            throw error;
        }

        return data || [];
    }

    // ... rest of the existing methods remain the same
    static async deleteAccount(accountId: string, userId?: string): Promise<void> {
        const supabase = getSupabaseClient();

        // Check if the current user is an admin if no userId is provided or user is deleting someone else's account
        let isAdmin = false;
        const {data: {user: currentUser}} = await supabase.auth.getUser();

        if (!currentUser) throw new Error('Authentication required');

        // If userId is different from current user, check admin status
        if (!userId || userId !== currentUser.id) {
            isAdmin = await UserService.isCurrentUserAdmin();
            if (!isAdmin) {
                throw new Error('Unauthorized: Only admins can delete other users accounts');
            }
        }

        // 1. Delete posts and media first
        await this.deleteAssociatedData(accountId);

        // 2. Delete the account itself
        const query = supabase
            .from("instagram_accounts")
            .delete()
            .eq("id", accountId);

        // Only add user_id filter if not admin
        if (!isAdmin && userId) {
            query.eq("user_id", userId);
        }

        const {error} = await query;

        if (error) {
            logError(error, 'InstagramService.deleteAccount');
            throw error;
        }
    }

    private static async deleteAssociatedData(accountId: string): Promise<void> {
        const supabase = getSupabaseClient();

        try {
            // 1. Find posts
            const {data: posts, error: postsError} = await supabase
                .from("instagram_posts")
                .select("id")
                .eq("user_id", accountId);

            if (postsError) throw postsError;

            const postIds = posts?.map(post => post.id) || [];

            // 2. Delete media files from storage
            if (postIds.length > 0) {
                await this.deletePostMedia(postIds);

                // 3. Delete media records
                const {error: mediaError} = await supabase
                    .from("instagram_post_media")
                    .delete()
                    .in("post_id", postIds);

                if (mediaError) throw mediaError;

                // 4. Delete posts
                const {error: postsDeleteError} = await supabase
                    .from("instagram_posts")
                    .delete()
                    .in("id", postIds);

                if (postsDeleteError) throw postsDeleteError;
            }

            // 5. Delete profile images
            await this.deleteProfileImages(accountId);
        } catch (error) {
            logError(error, 'InstagramService.deleteAssociatedData');
            throw error;
        }
    }

    private static async deletePostMedia(postIds: number[]): Promise<void> {
        const supabase = getSupabaseClient();

        for (const postId of postIds) {
            await this.deleteStorageFilesByPrefix(supabase, 'instagram-media', `posts/${postId}/`);
        }
    }

    private static async deleteProfileImages(accountId: string): Promise<void> {
        const supabase = getSupabaseClient();
        const profilePrefix = `instagram-${accountId}-`;
        await this.deleteStorageFilesByPrefix(supabase, 'instagram-profiles', profilePrefix);
    }

    static async deletePost(postId: number): Promise<void> {
        const supabase = getSupabaseClient();

        // First check if current user is admin
        const isAdmin = await UserService.isCurrentUserAdmin();
        if (!isAdmin) {
            throw new Error('Unauthorized: Only admins can delete posts');
        }

        try {
            // 1. Delete media files from storage
            await this.deletePostMedia([postId]);

            // 2. Delete media records
            const {error: mediaError} = await supabase
                .from("instagram_post_media")
                .delete()
                .eq("post_id", postId);

            if (mediaError) throw mediaError;

            // 3. Delete the post itself
            const {error: postError} = await supabase
                .from("instagram_posts")
                .delete()
                .eq("id", postId);

            if (postError) throw postError;
        } catch (error) {
            logError(error, `InstagramService.deletePost(${postId})`);
            throw error;
        }
    }

    private static async deleteStorageFilesByPrefix(supabase: any, bucket: string, prefix: string): Promise<void> {
        try {
            // List files in bucket
            const {data: files, error: listError} = await supabase
                .storage
                .from(bucket)
                .list('');

            if (listError) throw listError;
            if (!files || files.length === 0) return;

            // Filter matching files
            const matchingFiles = files.filter((file: { name: string; }) => file.name.startsWith(prefix));
            if (matchingFiles.length === 0) return;

            // Delete files
            const filePaths = matchingFiles.map((file: { name: any; }) => file.name);
            const {error: deleteError} = await supabase
                .storage
                .from(bucket)
                .remove(filePaths);

            if (deleteError) throw deleteError;
        } catch (error) {
            logError(error, `InstagramService.deleteStorageFilesByPrefix(${bucket}, ${prefix})`);
            throw error;
        }
    }
}