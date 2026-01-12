import {NextRequest, NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import crypto from "crypto";

const clientId = process.env.INSTAGRAM_CLIENT_ID!;
const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET!;

function isValidAccessToken(token: string): boolean {
    // Check if token is a non-empty string
    if (!token) return false;

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
                redirect_uri: request.nextUrl.origin + "/api/features/instagram/callback",
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
        console.log('Fetched Instagram profile data:', profileData);

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

        // Ensure vault secrets are up to date for cron jobs
        const internalSecret = process.env.INTERNAL_ADMIN_SECRET;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

        if (internalSecret) {
            try {
                // Store/update the internal admin secret in Vault
                const {error: secretError} = await supabase.rpc('upsert_vault_secret', {
                    p_name: 'CRON_INTERNAL_ADMIN_SECRET',
                    p_secret: internalSecret
                });

                if (secretError) {
                    console.warn('Failed to update CRON_INTERNAL_ADMIN_SECRET in Vault:', secretError.message);
                }

                // Store/update the app URL in Vault
                const {error: urlError} = await supabase.rpc('upsert_vault_secret', {
                    p_name: 'CRON_APP_URL',
                    p_secret: appUrl
                });

                if (urlError) {
                    console.warn('Failed to update CRON_APP_URL in Vault:', urlError.message);
                } else {
                    console.info('Vault secrets synchronized successfully');
                }
            } catch (e: any) {
                console.warn('Failed to update Vault secrets:', e?.message || String(e));
            }
        } else {
            console.warn('INTERNAL_ADMIN_SECRET not set - cron jobs may fail authentication');
        }

        // Trigger Next.js refresh route (now responsible for cloning media into Storage)
        try {
            const res = await fetch(`${new URL(request.url).origin}/api/features/instagram/refresh`, { method: 'POST', credentials: "include"});
            if (!res.ok) {
                const txt = await res.text();
                console.error('Error refreshing feeds via API route:', txt);
            } else {
                const json = await res.json();
                console.info('Feeds refreshed successfully via API route:', json);
            }
        } catch (e: any) {
            console.error('Error calling refresh API route:', e?.message || String(e));
        }

        // Redirect to success page without exposing any tokens or sensitive data
        const successUrl = new URL("/instagram-success", request.url);
        return NextResponse.redirect(successUrl);

    } catch (err: any) {
        console.error('Instagram integration error:', err instanceof Error ? err.message : 'Unknown error');
        return NextResponse.json({error: "Unexpected server error", details: err.message}, {status: 500});
    }
}


export async function POST(request: NextRequest) {
    const supabase = await createClient();

    try {
        const formData = await request.formData();
        const signedRequest = formData.get('signed_request') as string | null;

        if (!signedRequest) {
            console.log("Data deletion callback: Missing signed_request");
            return NextResponse.json({ error: "Missing signed_request" }, { status: 400 });
        }

        const parts = signedRequest.split('.');
        if (parts.length !== 2) {
            console.log("Data deletion callback: Invalid signed_request format");
            return NextResponse.json({ error: "Invalid signed_request format" }, { status: 400 });
        }

        const [encodedSig, encodedPayload] = parts;

        // Verify the signature
        // The signature is a HMAC SHA256 hash of the encoded_payload, using your app's client_secret.
        // The encoded_payload is the raw base64url encoded string.
        const calculatedSignatureBuffer = crypto
            .createHmac('sha256', clientSecret)
            .update(encodedPayload) // Use the raw base64url encoded payload for HMAC
            .digest();

        // Decode Instagram's provided signature from base64url to a buffer for comparison
        const instagramSignatureBuffer = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

        // Use timingSafeEqual to prevent timing attacks
        if (!crypto.timingSafeEqual(instagramSignatureBuffer, calculatedSignatureBuffer)) {
            console.warn("Data deletion callback: Invalid signature.");
            return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
        }

        // Decode the payload if the signature is valid
        const base64UrlDecode = (str: string): string => {
            let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
            // Padding is not strictly necessary for Buffer.from with base64 encoding
            // if the input is a correct base64url string.
            return Buffer.from(base64, 'base64').toString('utf8');
        };

        const payloadString = base64UrlDecode(encodedPayload);
        const payloadData = JSON.parse(payloadString);

        const instagramUserId = payloadData.user_id;

        if (!instagramUserId) {
            console.log("Data deletion callback: Missing user_id in payload");
            return NextResponse.json({ error: "Missing user_id in payload" }, { status: 400 });
        }

        console.log(`Data deletion request received for Instagram user ID: ${instagramUserId}`);

        // --- Perform data deletion in your database ---
        // IMPORTANT: You will need to create a Supabase RPC function (e.g., 'delete_instagram_account_data').
        // This function should accept the Instagram user ID and handle the deletion of all
        // associated data for that user in your database.
        // The `insert_instagram_account` RPC uses `p_id` for the Instagram profile ID (`profileData.id`),
        // so it's recommended to use `p_id` consistently for the Instagram User ID in your delete RPC.

        const { error: deleteError } = await supabase.rpc('delete_instagram_account_data', {
            p_id: instagramUserId // Assuming 'p_id' is the parameter for the Instagram user ID in your RPC
        });

        if (deleteError) {
            console.error(`Data deletion callback: Failed to delete data for Instagram user ID ${instagramUserId}:`, deleteError.message);
            // Avoid exposing detailed database error messages to Instagram
            return NextResponse.json({ error: "Failed to process data deletion request" }, { status: 500 });
        }

        // --- Respond to Instagram ---
        // Instagram expects a JSON response containing a URL where the user can track the deletion
        // status and a confirmation_code.
        const confirmationCode = crypto.randomBytes(16).toString('hex'); // Generate a unique code

        // Construct the status URL. This URL should lead to a page on your site.
        // For example, it could be a generic data deletion status page or your privacy policy.
        const statusUrl = `${new URL(request.url).origin}/instagram-data-deletion-status?code=${confirmationCode}`;

        console.log(`Data for Instagram user ID: ${instagramUserId} has been processed for deletion. Confirmation code: ${confirmationCode}`);

        return NextResponse.json({
            url: statusUrl,
            confirmation_code: confirmationCode
        });

    } catch (error: any) {
        console.error('Instagram data deletion callback error:', error.message, error.stack);
        // Return a generic error message to the client
        return NextResponse.json({ error: "Unexpected server error during data deletion" }, { status: 500 });
    }
}
