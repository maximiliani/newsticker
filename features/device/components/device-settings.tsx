"use client";

import { useEffect, useState } from "react";
import { deviceService, SystemInfo } from "../services/device-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw, Power, RotateCw, Monitor } from "lucide-react";

export function DeviceSettings() {
  const [hostname, setHostname] = useState("");
  const [newHostname, setNewHostname] = useState("");
  const [ips, setIps] = useState<string[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [anthiasUrl, setAnthiasUrl] = useState("http://localhost:9000");

  const fetchData = async () => {
    if (typeof window !== "undefined") {
      setAnthiasUrl(`http://${window.location.hostname}:9000`);
    }
    setLoading(true);
    try {
      const [h, i, s] = await Promise.all([
        deviceService.getHostname(),
        deviceService.getIpAddresses(),
        deviceService.getSystemInfo(),
      ]);
      setHostname(h);
      setNewHostname(h);
      setIps(i);
      setSystemInfo(s);
    } catch (error: any) {
      toast.error("Failed to fetch device data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateHostname = async () => {
    if (!newHostname || newHostname === hostname) return;
    setUpdating(true);
    try {
      await deviceService.setHostname(newHostname);
      setHostname(newHostname);
      toast.success("Hostname updated successfully");
    } catch (error: any) {
      toast.error("Failed to update hostname: " + error.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleReboot = async () => {
    try {
      await deviceService.reboot();
      toast.success("Reboot command sent");
    } catch (error: any) {
      toast.error("Failed to reboot: " + error.message);
    }
  };

  const handleShutdown = async () => {
    try {
      await deviceService.shutdown();
      toast.success("Shutdown command sent");
    } catch (error: any) {
      toast.error("Failed to shutdown: " + error.message);
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
    <div className="grid gap-6 md:grid-cols-2">
      {/* Hostname Card */}
      <Card>
        <CardHeader>
          <CardTitle>System Identity</CardTitle>
          <CardDescription>View and change the device hostname</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={newHostname} 
              onChange={(e) => setNewHostname(e.target.value)}
              placeholder="Enter new hostname"
            />
            <Button onClick={handleUpdateHostname} disabled={updating || newHostname === hostname}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Current hostname: <span className="font-mono font-medium text-foreground">{hostname}</span></p>
        </CardContent>
      </Card>

      {/* Network Card */}
      <Card>
        <CardHeader>
          <CardTitle>Network Information</CardTitle>
          <CardDescription>Internal IP addresses for this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {ips.length > 0 ? (
              ips.map((ip) => (
                <Badge key={ip} variant="secondary" className="font-mono text-sm">
                  {ip}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">No IP addresses found</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* System Info Card */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Real-time resource usage and status</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Uptime</p>
              <p className="text-lg font-semibold">{systemInfo?.uptime}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">CPU Temp</p>
              <p className="text-lg font-semibold">{systemInfo?.cpu_temp}°C</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Memory</p>
              <p className="text-lg font-semibold">{systemInfo?.memory.used} / {systemInfo?.memory.total}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Disk Usage</p>
              <p className="text-lg font-semibold">{systemInfo?.disk.used} ({systemInfo?.disk.percent})</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Power Controls Card */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Power Controls</CardTitle>
          <CardDescription>Perform system-level power actions</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex-1 gap-2">
                <RotateCw className="h-4 w-4" /> Reboot
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to reboot?</AlertDialogTitle>
                <AlertDialogDescription>
                  The device will restart. All services will be temporarily unavailable.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReboot}>Reboot</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex-1 gap-2">
                <Power className="h-4 w-4" /> Shutdown
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to shutdown?</AlertDialogTitle>
                <AlertDialogDescription>
                  The device will power off. You will need physical access to restart it.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleShutdown} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Shutdown
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Anthias Link Card */}
      <Card>
        <CardHeader>
          <CardTitle>Display Manager</CardTitle>
          <CardDescription>Manage screen layout and schedules via Anthias</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" className="w-full gap-2" asChild>
            <a href={anthiasUrl} target="_blank" rel="noopener noreferrer">
              <Monitor className="h-4 w-4" /> Open Anthias UI
            </a>
          </Button>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Default port: 9000
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
