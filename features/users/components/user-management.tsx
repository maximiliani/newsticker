"use client";

import { useState } from "react";
import { UserWithRole, UserService } from "@/features/users/services/user-service";
import { UserTable } from "@/features/users/components/user-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface UserManagementProps {
  users: UserWithRole[];
  currentUserId: string;
  onUserUpdated?: (user: UserWithRole) => void;
  onUserDeleted?: (userId: string) => void;
}

export function UserManagement({ users: initialUsers, currentUserId, onUserUpdated, onUserDeleted }: UserManagementProps) {
  const [users, setUsers] = useState<UserWithRole[]>(initialUsers);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateAdminStatus = async (userId: string, isAdmin: boolean) => {
    try {
      await UserService.updateUserAdminStatus(userId, isAdmin);
      
      // Update the local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_admin: isAdmin } : user
      ));
      
      // Call the callback if provided
      if (onUserUpdated) {
        const updatedUser = users.find(u => u.id === userId);
        if (updatedUser) {
          onUserUpdated({
            ...updatedUser,
            is_admin: isAdmin
          });
        }
      }

      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Use UserService instead of undefined deleteUser function
      await UserService.deleteUser(userId);

      // Update the local state
      setUsers(users.filter(user => user.id !== userId));

      // Call the callback if provided
      if (onUserDeleted) {
        onUserDeleted(userId);
      }
      
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const refreshUsers = async () => {
    try {
      setIsLoading(true);
      const refreshedUsers = await UserService.getAllUsers();
      setUsers(refreshedUsers);
      toast.success("User list refreshed");
    } catch (error) {
      toast.error(`Failed to refresh users: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          Manage user accounts and permissions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex justify-end">
          <Button
            onClick={refreshUsers}
            disabled={isLoading}
            variant="default"
            size="sm"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
        
        <UserTable
          users={users}
          currentUserId={currentUserId}
          onUpdateAdminStatus={handleUpdateAdminStatus}
          onDeleteUser={handleDeleteUser}
        />
      </CardContent>
    </Card>
  );
}