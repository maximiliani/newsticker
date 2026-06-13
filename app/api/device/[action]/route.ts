import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { fetchHostAgent } from "@/lib/host-agent";

const ALLOWED_ACTIONS = ["reboot", "shutdown"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { isAdmin } = await requireAuth();
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { action } = await params;
    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const res = await fetchHostAgent(`/${action}`, { method: "POST" });
    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Host agent error: ${errorText}` }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (e: any) {
    const status = e.message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
