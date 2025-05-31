"use client";

import {Dialog, DialogContent, DialogHeader, DialogTitle,} from "@/components/ui/dialog";
import {Mail, User as UserIcon} from "lucide-react";
import Image from "next/image";

interface UserProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: {
        name: string;
        avatar?: string;
        email?: string;
    };
    title?: string;
}

export function UserProfileDialog({
                                      open,
                                      onOpenChange,
                                      user,
                                      title = "Profile",
                                  }: UserProfileDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="sm:max-w-[250px] md:max-w-[300px] lg:max-w-[400px] xl:max-w-[500px] max-h-[80vh] resize overflow-auto">
                <DialogHeader>
                    <DialogTitle className="text-base">{title}</DialogTitle>
                </DialogHeader>

                <div className="flex justify-center items-center h-full">
                    {user.avatar ? (
                        <div
                            className="w-full aspect-auto rounded-lg overflow-hidden border border-border bg-muted">
                            <Image
                                src={user.avatar}
                                alt={user.name}
                                width={150}
                                height={250}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div
                            className="w-full max-w-[250px] aspect-square rounded-lg border border-border bg-muted flex items-center justify-center">
                            <div className="text-3xl font-bold text-muted-foreground">
                                {user.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col justify-center space-y-2 h-full">
                    <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                        <UserIcon className="h-3 w-3"/>
                        <span className="text-foreground font-medium text-sm">{user.name}</span>
                    </div>

                    {user.email && (
                        <div className="flex items-center justify-center space-x-2 text-muted-foreground">
                            <Mail className="h-3 w-3"/>
                            <a
                                className="text-blue-500 hover:text-blue-600 underline font-medium text-sm"
                                href={`mailto:${user.email}`}
                            >
                                {user.email}
                            </a>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}