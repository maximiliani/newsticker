"use client";

import { useState } from "react";
import { UserWithRole, UserService } from "@/features/users/services/user-service";
import { UserTable } from "@/features/users/components/user-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface UserManagementProps {
  users: UserWithRole[];
  currentUserId: string;
}

export function UserManagement({ users: initialUsers, currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<UserWithRole[]>(initialUsers);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateAdminStatus = async (userId: string, isAdmin: boolean) => {
    try {
      await UserService.updateUserAdminStatus(userId, isAdmin);
      
      // Update the local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_admin: isAdmin } : user
      ));
      
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await UserService.deleteUser(userId);
      
      // Update the local state
      setUsers(users.filter(user => user.id !== userId));
      
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
          <button
            onClick={refreshUsers}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
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