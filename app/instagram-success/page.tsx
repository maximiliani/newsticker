'use client';

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, Suspense } from 'react';
export const dynamic = 'force-dynamic';
import { useSearchParams } from 'next/navigation';

interface InstagramAccount {
    id: string;
    username: string;
    profile_image_url: string | null;
    access_token: string | null;
    timestamp: number;
}

function InstagramSuccessContent() {
    const searchParams = useSearchParams();
    const initialToken = searchParams?.get('token');
    const initialUserId = searchParams?.get('userId');

    const [account, setAccount] = useState<InstagramAccount | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showToken, setShowToken] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchInstagramAccount() {
            try {
                setIsLoading(true);
                const supabase = createClient();

                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setError('User not authenticated');
                    return;
                }

                const { data, error } = await supabase
                    .from('public_instagram_accounts')  // Use the public view instead
                    .select('id, username, profile_image_url, timestamp')
                    .eq('user_id', user.id)
                    .order('timestamp', { ascending: false })
                    .limit(1)
                    .single();

                if (error) {
                    setError('Failed to fetch Instagram account');
                    return;
                }

                if (data) {
                    setAccount(data as InstagramAccount);
                }
            } catch (error) {
                console.error('Error fetching Instagram account:', error);
                setError('An unexpected error occurred');
            } finally {
                setIsLoading(false);
            }
        }

        fetchInstagramAccount();
    }, []);

    const toggleTokenDisplay = () => {
        setShowToken(!showToken);
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
                <p>{error}</p>
                <a href="/" className="mt-4 text-blue-600 underline">
                    Go back home
                </a>
            </div>
        );
    }

            if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4">
                <p>Loading account information...</p>
            </div>
        );
            }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-4">Instagram Login Successful!</h1>
            {/* Show initial token and user ID if available */}
            {(initialToken || initialUserId) && (
                <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-2xl w-full">
                    <h2 className="text-lg font-semibold mb-2">One-time display of credentials:</h2>
                    {initialUserId && (
                        <div className="mb-3">
                            <p className="font-medium">User ID:</p>
                            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto">
                                {initialUserId}
                            </pre>
                        </div>
                    )}
                    {initialToken && (
                        <div>
                            <p className="font-medium">Access Token:</p>
                            <pre className="text-xs bg-white p-2 rounded mt-1 overflow-x-auto">
                                {initialToken}
                            </pre>
                        </div>
                    )}
                    <p className="text-sm text-yellow-600 mt-3">
                        ⚠️ These credentials will only be shown once. Please save them if needed.
                    </p>
                </div>
            )}

            {account ? (
                <div className="text-center max-w-2xl">
                    <div className="mb-4">
                        {account.profile_image_url && (
                            <img
                                src={account.profile_image_url}
                                alt={`${account.username}'s profile`}
                                className="w-20 h-20 rounded-full mx-auto mb-2"
                            />
                        )}
                        <p className="font-bold">@{account.username}</p>
                        <p className="text-sm text-gray-600">ID: {account.id}</p>
                        <p className="text-sm text-gray-600">
                            Connected on: {new Date(account.timestamp).toLocaleDateString()}
                        </p>

                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                            <p className="font-bold mb-2">Access Token:</p>
                            <div className="relative">
                                <pre className="text-xs bg-white p-3 rounded overflow-x-auto max-w-full">
                                    {showToken ? account.access_token : '••••••••••••••••••'}
                                </pre>
                                <button
                                    onClick={toggleTokenDisplay}
                                    className="mt-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                    {showToken ? 'Hide Token' : 'Show Token'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <p className="text-green-600">Your Instagram account has been successfully connected!</p>
                </div>
            ) : null}
            <a href="/" className="mt-4 text-blue-600 underline">
                Go back home
            </a>
        </div>
    );
}

export default function InstagramSuccess() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen">Loading...</div>}>
            <InstagramSuccessContent />
        </Suspense>
    );
}