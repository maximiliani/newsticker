"use client";

import { useState, useEffect, useRef } from "react";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Trash2, Shield, Save, Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { AccountDeletionDialog } from "@/components/user/account_deletion_dialog";
import { ProfileService } from "@/features/users/services/profile-service";
import {createClient} from "@/lib/supabase/client";

interface UserDetails {
  full_name: string;
  avatar_url?: string;
}

export function ProfileSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [userDetails, setUserDetails] = useState<UserDetails>({ full_name: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        // Get user from auth
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Get full profile from service
        const profile = await ProfileService.getCurrentUserProfile();

        if (user) {
          setUser(user);
          setUserDetails({
            full_name: profile?.full_name || "",
            avatar_url: profile?.avatar_url || undefined,
          });
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setError("Failed to load profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setError(null);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDeleteAvatar = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!user) return;

      // Use ProfileService to delete avatar
      await ProfileService.deleteAvatar();

      setSuccess("Avatar deleted successfully");
      setPreviewUrl(null);
      setUserDetails(prev => ({ ...prev, avatar_url: undefined }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete avatar");
    } finally {
      setSaving(false);
    }
  };

  const clearPasswordFields = () => {
    if (formRef.current) {
      const currentPasswordInput = formRef.current.querySelector('[name="currentPassword"]') as HTMLInputElement;
      const newPasswordInput = formRef.current.querySelector('[name="newPassword"]') as HTMLInputElement;
      const confirmPasswordInput = formRef.current.querySelector('[name="confirmPassword"]') as HTMLInputElement;
      const avatarInput = formRef.current.querySelector('[name="avatar"]') as HTMLInputElement;
      
      if (currentPasswordInput) currentPasswordInput.value = '';
      if (newPasswordInput) newPasswordInput.value = '';
      if (confirmPasswordInput) confirmPasswordInput.value = '';
      if (avatarInput) avatarInput.value = '';
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
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
      if (!user) throw new Error("User not found");

      // Update profile information (name and email)
      if (email !== user.email || firstName || lastName) {
        await ProfileService.updateProfile({
          firstName,
          lastName,
          email: email !== user.email ? email : undefined
        });

        // Update local state
        const fullName = `${firstName} ${lastName}`;
        if (fullName !== userDetails.full_name) {
          setUserDetails(prev => ({ ...prev, full_name: fullName }));
        }
      }

      // Update password if provided
      if (newPassword || confirmPassword || currentPassword) {
        if (!currentPassword) {
          throw new Error("Current password is required to change password");
        }
        if (newPassword !== confirmPassword) {
          throw new Error("New passwords do not match");
        }

        await ProfileService.updatePassword(currentPassword, newPassword);
      }

      // Upload avatar if a file was selected
      if (avatarFile && avatarFile instanceof File && avatarFile.size > 0) {
        const newAvatarUrl = await ProfileService.uploadAvatar(avatarFile);
        setUserDetails(prev => ({ ...prev, avatar_url: newAvatarUrl }));
      }

      setSuccess("Profile updated successfully");
      setPreviewUrl(null);
      
      // Clear sensitive fields after successful update
      setTimeout(() => {
        clearPasswordFields();
      }, 100);
      
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-4">
              <div className="rounded-full bg-gray-200 h-20 w-20"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-32"></div>
                <div className="h-3 bg-gray-200 rounded w-48"></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">User not found</p>
        </CardContent>
      </Card>
    );
  }

  const [firstName, lastName] = userDetails.full_name.split(" ");
  const displayAvatarUrl = previewUrl || userDetails.avatar_url || "";

  return (
    <>
      <div className="space-y-6">
        {/* Profile Settings Form */}
        <form ref={formRef} onSubmit={handleUpdateProfile} className="space-y-6">
          {/* Personal Information Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    defaultValue={firstName || ""}
                    required
                  />
                </div>
                <div className="grid w-full gap-1.5">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    defaultValue={lastName || ""}
                    required
                  />
                </div>
              </div>
              
              <div className="grid w-full gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={user.email || ""}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Changing your email will require verification
                </p>
              </div>

              <div className="flex gap-2">
                <Badge variant="secondary">
                  Joined {new Date(user.created_at).toLocaleDateString()}
                </Badge>
                {user.email_confirmed_at && (
                  <Badge variant="default">Email Verified</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Profile Picture Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Picture</CardTitle>
              <CardDescription>
                Upload a new profile picture or remove the current one
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="h-20 w-20">
                    <AvatarImage
                      src={displayAvatarUrl}
                      alt={userDetails.full_name || "User"}
                      className="object-cover"
                    />
                    <AvatarFallback className="text-lg">
                      {userDetails.full_name
                        ? userDetails.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "?"}
                    </AvatarFallback>
                  </Avatar>
                  {(userDetails.avatar_url || previewUrl) && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteAvatar}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Label htmlFor="avatar">Upload new picture</Label>
                  <p className="text-sm text-muted-foreground">
                    Maximum file size: 5MB. Supported formats: JPG, PNG, GIF
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
            </CardContent>
          </Card>

          {/* Password Section */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full gap-1.5">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  placeholder="Enter current password to change it"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p className="text-sm text-muted-foreground">
                Leave password fields empty if you don't want to change your password
              </p>
            </CardContent>
          </Card>

          {/* Success/Error Messages */}
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

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>

        {/* Danger Zone Card */}
        <Card className="border-destructive border-4 text-lg font-medium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that will permanently affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-destructive/20 rounded-lg">
                <h3 className="font-medium text-lg text-destructive mb-2">Delete Account</h3>
                <p className="text-muted-foreground mb-4">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  onClick={() => setDeletionOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete My Account
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Deletion Dialog */}
      <AccountDeletionDialog
        open={deletionOpen}
        onOpenChange={setDeletionOpen}
        user={user}
      />
    </>
  );
}