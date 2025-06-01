"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersIcon, NewspaperIcon, InstagramIcon } from "lucide-react";

export function AdminDashboardCards() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UsersIcon className="mr-2 h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            Manage user accounts and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">View, edit, or delete user profiles. Manage admin access and user roles.</p>
        </CardContent>
        <CardFooter>
          <Link href="/protected/admin/users" passHref className="w-full">
            <Button className="w-full">Manage Users</Button>
          </Link>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <InstagramIcon className="mr-2 h-5 w-5" />
            Instagram Feeds
          </CardTitle>
          <CardDescription>
            Manage all Instagram content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">Review and delete Instagram posts from all users across the platform.</p>
        </CardContent>
        <CardFooter>
          <Link href="/protected/admin/instagram" passHref className="w-full">
            <Button className="w-full">Manage Instagram</Button>
          </Link>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <NewspaperIcon className="mr-2 h-5 w-5" />
            News Articles
          </CardTitle>
          <CardDescription>
            Manage all news articles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">View, edit, or delete news articles from all users across the platform.</p>
        </CardContent>
        <CardFooter>
          <Link href="/protected/admin/articles" passHref className="w-full">
            <Button className="w-full">Manage Articles</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
