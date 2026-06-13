export interface SystemInfo {
  uptime: string;
  cpu_temp: number | string;
  memory: {
    total: string;
    used: string;
  };
  disk: {
    total: string;
    used: string;
    percent: string;
  };
}

export const deviceService = {
  async getHostname(): Promise<string> {
    const res = await fetch('/api/device?query=hostname');
    if (!res.ok) throw new Error('Failed to fetch hostname');
    const data = await res.json();
    return data.hostname;
  },

  async setHostname(hostname: string): Promise<void> {
    const res = await fetch('/api/device', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostname }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update hostname');
    }
  },

  async getIpAddresses(): Promise<string[]> {
    const res = await fetch('/api/device?query=ip');
    if (!res.ok) throw new Error('Failed to fetch IP addresses');
    const data = await res.json();
    return data.ips || [];
  },

  async getSystemInfo(): Promise<SystemInfo> {
    const res = await fetch('/api/device?query=info');
    if (!res.ok) throw new Error('Failed to fetch system info');
    return res.json();
  },

  async reboot(): Promise<void> {
    const res = await fetch('/api/device/reboot', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to trigger reboot');
  },

  async shutdown(): Promise<void> {
    const res = await fetch('/api/device/shutdown', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to trigger shutdown');
  },
};
