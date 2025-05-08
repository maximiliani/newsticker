"use client";

import { useState } from "react";
import { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2 } from "lucide-react";

interface ProfileSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  userDetails: {
    full_name: string;
    avatar_url?: string;
  };
}

export function ProfileSettingsDialog({
  open,
  onOpenChange,
  user,
  userDetails,
}: ProfileSettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const addCacheBuster = (url: string) => {
    const timestamp = new Date().getTime();
    return `${url}?t=${timestamp}`;
  };

  const handleDeleteAvatar = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list();
      
      const existingAvatar = existingFiles?.find(file => 
        file.name.startsWith(`${user.id}.`)
      );

      if (existingAvatar) {
        await supabase.storage
          .from("avatars")
          .remove([existingAvatar.name]);

        // Update user metadata to remove avatar URL
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            avatar_url: null,
          },
        });
        if (updateError) throw updateError;

        setSuccess("Avatar deleted successfully");
        setPreviewUrl(null);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete avatar");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);
    const firstName = formData.get("firstName") as string;
    const lastName = formData.get("lastName") as string;
    const email = formData.get("email") as string;
    const currentPassword = formData.get("currentPassword") as string;
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const avatarFile = formData.get("avatar") as File | null;

    try {
      // Validate passwords if trying to change password
      if (newPassword || confirmPassword || currentPassword) {
        if (!currentPassword) {
          throw new Error("Current password is required to change password");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("New passwords do not match");
        }

        // Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: user.email!,
          password: currentPassword,
        });

        if (signInError) {
          throw new Error("Current password is incorrect");
        }

        // Update password
        const { error: passwordError } = await supabase.auth.updateUser({
          password: newPassword,
        });
        if (passwordError) throw passwordError;
      }

      // Update email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email,
        });
        if (emailError) throw emailError;
      }

      // Update avatar if a file was selected
      if (avatarFile && avatarFile instanceof File && avatarFile.size > 0) {
        if (avatarFile.size > 5 * 1024 * 1024) {
          throw new Error("Avatar file size must be less than 5MB");
        }

        if (!avatarFile.type.startsWith('image/')) {
          throw new Error("File must be an image");
        }

        const fileExt = avatarFile.name.split(".").pop();
        const filePath = `${user.id}.${fileExt}`;

        try {
          // Delete existing avatar if it exists
          const { data: existingFiles } = await supabase.storage
            .from("avatars")
            .list();
          
          const existingAvatar = existingFiles?.find(file => 
            file.name.startsWith(`${user.id}.`)
          );

          if (existingAvatar) {
            await supabase.storage
              .from("avatars")
              .remove([existingAvatar.name]);
          }

          // Upload new avatar
          const { error: uploadError, data: uploadData } = await supabase.storage
            .from("avatars")
            .upload(filePath, avatarFile, {
              upsert: true,
              contentType: avatarFile.type,
            });
          
          if (uploadError) throw uploadError;

          // Get public URL with cache buster
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(filePath);

          // Update user metadata with new avatar URL including cache buster
          const { error: updateError } = await supabase.auth.updateUser({
            data: {
              avatar_url: addCacheBuster(urlData.publicUrl),
            },
          });
          if (updateError) throw updateError;
        } catch (storageError) {
          console.error('Storage error:', storageError);
          throw new Error('Failed to upload avatar. Please try again.');
        }
      }

      // Update name if changed
      const fullName = `${firstName} ${lastName}`;
      if (fullName !== userDetails.full_name) {
        const { error: nameError } = await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            first_name: firstName,
            last_name: lastName,
          },
        });
        if (nameError) throw nameError;
      }

      setSuccess("Profile updated successfully");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const [firstName, lastName] = userDetails.full_name.split(" ");

  // Add cache buster to the displayed avatar URL
  const displayAvatarUrl = previewUrl || (userDetails.avatar_url ? addCacheBuster(userDetails.avatar_url) : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
          className="sm:max-w-[525px] md:max-w-[625px] lg:max-w-[725px] xl:max-w-[825px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          {/* Personal Information Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-1 bg-primary rounded" />
              <h3 className="text-lg font-semibold">Personal Information</h3>
            </div>
            <div className="space-y-4 pl-3">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  defaultValue={firstName}
                  required
                />
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  defaultValue={lastName}
                  required
                />
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={user.email}
                  required
                />
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-1 bg-primary rounded" />
              <h3 className="text-lg font-semibold">Change Password</h3>
            </div>
            <div className="space-y-4 pl-3">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  placeholder="Enter current password to change it"
                />
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="Enter new password"
                />
              </div>
              <div className="grid w-full gap-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm new password"
                />
              </div>
            </div>
          </div>

          {/* Avatar Section */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-1 bg-primary rounded" />
              <h3 className="text-lg font-semibold">Profile Picture</h3>
            </div>
            <div className="space-y-4 pl-3">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={displayAvatarUrl}
                      alt={userDetails.full_name}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-lg">
                      {userDetails.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {(userDetails.avatar_url || previewUrl) && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAvatar}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  )}
                </div>
                <div className="flex-1">
                  <Label htmlFor="avatar">Upload new picture</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Maximum file size: 5MB
                  </p>
                  <Input
                    id="avatar"
                    name="avatar"
                    type="file"
                    accept="image/*"
                    className="cursor-pointer"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 