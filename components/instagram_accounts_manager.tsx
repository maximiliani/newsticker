'use client';

import {createClient} from "@/utils/supabase/client";
import {Button} from "@/components/ui/button";
import {useRouter} from "next/navigation";
import {useState} from "react";
import Image from "next/image";
import {Instagram, Loader2, PlusCircle, Trash2} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import RefreshIGFeedsButton from "@/components/RefreshIGFeedsButton"; // Ensure this path is correct

interface InstagramAccount {
    id: string;
    username: string;
    profile_image_url: string | null;
}

interface Props {
    initialAccounts: InstagramAccount[];
    userId: string;
}

export function InstagramAccountsManager({initialAccounts, userId}: Props) {
    const [accounts, setAccounts] = useState<InstagramAccount[]>(initialAccounts);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<InstagramAccount | null>(null);
    const router = useRouter();
    const supabase = createClient();

    const handleConnect = () => {
        const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID!;
        const authUrl = new URL("https://www.instagram.com/oauth/authorize");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", `${window.location.origin}/api/instagram/callback`);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights");
        authUrl.searchParams.set("enable_fb_login", "0");
        authUrl.searchParams.set("force_authentication", "1");

        window.location.href = authUrl.toString();
    };

    const confirmDelete = (account: InstagramAccount) => {
        setAccountToDelete(account);
    };

    /**
     * Helper function to delete storage files by path pattern
     */
    const deleteStorageFiles = async (bucket: string, pathPrefix: string) => {
        try {
            console.log(`Deleting files from bucket '${bucket}' with prefix '${pathPrefix}'`);

            // List all files in the bucket
            const {data: files, error: listError} = await supabase
                .storage
                .from(bucket)
                .list('');

            if (listError) {
                console.error(`Error listing files in bucket '${bucket}':`, listError);
                return;
            }

            if (!files || files.length === 0) {
                console.log(`No files found in bucket '${bucket}'`);
                return;
            }

            // Filter files that match the prefix pattern
            const matchingFiles = files.filter(file => file.name.startsWith(pathPrefix));

            if (matchingFiles.length === 0) {
                console.log(`No files found in bucket '${bucket}' with prefix '${pathPrefix}'`);
                return;
            }

            // Delete files in batches to avoid overwhelming the API
            const filePaths = matchingFiles.map(file => file.name);
            console.log(`Found ${filePaths.length} files to delete from bucket '${bucket}':`, filePaths);

            const {error: deleteError} = await supabase
                .storage
                .from(bucket)
                .remove(filePaths);

            if (deleteError) {
                console.error(`Error deleting files from bucket '${bucket}':`, deleteError);
            } else {
                console.log(`Successfully deleted ${filePaths.length} files from bucket '${bucket}'`);
            }
        } catch (error) {
            console.error(`Unexpected error while deleting files from bucket '${bucket}':`, error);
        }
    };

    /**
     * Delete profile image files for the account
     * Profile images are named like: instagram-{accountId}-{timestamp}.jpg
     */
    const deleteProfileFiles = async (accountId: string) => {
        const profilePrefix = `instagram-${accountId}-`;
        await deleteStorageFiles('instagram-profiles', profilePrefix);
    };

    /**
     * Delete all media files associated with the account's posts
     */
    const deleteMediaFiles = async (postIds: number[]) => {
        // Delete media files for each post
        for (const postId of postIds) {
            await deleteStorageFiles('instagram-media', `posts/${postId}/`);
        }
    };

    const handleDelete = async () => {
        if (!accountToDelete) return;

        const accountId = accountToDelete.id;

        try {
            setIsDeleting(accountId);

            // Fetch posts associated with the account
            const {data: posts, error: postsError} = await supabase
                .from("instagram_posts")
                .select("id")
                .eq("user_id", accountId);

            if (postsError) {
                console.error("Error fetching posts:", postsError);
                throw postsError;
            }

            let postIds: number[] = [];
            if (posts && posts.length > 0) {
                postIds = posts.map((post) => post.id);

                // Delete media files from storage before deleting database records
                console.log(`Deleting media files for ${postIds.length} posts...`);
                await deleteMediaFiles(postIds);

                // Delete media records from database
                const {error: mediaError} = await supabase
                    .from("instagram_post_media")
                    .delete()
                    .in("post_id", postIds);

                if (mediaError) {
                    console.error("Error deleting media records:", mediaError);
                    throw mediaError;
                }

                // Delete the posts from database
                const {error: deletePostsError} = await supabase
                    .from("instagram_posts")
                    .delete()
                    .in("id", postIds);

                if (deletePostsError) {
                    console.error("Error deleting posts:", deletePostsError);
                    throw deletePostsError;
                }
            }

            // Delete profile image files from storage
            // Profile images are named like: instagram-{accountId}-{timestamp}.jpg
            console.log(`Deleting profile files for account ID ${accountId}...`);
            await deleteProfileFiles(accountId);

            // Delete the Instagram account from database
            const {error: accountError} = await supabase
                .from("instagram_accounts")
                .delete()
                .eq("id", accountId)
                .eq("user_id", userId);

            if (accountError) {
                console.error("Error deleting Instagram account:", accountError);
                throw accountError;
            }

            console.log(`Successfully deleted account ${accountToDelete.username} and all associated data`);
            setAccounts(accounts.filter(acc => acc.id !== accountId));
            router.refresh();
        } catch (error) {
            console.error("Error during deletion process:", error);
            // Optionally, display an error message to the user
            alert(`Failed to delete account: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsDeleting(null);
            setAccountToDelete(null);
        }
    };

    return (
        <div className="bg-card rounded-lg p-6 border">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl">Instagram Accounts</h2>
                <RefreshIGFeedsButton/>
            </div>
            <p className="text-muted-foreground mb-4">
                Manage your connected Instagram accounts below. You can add, remove, or view details of your
                accounts.
            </p>
            <div className="space-y-4">
                {accounts.length > 0 ? (
                    <div className="grid gap-4">
                        {accounts.map((account) => (
                            <div
                                key={account.id}
                                className="flex items-center justify-between p-4 bg-background rounded-lg border"
                            >
                                <div className="flex items-center gap-3">
                                    {account.profile_image_url ? (
                                        <Image
                                            src={account.profile_image_url}
                                            alt={account.username}
                                            width={40}
                                            height={40}
                                            className="rounded-full"
                                        />
                                    ) : (
                                        <div
                                            className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                                            <Instagram className="h-5 w-5"/>
                                        </div>
                                    )}
                                    <span className="font-medium">{account.username}</span>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => confirmDelete(account)}
                                            disabled={isDeleting === account.id}
                                        >
                                            {isDeleting === account.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin"/>
                                            ) : (
                                                <Trash2 className="h-4 w-4"/>
                                            )}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the
                                                account "{accountToDelete?.username}" and all associated posts and
                                                media.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel
                                                onClick={() => setAccountToDelete(null)}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                className="bg-destructive text-white hover:bg-destructive/90"
                                                onClick={handleDelete}>
                                                Continue
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-muted-foreground py-8">
                        No Instagram accounts connected
                    </div>
                )}

                <Button
                    onClick={handleConnect}
                    className="w-full"
                >
                    <PlusCircle className="h-4 w-4 mr-2"/>
                    Connect Instagram Account
                </Button>
            </div>
        </div>
    );
}