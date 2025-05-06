import {NextRequest, NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const clientId = process.env.INSTAGRAM_CLIENT_ID!;
const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET!;
const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;

function isValidAccessToken(token: string): boolean {
    // Check if token is a non-empty string
    if (!token || typeof token !== 'string') return false;
    
    // Check if token contains only valid characters
    if (!/^[A-Za-z0-9._-]+$/.test(token)) return false;
    
    // Check minimum length (typical Instagram tokens are quite long)
    if (token.length < 50) return false;
    
    return true;
}

export async function GET(request: NextRequest) {
    const supabase = await createClient();

    try {
        const {searchParams} = new URL(request.url);
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");
        if (error) {
            return NextResponse.json({error, errorDescription}, {status: 400});
        }

        const code = searchParams.get("code");
        if (!code) {
            return NextResponse.json({error: "Missing code parameter"}, {status: 400});
        }

        // Exchange code for access token
        const tokenResponse = await fetch(`https://api.instagram.com/oauth/access_token`, {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
                code,
            }),
        });
        if (!tokenResponse.ok) {
            const text = await tokenResponse.text();
            return NextResponse.json({error: "Failed to fetch access token", details: text}, {status: 500});
        }
        const tokenData = await tokenResponse.json();

        const accessToken = tokenData.access_token;
        const userId = tokenData.user_id;

        if (!accessToken || !userId) {
            return NextResponse.json({error: "Invalid token response"}, {status: 500});
        }

        // Before using the token, ensure it's not URL-encoded
        const decodedToken = decodeURIComponent(accessToken);

        // Fetch user profile info
        const profileResponse = await fetch(
            `https://graph.instagram.com/${userId}?fields=id,username,profile_picture_url&access_token=${accessToken}`
        );
        if (!profileResponse.ok) {
            const text = await profileResponse.text();
            return NextResponse.json({error: "Failed to fetch user profile", details: text}, {status: 500});
        }
        const profileData = await profileResponse.json();

        const username = profileData.username;
        const profileImageUrl = profileData.profile_picture_url ?? null;

        // After getting the initial access token, exchange it for a long-lived token
        const longLivedTokenResponse = await fetch(
            `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${clientSecret}&access_token=${accessToken}`
        );
        if (!longLivedTokenResponse.ok) {
            const text = await longLivedTokenResponse.text();
            return NextResponse.json({error: "Failed to get long-lived token", details: text}, {status: 500});
        }
        const longLivedTokenData = await longLivedTokenResponse.json();
        const longLivedAccessToken = longLivedTokenData.access_token;

        // Use it before saving
        if (!isValidAccessToken(longLivedAccessToken)) {
            return NextResponse.json({
                error: "Invalid access token format",
                details: "The token format is not valid"
            }, {status: 400});
        }

        // Use longLivedAccessToken instead of accessToken when saving to database
        // Replace the direct upsert with a call to the insert_instagram_account function
        const { data, error: supabaseError } = await supabase
            .rpc('insert_instagram_account', {
                p_id: userId,
                p_user_id: (await supabase.auth.getUser()).data.user?.id,
                p_username: username,
                p_profile_image_url: profileImageUrl,
                p_access_token: longLivedAccessToken, // Use the long-lived token here
                p_timestamp: Date.now()
            });

        if (supabaseError) {
            return NextResponse.json({
                error: "Failed to save Instagram credentials",
                details: supabaseError.message
            }, {status: 500});
        }

        // Redirect after success
        return NextResponse.redirect(new URL("/instagram-success", request.url));
    } catch (err) {
        console.error(err);
        return NextResponse.json({error: "Unexpected server error"}, {status: 500});
    }
}