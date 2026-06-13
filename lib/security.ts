
/**
 * Validates that a URL is safe to fetch, preventing SSRF attacks.
 * Blocks non-HTTP/HTTPS protocols and private IP ranges.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

<<<<<<< ours
    const hostname = parsed.hostname.toLowerCase();
    
    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return false;
=======
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    
    // Block localhost and loopback
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0') return false;

    // IPv4-mapped IPv6
    if (/^::ffff:(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/.test(hostname)) return false;
>>>>>>> theirs

    // Check for private IP ranges (IPv4)
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16
    const privateIPRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/;
    if (privateIPRegex.test(hostname)) return false;

    // IPv6 private/link-local ranges
    if (hostname.startsWith('fe80:') || hostname.startsWith('fc00:') || hostname.startsWith('fd00:')) return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
