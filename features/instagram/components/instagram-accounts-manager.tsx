'use client';

import {useState} from "react";
import {useRouter} from "next/navigation";
import Image from "next/image";
import {Instagram, Loader2, Trash2} from "lucide-react";
import {Button} from "@/components/ui/button";
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
import {InstagramService} from "../services/instagram-service";
import {InstagramAccount} from "@/types/instagram";
import {logError} from "@/lib/utils/error-handling";
import RefreshInstagramFeedsButton from "./refresh-instagram-feeds-button";
import {InstagramLoginButton} from "@/features/instagram/components/instagram-login-button";

interface Props {
    initialAccounts: InstagramAccount[];
    userId: string;
}

export function InstagramAccountsManager({initialAccounts, userId}: Props) {
    const [accounts, setAccounts] = useState<InstagramAccount[]>(initialAccounts);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [accountToDelete, setAccountToDelete] = useState<InstagramAccount | null>(null);
    const router = useRouter();

    const confirmDelete = (account: InstagramAccount) => {
        setAccountToDelete(account);
    };

    const handleDelete = async () => {
        if (!accountToDelete) return;

        const accountId = accountToDelete.id;

        try {
            setIsDeleting(accountId);

            // Use the service to handle all the deletion logic
            await InstagramService.deleteAccount(accountId, userId);

            // Update local state
            setAccounts(accounts.filter(acc => acc.id !== accountId));
            router.refresh();
        } catch (error) {
            logError(error, 'InstagramAccountsManager.handleDelete');
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
                <RefreshInstagramFeedsButton/>
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

                <InstagramLoginButton/>
            </div>
        </div>
    );
}
