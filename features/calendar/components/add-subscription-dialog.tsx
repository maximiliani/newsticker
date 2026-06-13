'use client';

import { useState } from "react";
import { Plus, Loader2, Check } from "lucide-react";
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
import { DiscoveredCalendar } from "@/types/calendar";

interface Props {
  onSubscriptionAdded: () => void;
}

export function AddSubscriptionDialog({ onSubscriptionAdded }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [type, setType] = useState<'public' | 'caldav'>('public');
  const [isLoading, setIsLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    ical_url: '',
    serverUrl: '',
    authType: 'basic',
    username: '',
    secret: '',
    color: '#3B82F6',
    visibility_days_before: 14,
    visibility_days_after: 14
  });

  const [discoveredCalendars, setDiscoveredCalendars] = useState<DiscoveredCalendar[]>([]);
  const [selectedCalendarUrl, setSelectedCalendarUrl] = useState('');

  const reset = () => {
    setStep(1);
    setType('public');
    setFormData({
      name: '',
      ical_url: '',
      serverUrl: '',
      authType: 'basic',
      username: '',
      secret: '',
      color: '#3B82F6',
      visibility_days_before: 14,
      visibility_days_after: 14
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
      setIsLoading(true);
      const payload = {
        ...formData,
        auth_type: type === 'public' ? 'public' : formData.authType,
        caldav_calendar_url: selectedCalendarUrl,
        caldav_server_url: formData.serverUrl
      };
      
      const res = await fetch('/api/features/calendar/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      onSubscriptionAdded();
      setOpen(false);
      reset();
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
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if(!val) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Calendar Subscription</DialogTitle>
          <DialogDescription>
            {step === 1 ? "Connect to a public iCal URL or a CalDAV server." : "Select the calendar you want to subscribe to."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="grid gap-4 py-4">
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button 
                variant={type === 'public' ? 'secondary' : 'ghost'} 
                className="flex-1" 
                size="sm"
                onClick={() => setType('public')}
              >
                Public iCal
              </Button>
              <Button 
                variant={type === 'caldav' ? 'secondary' : 'ghost'} 
                className="flex-1" 
                size="sm"
                onClick={() => setType('caldav')}
              >
                CalDAV
              </Button>
            </div>

            {type === 'public' ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="url">Public iCal URL</Label>
                  <Input 
                    id="url" 
                    placeholder="https://example.com/calendar.ics" 
                    value={formData.ical_url}
                    onChange={e => setFormData({ ...formData, ical_url: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input 
                    id="name" 
                    placeholder="Work Calendar" 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="color">Color</Label>
                <Input 
                  id="color" 
                  type="color" 
                  className="h-10 p-1"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>
            
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
            <Button onClick={handleSubmit} disabled={isLoading || !formData.ical_url || !formData.name}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Subscription
            </Button>
          ) : step === 1 ? (
            <Button onClick={handleDiscover} disabled={isLoading || !formData.serverUrl || !formData.secret}>
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Discover Calendars
            </Button>
          ) : (
            <div className="flex gap-2 w-full">
              <Button variant="ghost" className="flex-1" onClick={() => setStep(1)}>Back</Button>
              <Button className="flex-[2]" onClick={handleSubmit} disabled={isLoading || !selectedCalendarUrl}>
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Subscribe
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
