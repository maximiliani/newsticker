'use client';

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { Instagram, Loader2, PlusCircle, Trash2 } from "lucide-react";

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

  const handleDelete = async (accountId: string) => {
    try {
      setIsDeleting(accountId);
      const { error } = await supabase
        .from("instagram_accounts")
        .delete()
        .eq("id", accountId)
        .eq("user_id", userId);

      if (error) throw error;

      setAccounts(accounts.filter(account => account.id !== accountId));
      router.refresh();
    } catch (error) {
      console.error("Error deleting Instagram account:", error);
    } finally {
      setIsDeleting(null);
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
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(account.id)}
                disabled={isDeleting === account.id}
              >
                {isDeleting === account.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
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