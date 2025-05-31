'use client';

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Instagram, Loader2, PlusCircle, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog"; // Ensure this path is correct

interface InstagramAccount {
  id: string;
  username: string;
  profile_image_url: string | null;
}

interface Props {
  initialAccounts: InstagramAccount[];
  userId: string;
}

export function InstagramAccountsManager({ initialAccounts, userId }: Props) {
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

  const handleDelete = async () => {
    if (!accountToDelete) return;

    const accountId = accountToDelete.id;

    try {
      setIsDeleting(accountId);

      // Fetch posts associated with the account
      const { data: posts, error: postsError } = await supabase
        .from("instagram_posts") // Assuming 'posts' table with 'account_id'
        .select("id")
        .eq("user_id", accountId);

      if (postsError) {
        console.error("Error fetching posts:", postsError);
        throw postsError;
      }

      if (posts && posts.length > 0) {
        const postIds = posts.map((post) => post.id);

        // Delete media associated with these posts
        // Assuming 'media' table with 'post_id'
        const { error: mediaError } = await supabase
          .from("instagram_post_media")
          .delete()
          .in("post_id", postIds);

        if (mediaError) {
          console.error("Error deleting media:", mediaError);
          throw mediaError;
        }

        // Delete the posts
        const { error: deletePostsError } = await supabase
          .from("instagram_posts")
          .delete()
          .in("id", postIds);

        if (deletePostsError) {
          console.error("Error deleting posts:", deletePostsError);
          throw deletePostsError;
        }
      }

      // Delete the Instagram account
      const { error: accountError } = await supabase
        .from("instagram_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", userId);

      if (accountError) {
        console.error("Error deleting Instagram account:", accountError);
        throw accountError;
      }

      setAccounts(accounts.filter(acc => acc.id !== accountId));
      router.refresh();
    } catch (error) {
      console.error("Error during deletion process:", error);
      // Optionally, display an error message to the user
    } finally {
      setIsDeleting(null);
      setAccountToDelete(null); // Clear the account to delete
    }
  };

  return (
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
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <Instagram className="h-5 w-5" />
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
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the
                      account "{accountToDelete?.username}" and all associated posts and media.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setAccountToDelete(null)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
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
        <PlusCircle className="h-4 w-4 mr-2" />
        Connect Instagram Account
      </Button>
    </div>
  );
}