import dns from "node:dns";
import net from "node:net";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * Fetches a public web page safely.
 *
 * The API fetches URLs that arrive from the browser, so it must never be usable
 * to reach private networks (SSRF). Every hostname is resolved through a guarded
 * DNS lookup that is enforced at connect time, which also blocks DNS-rebinding.
 */

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 9_000;
const MAX_REDIRECTS = 4;
export const USER_AGENT =
  "Mozilla/5.0 (compatible; OverviewCheck/1.0; +https://github.com/ethancooley/overview-check)";

export class BlockedUrlError extends Error {}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const V4_BLOCKED: [string, number][] = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function expandV6(ip: string): number[] | null {
  let addr = ip.toLowerCase().split("%")[0];
  // Embedded IPv4 tail (e.g. ::ffff:1.2.3.4)
  const v4Tail = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    addr = addr.replace(v4Tail[1], `${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`);
  }
  const [head, tail] = addr.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail !== "" ? tail.split(":") : [];
  if (addr.includes("::")) {
    const fill = 8 - h.length - t.length;
    if (fill < 0) return null;
    return [...h, ...Array(fill).fill("0"), ...t].map((x) => parseInt(x, 16));
  }
  if (h.length !== 8) return null;
  return h.map((x) => parseInt(x, 16));
}

export function isPublicAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return !V4_BLOCKED.some(([base, bits]) => inV4Range(ip, base, bits));
  }
  if (family === 6) {
    const p = expandV6(ip);
    if (!p || p.some((x) => Number.isNaN(x))) return false;
    if (p.every((x) => x === 0)) return false; // ::
    if (p.slice(0, 7).every((x) => x === 0) && p[7] === 1) return false; // ::1
    if ((p[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
    if ((p[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
    if ((p[0] & 0xff00) === 0xff00) return false; // multicast
    if (p[0] === 0x2001 && p[1] === 0x0db8) return false; // documentation
    const mappedV4 =
      (p.slice(0, 5).every((x) => x === 0) && p[5] === 0xffff) || // ::ffff:a.b.c.d
      (p[0] === 0x64 && p[1] === 0xff9b && p.slice(2, 6).every((x) => x === 0)); // NAT64
    if (mappedV4) {
      const v4 = `${p[6] >> 8}.${p[6] & 0xff}.${p[7] >> 8}.${p[7] & 0xff}`;
      return isPublicAddress(v4);
    }
    return true;
  }
  return false;
}

/** Validates a URL's shape before any network activity. Throws BlockedUrlError. */
export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError("Not a valid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedUrlError("Only http and https links can be checked");
  }
  if (url.username || url.password) throw new BlockedUrlError("Links with credentials are not allowed");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new BlockedUrlError("Only standard web ports can be checked");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host)) throw new BlockedUrlError("Private addresses are not allowed");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) {
    throw new BlockedUrlError("Private hostnames are not allowed");
  }
  return url;
}

type LookupCb = (err: NodeJS.ErrnoException | null, address?: unknown, family?: number) => void;

function guardedLookup(hostname: string, options: dns.LookupOptions | LookupCb, cb?: LookupCb) {
  const callback = (typeof options === "function" ? options : cb) as LookupCb;
  const opts = (typeof options === "function" ? {} : options) as dns.LookupOptions;
  dns.lookup(hostname, { ...opts, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = addresses as dns.LookupAddress[];
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      const e = new Error(`Blocked non-public address for ${hostname}`) as NodeJS.ErrnoException;
      e.code = "EBLOCKED";
      return callback(e);
    }
    if (opts.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({
  connect: { lookup: guardedLookup as never, timeout: TIMEOUT_MS },
  headersTimeout: TIMEOUT_MS,
  bodyTimeout: TIMEOUT_MS,
});

export interface FetchedPage {
  finalUrl: string;
  contentType: string;
  body: string;
}

export async function safeFetch(rawUrl: string): Promise<FetchedPage> {
  let url = assertFetchableUrl(rawUrl);
  const deadline = AbortSignal.timeout(TIMEOUT_MS + 3_000);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await undiciFetch(url, {
      dispatcher: agent,
      redirect: "manual",
      signal: deadline,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "accept-language": "en-US,en;q=0.9",
      },
    });

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      url = assertFetchableUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`The page returned HTTP ${res.status}`);
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType && !/text\/html|application\/xhtml|text\/plain/.test(contentType)) {
      await res.body?.cancel();
      const err = new Error(`Unsupported content type: ${contentType.split(";")[0]}`);
      err.name = "UnsupportedType";
      throw err;
    }

    const charset = contentType.match(/charset=([\w-]+)/)?.[1] ?? "utf-8";
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(charset);
    } catch {
      decoder = new TextDecoder("utf-8");
    }

    const reader = res.body?.getReader();
    if (!reader) return { finalUrl: url.toString(), contentType, body: "" };
    let received = 0;
    let body = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      body += decoder.decode(value, { stream: true });
      if (received > MAX_BYTES) {
        await reader.cancel();
        break;
      }
    }
    body += decoder.decode();
    return { finalUrl: url.toString(), contentType, body };
  }
  throw new Error("Too many redirects");
}
