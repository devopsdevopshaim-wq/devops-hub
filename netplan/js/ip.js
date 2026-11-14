// IPv4 / IPv6 helpers. Addresses are kept as unsigned 32-bit numbers.

export function ipToInt(str) {
  const parts = String(str).trim().split('.');
  if (parts.length !== 4) throw new Error(`כתובת IP לא תקינה: ${str}`);
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) throw new Error(`כתובת IP לא תקינה: ${str}`);
    n = n * 256 + Number(p);
  }
  return n >>> 0;
}

export function intToIp(n) {
  n >>>= 0;
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function parseCidr(cidr) {
  const m = String(cidr).trim().match(/^([\d.]+)\/(\d{1,2})$/);
  if (!m) throw new Error(`רשת לא תקינה (נדרש פורמט 10.0.0.0/8): ${cidr}`);
  const prefix = Number(m[2]);
  if (prefix < 0 || prefix > 32) throw new Error(`אורך קידומת לא תקין: ${cidr}`);
  const ip = ipToInt(m[1]);
  const size = 2 ** (32 - prefix);
  const network = Math.floor(ip / size) * size;
  return { network, prefix, size };
}

export function maskOf(prefix) {
  return intToIp(prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);
}

export function wildcardOf(prefix) {
  return intToIp(prefix === 32 ? 0 : (2 ** (32 - prefix) - 1));
}

// Smallest prefix whose usable host count (size - 2) holds `hosts`.
export function prefixForHosts(hosts) {
  for (let p = 30; p >= 0; p--) {
    if (2 ** (32 - p) - 2 >= hosts) return p;
  }
  throw new Error('מספר מארחים גדול מדי');
}

export function usable(prefix) {
  return prefix >= 31 ? 2 ** (32 - prefix) : 2 ** (32 - prefix) - 2;
}

export function subnetInfo(network, prefix) {
  const size = 2 ** (32 - prefix);
  return {
    cidr: `${intToIp(network)}/${prefix}`,
    network: intToIp(network),
    mask: maskOf(prefix),
    wildcard: wildcardOf(prefix),
    first: intToIp(network + 1),
    last: intToIp(network + size - 2),
    broadcast: intToIp(network + size - 1),
    usable: usable(prefix),
    size,
  };
}

export function isPrivate(n) {
  return (n >>> 24) === 10
    || ((n >>> 20) === ((172 << 4) | 1))
    || ((n >>> 16) === ((192 << 8) | 168));
}

export function contains(network, prefix, ip) {
  const size = 2 ** (32 - prefix);
  return ip >= network && ip < network + size;
}

// Deterministic IPv6 ULA /48 (fdxx:xxxx:xxxx::/48) derived from a seed string.
export function ulaFromSeed(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  let h2 = h ^ 0x9e3779b9;
  h2 = Math.imul(h2, 2654435761) >>> 0;
  const hex = (h.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 10);
  return `fd${hex.slice(0, 2)}:${hex.slice(2, 6)}:${hex.slice(6, 10)}::/48`;
}

// Returns the 3 leading hextets of a /48 ("2001:db8:1234") or throws.
export function parseV6_48(prefix) {
  const m = String(prefix).trim().toLowerCase().match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4}):([0-9a-f]{1,4})::\/48$/);
  if (!m) throw new Error(`קידומת IPv6 חייבת להיות ‎/48 בפורמט 2001:db8:1234::/48 (התקבל: ${prefix})`);
  return `${m[1]}:${m[2]}:${m[3]}`;
}

// The VLAN ID is written as-is into the 4th hextet (VLAN 1103 -> ...:1103::/64) so it reads at a glance.
export function v6Subnet(head48, vlan) {
  return `${head48}:${vlan}::/64`;
}
