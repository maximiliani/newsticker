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
    profile_picture_url: string;
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
                fields: 'id,username,profile_picture_url',
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

        let profileImageUrl = null;
        if (profileData.profile_picture_url) {
            try {
                const imageResponse = await fetch(profileData.profile_picture_url);
                if (imageResponse.ok) {
                    const imageBlob = await imageResponse.blob();

                    const fileName = `instagram-${profileData.id}-${Date.now()}.jpg`;

                    const {data: uploadData, error: uploadError} = await supabase
                        .storage
                        .from('instagram-profiles')
                        .upload(fileName, imageBlob, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (!uploadError && uploadData) {
                        // Correctly get public URL: getPublicUrl only returns { data: { publicUrl: string } } on success
                        // It does not return an 'error' property in its result object.
                        const {data: publicUrlObject} = supabase
                            .storage
                            .from('instagram-profiles')
                            .getPublicUrl(fileName);

                        if (publicUrlObject && publicUrlObject.publicUrl) {
                            profileImageUrl = publicUrlObject.publicUrl;
                        } else {
                            console.error('Failed to get public URL or publicUrl string is missing/empty.', publicUrlObject || 'No public URL returned', profileData.profile_picture_url || 'No profile picture URL provided by IG', fileName || 'No file name provided');
                        }
                    } else if (uploadError) {
                        console.error('Supabase storage upload error:', uploadError.message);
                    }
                } else {
                    console.error('Failed to fetch profile image from URL, status:', imageResponse.status);
                }
            } catch (error: any) {
                console.error('Failed to process profile image:', error.message);
            }
        }

        // Store in database with the profile image URL
        const {error: supabaseError} = await supabase
            .rpc('insert_instagram_account', {
                p_id: profileData.id,
                p_user_id: (await supabase.auth.getUser()).data.user?.id,
                p_username: profileData.username,
                p_profile_image_url: profileImageUrl,
                p_access_token: longLivedTokenData.access_token,
                p_timestamp: Date.now()
            });

        if (supabaseError) {
            return NextResponse.json({
                error: "Database operation failed",
                details: supabaseError.message
            }, {status: 500});
        }

        // Refresh feeds by invoking the Supabase function
        const {data: fetchData, error: fetchError} = await supabase
            .functions
            .invoke('fetchInstagramPostsAndStore')
        if (fetchError) {
            console.error("Error refreshing feeds:", fetchError.message);
        } else {
            console.info("Feeds refreshed successfully:", fetchData);
        }

        // Modify the redirect to include the tokens and user ID
        const successUrl = new URL("/instagram-success", request.url);
        successUrl.searchParams.set("token", longLivedTokenData.access_token);
        successUrl.searchParams.set("userId", profileData.id);
        return NextResponse.redirect(successUrl);

    } catch (err: any) {
        console.error('Instagram integration error:', err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({error: "Unexpected server error", details: err.message}, {status: 500});
    }
}