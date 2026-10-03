import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const blockedV4 = new BlockList();
for (const [subnet, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedV4.addSubnet(subnet, prefix, 'ipv4');
const blockedV6 = new BlockList();
for (const [subnet, prefix] of [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['64:ff9b::', 96],
  ['100::', 64], ['2001::', 32], ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blockedV6.addSubnet(subnet, prefix, 'ipv6');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');

export class UnsafeTargetError extends Error {
  constructor(message: string) { super(message); this.name = 'UnsafeTargetError'; }
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, 'ipv4');
  if (family === 6) return globalV6.check(address, 'ipv6') && !blockedV6.check(address, 'ipv6');
  return false;
}

export function parsePublicUrl(input: string): URL {
  if (input.length > 2048) throw new UnsafeTargetError('The URL is too long to check safely.');
  let url: URL;
  try { url = new URL(input); } catch { throw new UnsafeTargetError('Enter a complete http or https URL.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UnsafeTargetError('Only http and https links can be checked.');
  if (url.username || url.password) throw new UnsafeTargetError('Links containing credentials are not accepted.');
  if (url.port && !['80', '443'].includes(url.port)) throw new UnsafeTargetError('Only standard web ports can be checked.');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  const hostIp = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (!hostname || hostname.endsWith('.local') || hostname.endsWith('.internal') || hostname === 'localhost') {
    throw new UnsafeTargetError('Local or private-network links cannot be checked.');
  }
  if (isIP(hostIp) && !isPublicAddress(hostIp)) throw new UnsafeTargetError('Local or private-network links cannot be checked.');
  return url;
}

export async function resolvePublicAddress(url: URL): Promise<{ address: string; family: 4 | 6 }> {
  const hostname = url.hostname.startsWith('[') && url.hostname.endsWith(']') ? url.hostname.slice(1, -1) : url.hostname;
  if (isIP(hostname)) return { address: hostname, family: isIP(hostname) as 4 | 6 };
  const results = await lookup(url.hostname, { all: true, verbatim: true });
  if (!results.length || results.some((result) => !isPublicAddress(result.address))) {
    throw new UnsafeTargetError('The host resolves to a private or unsupported network address.');
  }
  return results[0] as { address: string; family: 4 | 6 };
}
