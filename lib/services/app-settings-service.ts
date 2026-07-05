import { createClient } from '@/lib/supabase/client';

export interface AppSettings {
  dashboard_language: string;
}

export class AppSettingsService {
  static async getSettings(): Promise<AppSettings> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value');

    if (error) {
      console.error('Error fetching app settings:', error);
      return { dashboard_language: 'en' };
    }

    const settings: any = {};
    data.forEach((item) => {
      settings[item.key] = item.value;
    });

    return {
      dashboard_language: settings.dashboard_language || 'en',
    };
  }

  static async updateDashboardLanguage(language: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'dashboard_language', value: language });

    if (error) {
      console.error('Error updating dashboard language:', error);
      throw new Error('Failed to update dashboard language');
    }
  }
}
