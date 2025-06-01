import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface AdminCardProps {
    icon: LucideIcon;
    title: string;
    description: string;
    content: string;
    buttonText: string;
    href: string;
}

export function AdminCard({ icon: Icon, title, description, content, buttonText, href }: AdminCardProps) {
    return (
        <Card
            className="max-h-full max-w-full flex flex-col shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <Icon className="mr-2 h-5 w-5"/>
                    {title}
                </CardTitle>
                <CardDescription>
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <p className="text-sm">
                    {content}
                </p>
            </CardContent>
            <CardFooter>
                <Link href={href} passHref className="w-full">
                    <Button className="w-full">{buttonText}</Button>
                </Link>
            </CardFooter>
        </Card>
    );
}