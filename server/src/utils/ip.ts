import net from 'node:net';

/**
 * Normalizes an incoming client IP address so that it strictly conforms to
 * the application's IPv4 and IPv6 storage constraints without altering database schemas.
 *
 * - Returns null for missing/empty/falsy inputs.
 * - Trims whitespace.
 * - Extracts IPv4 from IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1 -> 127.0.0.1).
 * - Leaves standard IPv4 addresses unchanged.
 * - Expands compressed IPv6 addresses (e.g., ::1 -> 0000:0000:0000:0000:0000:0000:0000:0001)
 *   to satisfy canonical 8-hextet regex requirements.
 */
export function normalizeIp(rawIp?: string | null): string | null {
  if (!rawIp) {
    return null;
  }

  const trimmed = rawIp.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Convert IPv4-mapped IPv6 addresses (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
  const ipv4Mapped = trimmed.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (ipv4Mapped && ipv4Mapped[1] && net.isIPv4(ipv4Mapped[1])) {
    return ipv4Mapped[1];
  }

  // 2. Standard IPv4 pass-through
  if (net.isIPv4(trimmed)) {
    return trimmed;
  }

  // 3. Valid IPv6 handling
  if (net.isIPv6(trimmed)) {
    // If compressed, expand into full 8-hextet canonical representation
    if (trimmed.includes('::')) {
      const [leftStr = '', rightStr = ''] = trimmed.split('::');
      const leftParts = leftStr ? leftStr.split(':') : [];
      const rightParts = rightStr ? rightStr.split(':') : [];
      const missingCount = 8 - (leftParts.length + rightParts.length);
      const zeros = Array<string>(missingCount).fill('0000');

      return [...leftParts, ...zeros, ...rightParts]
        .map((hextet) => hextet.padStart(4, '0'))
        .join(':');
    }

    // Already 8 hextets, ensure standard 4-digit padding for consistency
    const parts = trimmed.split(':');
    if (parts.length === 8) {
      return parts.map((hextet) => hextet.padStart(4, '0')).join(':');
    }

    return trimmed;
  }

  return trimmed;
}
