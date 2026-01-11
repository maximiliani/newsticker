import {PlusCircle} from "lucide-react";
import {Button} from "@/components/ui/button";

export function InstagramLoginButton() {

    const handleConnect = () => {
        const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID!;
        const authUrl = new URL("https://www.instagram.com/oauth/authorize");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI as string || `http://{window.location.hostname}/api/features/instagram/callback`);
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_content_publish,instagram_business_manage_insights");
        authUrl.searchParams.set("enable_fb_login", "0");
        authUrl.searchParams.set("force_authentication", "1");

        window.location.href = authUrl.toString();
    };

    return (
        <Button
            onClick={handleConnect}
            className="w-full"
        >
            <PlusCircle className="h-4 w-4 mr-2"/>
            Connect Instagram Account
        </Button>
    );
}