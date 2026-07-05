import {createClient} from '@/lib/supabase/server';

export const COOKIE_NAME = 'NEXT_LOCALE';
export const DEFAULT_LOCALE = 'en';

export async function getUserLocale() {
  const supabase = await createClient();
  
  // 1. Check if user is authenticated and has a language preference
  const {data: {user}} = await supabase.auth.getUser();
  if (user?.user_metadata?.language) {
    return user.user_metadata.language;
  }
  
  // 2. If not, check the global dashboard setting
  const {data: settings} = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'dashboard_language')
    .single();
    
  if (settings?.value) {
    return settings.value;
  }
  
  return DEFAULT_LOCALE;
}
