"use client";

import { UserProfileDialog } from "@/components/UserProfileDialog";
import { User } from "@supabase/supabase-js";

interface ProfileViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  userDetails: {
    full_name: string;
    avatar_url?: string;
  };
}

export function ProfileViewDialog({
  open,
  onOpenChange,
  user,
  userDetails,
}: ProfileViewDialogProps) {
  return (
    <UserProfileDialog
      open={open}
      onOpenChange={onOpenChange}
      user={{
        name: userDetails.full_name,
        avatar: userDetails.avatar_url,
        email: user.email || undefined,
      }}
      title="Profile"
    />
  );
}