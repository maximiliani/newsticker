"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle } from "lucide-react";

interface AccountDeletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
}

export function AccountDeletionDialog({
  open,
  onOpenChange,
  user,
}: AccountDeletionDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationText, setConfirmationText] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [acknowledgeDataLoss, setAcknowledgeDataLoss] = useState(false);
  const [acknowledgeIrreversible, setAcknowledgeIrreversible] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const expectedConfirmationText = "DELETE MY ACCOUNT";
  const isConfirmationValid = confirmationText === expectedConfirmationText;
  const canDelete = isConfirmationValid && 
                   acknowledgeDataLoss && 
                   acknowledgeIrreversible && 
                   passwordConfirmation.length > 0;

  const handleDeleteAccount = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!canDelete) {
      setError("Please complete all required confirmations");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First verify the password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: passwordConfirmation,
      });

      if (signInError) {
        throw new Error("Password verification failed. Please check your password.");
      }

      // Delete user's avatar from storage if it exists
      try {
        const { data: files } = await supabase.storage
          .from("avatars")
          .list();
        
        const userAvatar = files?.find(file => 
          file.name.startsWith(`${user.id}.`)
        );

        if (userAvatar) {
          await supabase.storage
            .from("avatars")
            .remove([userAvatar.name]);
        }
      } catch (storageError) {
        console.warn("Failed to delete avatar:", storageError);
        // Continue with account deletion even if avatar deletion fails
      }

      // Call your backend API to delete user data
      // This should handle deleting all user-related data from your database
      const response = await fetch('/api/user/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user data');
      }

      // Finally, delete the auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      
      if (deleteError) {
        throw new Error("Failed to delete account. Please contact support.");
      }

      // Sign out the user
      await supabase.auth.signOut();
      
      // Redirect to home page or sign up page
      router.push("/?deleted=true");
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setConfirmationText("");
    setPasswordConfirmation("");
    setAcknowledgeDataLoss(false);
    setAcknowledgeIrreversible(false);
    setError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete your account
            and remove all your data from our servers.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleDeleteAccount} className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Account deletion is permanent and irreversible.
              All your data will be permanently deleted.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="grid w-full gap-1.5">
              <Label htmlFor="password-confirm">
                Enter your password to confirm
              </Label>
              <Input
                id="password-confirm"
                type="password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Your current password"
                required
              />
            </div>

            <div className="grid w-full gap-1.5">
              <Label htmlFor="confirmation-text">
                Type <code className="bg-muted px-1 py-0.5 rounded text-sm">DELETE MY ACCOUNT</code> to confirm
              </Label>
              <Input
                id="confirmation-text"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="acknowledge-data-loss"
                  checked={acknowledgeDataLoss}
                />
                <Label htmlFor="acknowledge-data-loss" className="text-sm">
                  I understand that all my data will be permanently deleted
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="acknowledge-irreversible"
                  checked={acknowledgeIrreversible}
                />
                <Label htmlFor="acknowledge-irreversible" className="text-sm">
                  I understand that this action is irreversible
                </Label>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!canDelete || loading}
              className="flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              {loading ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}