import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { discoverCalendars } from "@/features/calendar/services/caldav-client";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { serverUrl, authType, username, secret } = await req.json();

    if (!serverUrl || !authType || !secret) {
      return NextResponse.json({ error: "Missing required fields: serverUrl, authType, secret" }, { status: 400 });
    }

<<<<<<< ours
=======
    if (authType !== 'basic' && authType !== 'bearer') {
      return NextResponse.json({ error: "Invalid authType. Must be 'basic' or 'bearer'" }, { status: 400 });
    }

    try {
      const url = new URL(serverUrl);
      if (url.protocol !== 'https:') {
        return NextResponse.json({ error: "Server URL must be a valid HTTPS URL" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid Server URL" }, { status: 400 });
    }

>>>>>>> theirs
    const calendars = await discoverCalendars(serverUrl, authType, { username, secret });
    return NextResponse.json(calendars);
  } catch (e: any) {
    console.error('Discover calendars error:', e);
    return NextResponse.json({ error: e.message || "Failed to discover calendars" }, { status: 500 });
  }
}
