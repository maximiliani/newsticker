import { NextResponse } from 'next/server';
import { UserWithRole } from '@/features/users/services/user-service';
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    // Create authenticated Supabase client
    const supabase = await createClient();

    // Check if user is authenticated
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Check if the user is an admin
        const { data: roleData, error: roleError } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', session.user.id)
            .single();

        if (roleError || !roleData || !roleData.is_admin) {
            return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        // Try to get users from the standard table first
        const { data: users, error } = await supabase
            .from('users_secure')
            .select('*');

        if (error) {
            console.error('Error fetching users from users_secure:', error);

            // If that fails, try the admin function approach
            const { data: functionResult, error: functionError } = await supabase.rpc('get_all_users');

            if (functionError) {
                console.error('Error calling get_all_users function:', functionError);
                return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
            }

            return NextResponse.json({ users: functionResult });
        }

        // Map the users to the expected format
        const mappedUsers: UserWithRole[] = users.map(user => ({
            id: user.id,
            email: user.email || '',
            full_name: user.full_name || '',
            avatar_url: user.avatar_url,
            is_admin: user.is_admin || false,
            created_at: user.created_at
        }));

        return NextResponse.json({ users: mappedUsers });
    } catch (error) {
        console.error('Unexpected error in users API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
