"use client";

import React from "react";

const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID!;
const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI!;

const getInstagramOAuthUrl = () => {
    const authUrl = new URL("https://www.instagram.com/oauth/authorize?enable_fb_login=0&force_authentication=1&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights");
    // const scope = ["user_profile", "user_media"].join(",");
    // const authUrl = new URL("https://api.instagram.com/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    // authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("redirect_uri", "https://newsticker.vercel.app/api/instagram/callback");
    // authUrl.searchParams.set("scope", scope);
    // authUrl.searchParams.set("response_type", "code");
    // authUrl.searchParams.set("state", "instagram_auth"); // add CSRF protection if needed
    return authUrl.toString();
};

export default function InstagramLogin() {
    const handleLogin = () => {
        window.location.href = getInstagramOAuthUrl();
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen">
            <button
                onClick={handleLogin}
                className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
                Login with Instagram
            </button>
        </div>
    );
}

