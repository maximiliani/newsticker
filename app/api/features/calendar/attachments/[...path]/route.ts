import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Proxy route for calendar attachments.
 * Ensures that only the owner of the attachment can download it.
 */
export async function GET(
  _req: NextRequest, 
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { userId } = await requireAuth();
    const { path: pathSegments } = await context.params;
    const filePath = pathSegments.join('/');
    
    // Authorization check: The first segment of the path is the userId
    if (pathSegments[0] !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from('calendar-attachments')
      .download(filePath);
      
    if (error) {
      console.error('Failed to download attachment:', error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    
    return new Response(data, {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (e: any) {
    const status = e.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
