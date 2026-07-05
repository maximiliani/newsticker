'use client';

import { useState, useRef } from "react";
import { Plus, Loader2, Check, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DiscoveredCalendar, CalendarSubscription } from "@/types/calendar";

interface Props {
  subscription?: CalendarSubscription;
  onSubscriptionAdded?: () => void;
  onSubscriptionUpdated?: () => void;
  trigger?: React.ReactNode;
  existingColors?: string[];
}

export function SubscriptionDialog({ subscription, onSubscriptionAdded, onSubscriptionUpdated, trigger, existingColors = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<'public' | 'caldav'>(subscription?.auth_type === 'public' ? 'public' : 'caldav');
  const [isLoading, setIsLoading] = useState(false);
  
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1',
    '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4'
  ];

  const getInitialColor = () => {
    if (subscription?.color) return subscription.color;
    for (const c of colors) {
      if (!existingColors.includes(c)) return c;
    }
    return colors[0];
  };

  const [formData, setFormData] = useState({
    name: subscription?.name || '',
    ical_url: subscription?.ical_url || '',
    serverUrl: subscription?.caldav_server_url || '',
    authType: (subscription?.auth_type === 'public' ? 'basic' : subscription?.auth_type) || 'basic',
    username: '',
    secret: '',
    color: getInitialColor(),
    visibility_days_before: subscription?.visibility_days_before ?? 14,
    visibility_days_after: subscription?.visibility_days_after ?? 14
  });

  const [discoveredCalendars, setDiscoveredCalendars] = useState<DiscoveredCalendar[]>([]);
  const [selectedCalendarUrl, setSelectedCalendarUrl] = useState('');
  const [colorError, setColorError] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setType(subscription?.auth_type === 'public' ? 'public' : 'caldav');
    setFormData({
      name: subscription?.name || '',
      ical_url: subscription?.ical_url || '',
      serverUrl: subscription?.caldav_server_url || '',
      authType: (subscription?.auth_type === 'public' ? 'basic' : subscription?.auth_type) || 'basic',
      username: '',
      secret: '',
      color: getInitialColor(),
      visibility_days_before: subscription?.visibility_days_before ?? 14,
      visibility_days_after: subscription?.visibility_days_after ?? 14
    });
    setDiscoveredCalendars([]);
    setSelectedCalendarUrl('');
  };

  const handleDiscover = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/features/calendar/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverUrl: formData.serverUrl,
          authType: formData.authType,
          username: formData.username,
          secret: formData.secret
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDiscoveredCalendars(data);
      setStep(2);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate color uniqueness client-side
      if (existingColors.includes(formData.color) && formData.color !== subscription?.color) {
        setColorError("This color is already used by another calendar. Please choose a unique color.");
        return;
      }
      setColorError(null);

      setIsLoading(true);
      const isEditing = !!subscription;
      const url = isEditing 
        ? `/api/features/calendar/subscriptions/${subscription.id}` 
        : '/api/features/calendar/subscriptions';
      
      const method = isEditing ? 'PATCH' : 'POST';

      const payload = {
        ...formData,
        auth_type: type === 'public' ? 'public' : formData.authType,
        caldav_calendar_url: selectedCalendarUrl || subscription?.caldav_calendar_url,
        caldav_server_url: formData.serverUrl
      };
      
      // If editing and credentials are empty, don't send them
      if (isEditing) {
        if (!payload.secret) delete (payload as any).secret;
        if (!payload.username) delete (payload as any).username;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      if (isEditing) {
        onSubscriptionUpdated?.();
      } else {
        onSubscriptionAdded?.();
      }
      setOpen(false);
      if (!isEditing) reset();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const setProvider = (name: 'icloud' | 'outlook') => {
    if (name === 'icloud') {
      setFormData({ ...formData, serverUrl: 'https://caldav.icloud.com/', authType: 'basic' });
    } else if (name === 'outlook') {
      setFormData({ ...formData, serverUrl: 'https://outlook.office365.com/dav/', authType: 'basic' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val && !subscription) reset(); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Subscription
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{subscription ? 'Edit' : 'Add'} Calendar Subscription</DialogTitle>
          <DialogDescription>
            {subscription 
              ? `Update settings for ${subscription.name}.`
              : step === 1 ? "Connect to a public iCal URL or a CalDAV server." : "Select the calendar you want to subscribe to."
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Subscription Name</Label>
              <Input 
                id="name" 
                placeholder="Work Calendar" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <Tabs defaultValue="public" value={type} onValueChange={(v) => setType(v as 'public' | 'caldav')}>
              <TabsList>
                <TabsTrigger value="public">Public iCal</TabsTrigger>
                <TabsTrigger value="caldav">CalDAV</TabsTrigger>
              </TabsList>
              
              <TabsContent value="public" className="grid gap-4 pt-4">
                <div className="grid gap-2">
                  <Label htmlFor="url">Public iCal URL</Label>
                  <Input 
                    id="url" 
                    placeholder="https://example.com/calendar.ics" 
                    value={formData.ical_url}
                    onChange={e => setFormData({ ...formData, ical_url: e.target.value })}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="caldav" className="grid gap-4 pt-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setProvider('icloud')}>iCloud</Button>
                  <Button variant="outline" size="sm" onClick={() => setProvider('outlook')}>Outlook</Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="server">Server URL</Label>
                  <Input 
                    id="server" 
                    placeholder="https://caldav.example.com" 
                    value={formData.serverUrl}
                    onChange={e => setFormData({ ...formData, serverUrl: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-2">
                    <Label htmlFor="user">Username</Label>
                    <Input 
                      id="user" 
                      placeholder="user@example.com" 
                      value={formData.username}
                      onChange={e => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="secret">Password / Token</Label>
                    <Input 
                      id="secret" 
                      type="password"
                      value={formData.secret}
                      onChange={e => setFormData({ ...formData, secret: e.target.value })}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="before">Visible Days Before</Label>
                <Input 
                  id="before" 
                  type="number" 
                  value={formData.visibility_days_before}
                  onChange={e => setFormData({ ...formData, visibility_days_before: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="after">Visible Days After</Label>
                <Input 
                  id="after" 
                  type="number" 
                  value={formData.visibility_days_after}
                  onChange={e => setFormData({ ...formData, visibility_days_after: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Subscription Color</Label>
              <div className="flex flex-wrap gap-2 items-center">
                {colors.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full transition-transform ${
                      formData.color === c 
                        ? 'border-4 border-white ring-2 ring-primary scale-110 shadow-sm' 
                        : 'border-2 border-transparent hover:scale-105'
                    } ${existingColors.includes(c) && c !== subscription?.color ? 'opacity-30 cursor-not-allowed' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setFormData({ ...formData, color: c })}
                    disabled={existingColors.includes(c) && c !== subscription?.color}
                    title={existingColors.includes(c) && c !== subscription?.color ? 'Color already in use' : ''}
                  />
                ))}
                <div className="relative">
                  <button
                    type="button"
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
                      !colors.includes(formData.color)
                        ? 'border-4 border-white ring-2 ring-primary scale-110 shadow-sm' 
                        : 'border-2 border-dashed border-muted-foreground/30 hover:scale-105 hover:border-muted-foreground/50'
                    }`}
                    style={!colors.includes(formData.color) ? { backgroundColor: formData.color } : {}}
                    onClick={() => colorInputRef.current?.click()}
                    title="Custom color"
                  >
                    <Pipette className={`h-4 w-4 ${!colors.includes(formData.color) ? 'text-white' : 'text-muted-foreground'}`} />
                  </button>
                  <Input 
                    ref={colorInputRef}
                    id="custom-color-picker"
                    type="color" 
                    className="sr-only"
                    value={formData.color}
                    onChange={e => {
                      setFormData({ ...formData, color: e.target.value });
                      setColorError(null);
                    }}
                  />
                </div>
              </div>
              {colorError && <p className="text-xs text-destructive mt-1">{colorError}</p>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid gap-4 py-4 max-h-[300px] overflow-y-auto">
            {discoveredCalendars.map(cal => (
              <div 
                key={cal.url} 
                className={`p-3 border rounded-lg cursor-pointer flex items-center justify-between ${selectedCalendarUrl === cal.url ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                onClick={() => {
                  setSelectedCalendarUrl(cal.url);
                  setFormData({ ...formData, name: formData.name || cal.name });
                }}
              >
                <span>{cal.name}</span>
                {selectedCalendarUrl === cal.url && <Check className="h-4 w-4 text-primary" />}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          {type === 'public' ? (
            <Button onClick={handleSubmit} disabled={isLoading || !formData.ical_url}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {subscription ? 'Save Changes' : 'Add Subscription'}
            </Button>
          ) : step === 1 ? (
            <div className="flex gap-2 w-full">
              {subscription && (
                <Button variant="ghost" className="flex-1" onClick={handleSubmit} disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Save Settings
                </Button>
              )}
              <Button onClick={handleDiscover} disabled={isLoading || !formData.serverUrl || (!subscription && !formData.secret)} className={subscription ? 'flex-[2]' : 'w-full'}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {subscription ? 'Change Calendar' : 'Discover Calendars'}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 w-full">
              <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-[2]" onClick={handleSubmit} disabled={isLoading || !selectedCalendarUrl}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {subscription ? 'Save & Switch' : 'Subscribe'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
