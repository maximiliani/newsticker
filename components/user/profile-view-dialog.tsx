"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@supabase/supabase-js";
import { Mail, User as UserIcon } from "lucide-react";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px] md:max-w-[625px] lg:max-w-[725px] xl:max-w-[825px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-6 py-4">
          <Avatar className="h-64 w-64">
            <AvatarImage
              src={userDetails.avatar_url || ""}
              alt={userDetails.full_name}
              className="object-cover"
            />
            <AvatarFallback className="text-3xl">
              {userDetails.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="w-full space-y-4">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <UserIcon className="h-4 w-4" />
              <span className="text-foreground font-medium">{userDetails.full_name}</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <a className="text-blue-500 hover:text-blue-600 underline font-medium" href={"mailto:"+user.email}>{user.email}</a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 