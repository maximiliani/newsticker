import {cookies} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {COOKIE_NAME, DEFAULT_LOCALE, isSupportedLocale} from './config';

export {COOKIE_NAME, DEFAULT_LOCALE};

/**
 * Resolution order: explicit footer choice (cookie), logged-in user's profile
 * language, system-wide default language, built-in default.
 */
export async function getUserLocale(): Promise<string> {
  const cookieLocale = (await cookies()).get(COOKIE_NAME)?.value;
  if (isSupportedLocale(cookieLocale)) return cookieLocale;

  const supabase = await createClient();

  const {data: {user}} = await supabase.auth.getUser();
  if (isSupportedLocale(user?.user_metadata?.language)) {
    return user!.user_metadata.language;
  }

  const {data: settings} = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'dashboard_language')
    .maybeSingle();

  if (isSupportedLocale(settings?.value)) return settings!.value;

  return DEFAULT_LOCALE;
}
