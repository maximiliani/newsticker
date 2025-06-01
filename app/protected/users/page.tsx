'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from "@/lib/supabase/client";
import { UserService } from "@/features/users/services/user-service";
import { UserManagement } from "@/features/users/components/user-management";

export const dynamic = 'force-dynamic';

interface UserWithRole {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    is_admin: boolean;
    created_at: string;
}

/**
 * User management page component that displays a list of users
 * and allows admins to manage them
 */
export default function UsersPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [users, setUsers] = useState<UserWithRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function checkAuthAndFetchUsers() {
            try {
                setIsLoading(true);
                setError(null);
                
                // Get current user
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    router.push('/sign-in');
                    return;
                }
                
                setUser(user);
                
                // Check if user is admin
                const isAdmin = await UserService.isCurrentUserAdmin();
                
                if (!isAdmin) {
                    console.log('User is not an admin, redirecting');
                    router.push('/protected?error=permission&message=You do not have permission to access this page');
                    return;
                }
                
                console.log('User is admin, fetching user list');
                // Fetch all users
                const usersList = await UserService.getAllUsers();
                setUsers(usersList);
                
            } catch (err) {
                console.error('Error in UsersPage:', err);
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                setError(errorMessage);
                // Redirect with error after a short delay
                setTimeout(() => {
                    router.push(`/protected?error=permission&message=${encodeURIComponent(errorMessage)}`);
                }, 100);
            } finally {
                setIsLoading(false);
            }
        }
        
        checkAuthAndFetchUsers();
    }, [router]);
    
    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 dark:border-white"></div>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">Loading user management...</p>
            </div>
        );
    }
    
    if (error) {
        return (
            <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center">
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 max-w-md" role="alert">
                    <span className="block sm:inline">{error}</span>
                </div>
            </div>
        );
    }
    
    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">User Management</h1>
            {users.length > 0 && user ? (
                <UserManagement users={users} currentUserId={user.id} />
            ) : (
                <p>No users found</p>
            )}
        </div>
    );
}