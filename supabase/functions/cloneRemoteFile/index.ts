/// <reference lib="deno.ns" />
// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient, SupabaseClient} from "jsr:@supabase/supabase-js@2";

const ALLOWED_CONTENT_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "video/mp4",
    "video/quicktime",
];

export interface DownloadAndUploadResult {
    publicUrl: string;
    contentType: string;
    size: number;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_RETRIES = 3;
const TIMEOUT = 30000; // 30 seconds

async function downloadAndUploadMedia(
    supabase: SupabaseClient,
    url: string,
    storageBucket: string,
    storagePath: string,
): Promise<DownloadAndUploadResult> {
    // Validate URL
    try {
        new URL(url);
    } catch {
        throw new Error("Invalid URL provided");
    }

    let attempt = 0;
    while (attempt < MAX_RETRIES) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT);

        try {
            // Download with streaming
            const response = await fetch(url, {
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                throw new Error(
                    `Failed to download media: ${url}, status: ${response.status}`,
                );
            }

            // Validate content type
            const contentType = response.headers.get("content-type") ||
                "application/octet-stream";
            if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
                throw new Error(`Unsupported content type: ${contentType}`);
            }

            // Validate file size
            const contentLength = parseInt(
                response.headers.get("content-length") || "0",
                10,
            );
            if (contentLength > MAX_FILE_SIZE) {
                throw new Error(`File too large: ${contentLength} bytes`);
            }

            // Stream the download to memory in chunks
            const chunks: Uint8Array[] = [];
            let size = 0;
            const reader = response.body?.getReader();

            if (!reader) {
                throw new Error("Failed to initialize stream reader");
            }

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                size += value.length;

                if (size > MAX_FILE_SIZE) {
                    reader.cancel();
                    throw new Error(`File too large: ${size} bytes`);
                }
            }

            // Combine chunks
            const buffer = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
            }

            // Upload to Supabase
            const { error: uploadError, data: uploadData } = await supabase
                .storage
                .from(storageBucket)
                .upload(storagePath, buffer, {
                    upsert: true,
                    contentType,
                });

            if (uploadError) {
                throw new Error(
                    `Failed to upload media to storage: ${uploadError.message}`,
                );
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from(storageBucket)
                .getPublicUrl(storagePath);

            if (!urlData?.publicUrl) {
                throw new Error("Failed to get public URL for uploaded media");
            }

            // Validate generated URL
            try {
                new URL(urlData.publicUrl);
            } catch {
                throw new Error("Generated invalid public URL");
            }

            return {
                publicUrl: urlData.publicUrl,
                contentType,
                size,
            };
        } catch (error) {
            clearTimeout(timeout);

            if (error instanceof Error) {
                // Don't retry on validation errors
                if (
                    error.message.includes("Invalid URL") ||
                    error.message.includes("Unsupported content type") ||
                    error.message.includes("File too large")
                ) {
                    throw error;
                }

                if (error.name === "AbortError") {
                    error.message = `Download timeout for media: ${url}`;
                }
            }

            attempt++;
            if (attempt === MAX_RETRIES) {
                throw error;
            }

            // Exponential backoff before retry
            await new Promise((resolve) =>
                setTimeout(resolve, Math.pow(2, attempt) * 1000)
            );
        }
    }

    throw new Error("Maximum retry attempts reached");
}

Deno.serve(async (req) => {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const { url, storageBucket, storagePath } = await req.json();
    if (!url || !storageBucket || !storagePath) {
        return new Response(
            JSON.stringify({ error: "Missing required fields" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }
    try {
        const result = await downloadAndUploadMedia(
            supabase,
            url,
            storageBucket,
            storagePath,
        );
        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            'An unknown error occurred',
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
});
