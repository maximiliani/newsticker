"use client";

import { useState, useEffect } from "react";
import { AppSettingsService } from "@/lib/services/app-settings-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Settings } from "lucide-react";
import { DEFAULT_TIMEZONE } from "@/i18n/config";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const timezones: string[] = (Intl as any).supportedValuesOf?.('timeZone') ?? [DEFAULT_TIMEZONE];

export function GeneralSettings() {
  const t = useTranslations("GeneralSettings");
  const [language, setLanguage] = useState<string>("en");
  const [timezone, setTimezone] = useState<string>(DEFAULT_TIMEZONE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadSettings() {
      try {
        const settings = await AppSettingsService.getSettings();
        setLanguage(settings.dashboard_language);
        setTimezone(settings.default_timezone);
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await AppSettingsService.updateDashboardLanguage(language);
      await AppSettingsService.updateDefaultTimezone(timezone);
      toast.success(t("saveSuccess"));
      router.refresh();
    } catch (error) {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t("cardTitle")}
        </CardTitle>
        <CardDescription>
          {t("cardDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="dashboard_language">{t("languageLabel")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("languageDescription")}
          </p>
          <div className="flex items-center gap-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="dashboard_language" className="w-[180px]">
                <SelectValue placeholder={t("selectLanguage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="default_timezone">{t("timezoneLabel")}</Label>
          <p className="text-sm text-muted-foreground">
            {t("timezoneDescription")}
          </p>
          <div className="flex items-center gap-4">
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="default_timezone" className="w-[280px]">
                <SelectValue placeholder={t("selectTimezone")} />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t("save")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
