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

interface TokenResponse {
    access_token: string;
    user_id: string;
}

interface ProfileResponse {
    id: string;
    username: string;
}

interface LongLivedTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
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
            signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!tokenResponse.ok) {
            const text = await tokenResponse.text();
            return NextResponse.json({
                error: "Failed to fetch access token", 
                status: tokenResponse.status,
                details: text
            }, {status: 500});
        }

        const tokenData = await tokenResponse.json() as TokenResponse;
        if (!tokenData.access_token || !tokenData.user_id) {
            return NextResponse.json({error: "Invalid token response format"}, {status: 500});
        }

        // Exchange for long-lived token first before getting profile
        // as per Instagram's best practices
        const longLivedTokenResponse = await fetch(
            `https://graph.instagram.com/access_token?${new URLSearchParams({
                grant_type: 'ig_exchange_token',
                client_secret: clientSecret,
                access_token: tokenData.access_token
            })}`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(10000)
            }
        );

        if (!longLivedTokenResponse.ok) {
            const text = await longLivedTokenResponse.text();
            return NextResponse.json({
                error: "Failed to get long-lived token",
                status: longLivedTokenResponse.status,
                details: text
            }, {status: 500});
        }

        const longLivedTokenData = await longLivedTokenResponse.json() as LongLivedTokenResponse;
        
        if (!isValidAccessToken(longLivedTokenData.access_token)) {
            return NextResponse.json({
                error: "Invalid access token format"
            }, {status: 400});
        }

        // Fetch user profile info using the long-lived token
        const profileResponse = await fetch(
            `https://graph.instagram.com/me?${new URLSearchParams({
                fields: 'id,username',
                access_token: longLivedTokenData.access_token
            })}`,
            {
                method: 'GET',
                signal: AbortSignal.timeout(10000)
            }
        );

        if (!profileResponse.ok) {
            const text = await profileResponse.text();
            return NextResponse.json({
                error: "Failed to fetch user profile",
                status: profileResponse.status,
                details: text
            }, {status: 500});
        }

        const profileData = await profileResponse.json() as ProfileResponse;

        // Store in database with the long-lived token
        const { error: supabaseError } = await supabase
            .rpc('insert_instagram_account', {
                p_id: profileData.id,
                p_user_id: (await supabase.auth.getUser()).data.user?.id,
                p_username: profileData.username,
                p_profile_image_url: null, // Instagram Basic Display API doesn't provide this
                p_access_token: longLivedTokenData.access_token,
                p_timestamp: Date.now()
            });

        if (supabaseError) {
            return NextResponse.json({
                error: "Database operation failed",
                details: supabaseError.message
            }, {status: 500});
        }

        return NextResponse.redirect(new URL("/instagram-success", request.url));
    } catch (err) {
        console.error('Instagram integration error:', err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({error: "Unexpected server error"}, {status: 500});
    } finally {
        // Clean up Supabase client
        await supabase.auth.signOut();
    }
}