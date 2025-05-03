import {NextRequest, NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";

const clientId = process.env.INSTAGRAM_CLIENT_ID!;
const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET!;
const redirectUri = process.env.INSTAGRAM_REDIRECT_URI!;

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

        // Upsert credentials into Supabase
        const {error: supabaseError} = await supabase
            .from("instagram_accounts")
            .upsert(
                {
                    user_id: userId.toString(),
                    username,
                    profile_image_url: profileImageUrl,
                    access_token: accessToken,
                },
                {onConflict: "user_id"}
            );

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

