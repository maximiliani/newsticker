export interface UserWithRoleDTO {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  is_admin: boolean;
  created_at: string;
}

export interface UserUpdateDTO {
  full_name?: string;
  avatar_url?: string | null;
  is_admin?: boolean;
}
