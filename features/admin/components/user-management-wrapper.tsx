"use client";

import { useState } from "react";
import { UserManagement } from "@/features/users/components/user-management";
import { UserWithRole } from "@/features/users/services/user-service";

interface UserManagementWrapperProps {
  initialUsers: any[];
  currentUserId: string;
}

export function UserManagementWrapper({ initialUsers, currentUserId }: UserManagementWrapperProps) {
  // Map the users to the expected format
  const mappedUsers: UserWithRole[] = initialUsers.map(user => ({
    id: user.id,
    email: user.email || '',
    full_name: user.full_name || '',
    avatar_url: user.avatar_url,
    is_admin: user.is_admin || false,
    created_at: user.created_at
  }));

  const [users, setUsers] = useState<UserWithRole[]>(mappedUsers);

  // Update users list after operations
  const handleUserUpdated = (updatedUser: UserWithRole) => {
    setUsers(prevUsers => {
      return prevUsers.map(user => 
        user.id === updatedUser.id ? updatedUser : user
      );
    });
  };

  const handleUserDeleted = (userId: string) => {
    setUsers(prevUsers => {
      return prevUsers.filter(user => user.id !== userId);
    });
  };

  return (
    <UserManagement 
      users={users} 
      currentUserId={currentUserId} 
      onUserUpdated={handleUserUpdated}
      onUserDeleted={handleUserDeleted}
    />
  );
}
