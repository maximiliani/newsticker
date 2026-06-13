const HOST_AGENT_URL = process.env.HOST_AGENT_URL || "http://localhost:9876";
const HOST_AGENT_SECRET = process.env.HOST_AGENT_SECRET;

export async function fetchHostAgent(path: string, options: RequestInit = {}) {
  if (!HOST_AGENT_SECRET) {
    throw new Error("HOST_AGENT_SECRET is not configured");
  }

  const url = `${HOST_AGENT_URL}${path}`;
  const headers = {
    ...options.headers,
    "Authorization": `Bearer ${HOST_AGENT_SECRET}`,
    "Content-Type": "application/json",
  };
  
  return fetch(url, { ...options, headers });
}
