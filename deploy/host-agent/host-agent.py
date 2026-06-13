#!/usr/bin/env python3
import http.server
import json
import os
import subprocess
import socket
import sys
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("host-agent")

# Configuration
PORT = 9876
# Bind to 127.0.0.1 as specified in the plan for security.
# Note: App container may need to use host networking or host.docker.internal to reach this.
BIND_ADDRESS = '127.0.0.1'
SECRET = os.environ.get("HOST_AGENT_SECRET")

if not SECRET:
    print("Error: HOST_AGENT_SECRET environment variable not set.")
    sys.exit(1)

class HostAgentHandler(http.server.BaseHTTPRequestHandler):
    def check_auth(self):
        auth_header = self.headers.get('Authorization')
        if not auth_header or auth_header != f"Bearer {SECRET}":
            self.send_response(401)
            self.end_headers()
            self.wfile.write(b'Unauthorized')
            return False
        return True

    def do_GET(self):
        if self.path == '/health':
            self.send_json({"status": "ok"})
            return

        if not self.check_auth():
            return

        if self.path == '/hostname':
            hostname = socket.gethostname()
            self.send_json({"hostname": hostname})
        elif self.path == '/ip':
            try:
                ips = subprocess.check_output(['hostname', '-I']).decode().strip().split()
                self.send_json({"ips": ips})
            except Exception as e:
                self.send_error(500, str(e))
        elif self.path == '/system-info':
            info = self.get_system_info()
            self.send_json(info)
        else:
            self.send_error(404)

    def do_PUT(self):
        if not self.check_auth():
            return

        if self.path == '/hostname':
            content_length = int(self.headers['Content-Length'])
            try:
                data = json.loads(self.rfile.read(content_length))
                new_hostname = data.get('hostname')
                if new_hostname:
                    # RFC 1123 validation: alphanumeric + hyphens, max 63 chars, no leading/trailing hyphens
                    if not re.match(r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$', new_hostname):
                        self.send_error(400, "Invalid hostname format. Must comply with RFC 1123.")
                        return

                    # On Raspbian, hostnamectl is the preferred way
                    subprocess.run(['hostnamectl', 'set-hostname', new_hostname], check=True)
                    self.send_json({"status": "ok", "hostname": new_hostname})
                else:
                    self.send_error(400, "Missing hostname in request body")
            except Exception as e:
                self.send_error(500, str(e))
        else:
            self.send_error(404)

    def do_POST(self):
        if not self.check_auth():
            return

        if self.path == '/reboot':
            self.send_json({"status": "rebooting"})
            subprocess.Popen(['reboot'])
        elif self.path == '/shutdown':
            self.send_json({"status": "shutting down"})
            subprocess.Popen(['shutdown', 'now'])
        else:
            self.send_error(404)

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def get_system_info(self):
        info = {
            "uptime": "unknown",
            "cpu_temp": "N/A",
            "memory": {"total": "N/A", "used": "N/A"},
            "disk": {"total": "N/A", "used": "N/A", "percent": "N/A"}
        }

        try:
            info["uptime"] = subprocess.check_output(['uptime', '-p']).decode().strip()
        except (subprocess.CalledProcessError, FileNotFoundError, ValueError) as e:
            logger.warning(f"Failed to get uptime: {e}")

        try:
            # Raspberry Pi temperature path
            if os.path.exists('/sys/class/thermal/thermal_zone0/temp'):
                with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                    info["cpu_temp"] = int(f.read()) / 1000.0
        except (IOError, ValueError) as e:
            logger.warning(f"Failed to get CPU temperature: {e}")
        
        try:
            mem = subprocess.check_output(['free', '-m']).decode().split('\n')[1].split()
            info["memory"] = {"total": f"{mem[1]}MB", "used": f"{mem[2]}MB"}
        except (subprocess.CalledProcessError, FileNotFoundError, IndexError, ValueError) as e:
            logger.warning(f"Failed to get memory info: {e}")

        try:
            disk = subprocess.check_output(['df', '-h', '/']).decode().split('\n')[1].split()
            info["disk"] = {"total": disk[1], "used": disk[2], "percent": disk[4]}
        except (subprocess.CalledProcessError, FileNotFoundError, IndexError, ValueError) as e:
            logger.warning(f"Failed to get disk info: {e}")

        return info

if __name__ == '__main__':
    server = http.server.HTTPServer((BIND_ADDRESS, PORT), HostAgentHandler)
    print(f"Host Agent running on {BIND_ADDRESS}:{PORT}...")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
