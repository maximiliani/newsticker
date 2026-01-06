import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseServerClient } from "@supabase/supabase-js";
import { ALLOWED_CONTENT_TYPES, MAX_FILE_SIZE, streamDownloadToBuffer } from "@/lib/storage/stream";
import { allowInternalOrAdmin } from "@/lib/api/auth";

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

export async function POST(request: NextRequest) {
  try {
    // Authorization: shared secret or authenticated admin
    const { isAdmin } = await allowInternalOrAdmin(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
    }

    const { url, storageBucket, storagePath } = await request.json();
    if (!url || !storageBucket || !storagePath) {
      return NextResponse.json({ error: "Missing required fields: url, storageBucket, storagePath" }, { status: 400 });
    }

    // Validate URL
    try { new URL(url); } catch { return NextResponse.json({ error: "Invalid URL provided" }, { status: 400 }); }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let attempt = 0;
    let lastErr: unknown = null;

    while (attempt < MAX_RETRIES) {
      try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) {
          throw new Error(`Failed to download media: ${url}, status: ${res.status}`);
        }

        const ct = res.headers.get("content-type") || "application/octet-stream";
        if (!ALLOWED_CONTENT_TYPES.has(ct)) {
          return NextResponse.json({ error: `Unsupported content type: ${ct}` }, { status: 415 });
        }

        const lengthHeader = res.headers.get("content-length");
        if (lengthHeader) {
          const contentLength = parseInt(lengthHeader, 10);
          if (!Number.isNaN(contentLength) && contentLength > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `File too large: ${contentLength} bytes` }, { status: 413 });
          }
        }

        // Stream into memory with size enforcement
        const { buffer, size } = await streamDownloadToBuffer(res);

        // Upload to Supabase Storage with service role
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!supabaseUrl || !serviceKey) {
          return NextResponse.json({ error: "Supabase service credentials not configured" }, { status: 500 });
        }

        const supabaseAdmin = createSupabaseServerClient(supabaseUrl, serviceKey);
        const { error: uploadError } = await supabaseAdmin
          .storage
          .from(storageBucket)
          .upload(storagePath, buffer, { upsert: true, contentType: ct });

        if (uploadError) {
          return NextResponse.json({ error: `Failed to upload media to storage: ${uploadError.message}` }, { status: 500 });
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from(storageBucket)
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData?.publicUrl;
        try { if (!publicUrl) throw new Error("No public URL returned"); new URL(publicUrl); } 
        catch { return NextResponse.json({ error: "Failed to get valid public URL for uploaded media" }, { status: 500 }); }

        return NextResponse.json({ publicUrl, contentType: ct, size }, { status: 200 });
      } catch (err: any) {
        lastErr = err;
        attempt += 1;
        // AbortError indicates timeout
        const isAbort = err?.name === "AbortError";
        if (attempt >= MAX_RETRIES || (!isAbort && /Invalid URL|Unsupported content type|File too large/.test(String(err?.message || "")))) {
          break;
        }
        // small backoff
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    const msg = lastErr instanceof Error ? lastErr.message : "Unknown error";
    const status = /timeout/i.test(msg) ? 504 : 500;
    return NextResponse.json({ error: msg }, { status });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}
