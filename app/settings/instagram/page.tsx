"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserService } from '@/features/users/services/user-service';
import { InstagramService, InstagramAccountsByUser } from '@/features/instagram/services/instagram-service';
import { PageHeading } from '@/components/ui/page-heading';
import { DashboardShell } from '@/components/shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, User } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InstagramAccountsManager } from '@/features/instagram/components/instagram-accounts-manager';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { InstagramAccount } from '@/types/instagram';

export default function InstagramPage() {
    const router = useRouter();
    const [user, setUser] = useState<SupabaseUser | null>(null);
    const [userAccounts, setUserAccounts] = useState<InstagramAccount[]>([]);
    const [groupedAccounts, setGroupedAccounts] = useState<InstagramAccountsByUser[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function checkAuthAndFetchData() {
            try {
                const supabase = createClient();
                
                // Check authentication
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    router.push('/login');
                    return;
                }

                setUser(user);

                // Check admin status
                const isAdmin = await UserService.isCurrentUserAdmin();
                setIsAdmin(isAdmin);

                // Fetch user's Instagram accounts
                try {
                    const fetchedUserAccounts = await InstagramService.getAccountsByUserId(user.id);
                    setUserAccounts(fetchedUserAccounts);
                    
                    // If admin, also fetch all accounts grouped by user
                    if (isAdmin) {
                        const fetchedGroupedAccounts = await InstagramService.getAllAccountsGroupedByUser();
                        setGroupedAccounts(fetchedGroupedAccounts);
                    }
                } catch (error) {
                    console.error('Error fetching Instagram accounts:', error);
                    setError('Failed to load Instagram accounts');
                    setUserAccounts([]);
                    setGroupedAccounts([]);
                }
            } catch (error) {
                console.error('Error in auth check:', error);
                setError('Authentication failed');
            } finally {
                setIsLoading(false);
            }
        }

        checkAuthAndFetchData();
    }, [router]);

    const handleDeleteAccount = async (accountId: number) => {
        if (!confirm('Are you sure you want to delete this Instagram account? This action cannot be undone.')) {
            return;
        }

        try {
            await InstagramService.deleteAccount(accountId);

            // Refresh the data
            if (user) {
                const fetchedUserAccounts = await InstagramService.getAccountsByUserId(user.id);
                setUserAccounts(fetchedUserAccounts);
                
                if (isAdmin) {
                    const fetchedGroupedAccounts = await InstagramService.getAllAccountsGroupedByUser();
                    setGroupedAccounts(fetchedGroupedAccounts);
                }
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            setError('Failed to delete Instagram account');
        }
    };

    if (isLoading) {
        return (
            <DashboardShell>
                <PageHeading
                    heading="Instagram Account Management"
                    text="Manage your Instagram accounts"
                />
                <div className="my-8">
                    <Skeleton className="h-[500px] w-full" />
                </div>
            </DashboardShell>
        );
    }

    if (error) {
        return (
            <DashboardShell>
                <PageHeading
                    heading="Instagram Account Management"
                    text="Manage your Instagram accounts"
                />
                <div className="my-8 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    <p>{error}</p>
                </div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell>
            <PageHeading
                heading="Instagram Account Management"
                text={isAdmin ? "Manage all Instagram accounts across the platform" : "Manage your Instagram accounts"}
            />
            
            {user && (
                <Tabs defaultValue="my-accounts" className="mt-6">
                    <TabsList>
                        <TabsTrigger value="my-accounts">My Accounts</TabsTrigger>
                        {isAdmin && <TabsTrigger value="all-accounts">All User Accounts</TabsTrigger>}
                    </TabsList>
                    
                    <TabsContent value="my-accounts" className="mt-4">
                        <InstagramAccountsManager 
                            initialAccounts={userAccounts}
                        />
                    </TabsContent>
                    
                    {isAdmin && (
                        <TabsContent value="all-accounts" className="mt-4">
                            <div className="space-y-6">
                                {groupedAccounts.length === 0 ? (
                                    <Card>
                                        <CardContent className="p-6 text-center">
                                            <p className="text-gray-500">No Instagram accounts found.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    groupedAccounts.map((userGroup) => (
                                        <Card key={userGroup.userId}>
                                            <CardHeader>
                                                <CardTitle className="flex items-center gap-2">
                                                    <User className="h-5 w-5" />
                                                    {userGroup.userFullName}
                                                    <Badge variant="secondary">{userGroup.userEmail}</Badge>
                                                    <Badge variant="outline">{userGroup.accounts.length} accounts</Badge>
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                {userGroup.accounts.length === 0 ? (
                                                    <p className="text-gray-500 text-sm">No Instagram accounts for this user.</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {userGroup.accounts.map((account) => (
                                                            <div key={account.id} className="border rounded-lg p-4 flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    {account.profile_image_url && (
                                                                        <img 
                                                                            src={account.profile_image_url} 
                                                                            alt={account.username}
                                                                            className="w-10 h-10 rounded-full object-cover"
                                                                        />
                                                                    )}
                                                                    <div>
                                                                        <p className="font-medium">@{account.username}</p>
                                                                        <p className="text-sm text-gray-500">ID: {account.id}</p>
                                                                    </div>
                                                                </div>
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteAccount(account.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>
                    )}
                </Tabs>
            )}
        </DashboardShell>
    );
}