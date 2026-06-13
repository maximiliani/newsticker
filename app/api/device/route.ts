import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { fetchHostAgent } from "@/lib/host-agent";

export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await requireAuth();
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query") || "hostname";
    
    let path = "/hostname";
    if (query === "ip") path = "/ip";
    else if (query === "info") path = "/system-info";

    const res = await fetchHostAgent(path);
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

export async function PUT(req: NextRequest) {
  try {
    const { isAdmin } = await requireAuth();
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const res = await fetchHostAgent("/hostname", {
      method: "PUT",
      body: JSON.stringify(body),
    });

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
