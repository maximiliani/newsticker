'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_TIMEZONE, isValidTimezone } from '@/i18n/config';

let cached: string | null = null;
let pending: Promise<string> | null = null;

function load(): Promise<string> {
  pending ??= (async () => {
    const { data } = await createClient()
      .from('app_settings').select('value').eq('key', 'default_timezone').maybeSingle();
    cached = isValidTimezone(data?.value) ? data!.value : DEFAULT_TIMEZONE;
    return cached;
  })().catch(() => { pending = null; return DEFAULT_TIMEZONE; });
  return pending;
}

/** The globally configured timezone from app_settings (falls back to the default). */
export function useDefaultTimezone(): string {
  const [tz, setTz] = useState(cached ?? DEFAULT_TIMEZONE);
  useEffect(() => {
    let live = true;
    load().then((v) => live && setTz(v));
    return () => { live = false; };
  }, []);
  return tz;
}
