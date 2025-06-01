"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserWithRole, UserService } from '@/features/users/services/user-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface UserProfileEditorProps {
  user: UserWithRole;
}

export function UserProfileEditor({ user }: UserProfileEditorProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    full_name: user.full_name || '',
    email: user.email || '',
    avatar_url: user.avatar_url || '',
    is_admin: user.is_admin || false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAdminToggle = (checked: boolean) => {
    setFormData(prev => ({ ...prev, is_admin: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsSubmitting(true);

      // Call the service to update the user profile
      await UserService.updateUserProfile(user.id, formData);

      toast.success('User profile updated successfully');
      router.refresh();

      // Navigate back to users list after successful update
      setTimeout(() => {
        router.push('/settings/users');
      }, 1500);
    } catch (error) {
      console.error('Failed to update user profile:', error);
      toast.error(`Failed to update user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit User Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              placeholder="Full Name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Email Address"
              disabled // Email changes should be handled through auth provider
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="avatar_url">Avatar URL</Label>
            <Input
              id="avatar_url"
              name="avatar_url"
              value={formData.avatar_url}
              onChange={handleInputChange}
              placeholder="Avatar URL"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="is_admin"
              checked={formData.is_admin}
              onCheckedChange={handleAdminToggle}
            />
            <Label htmlFor="is_admin">Administrator Access</Label>
          </div>

          <div className="flex justify-end space-x-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
