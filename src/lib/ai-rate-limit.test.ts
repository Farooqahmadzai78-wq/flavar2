import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_RATE_LIMITS,
  checkAiRateLimit,
  checkRateLimit,
  extractClientKey,
  FIREWALL_RATE_LIMIT_IDS,
  rateLimitError,
  resetFirewallStateForTests,
  resetRateLimitsForTests,
  setFirewallRateLimitCheckForTests,
} from "./ai-rate-limit";

function headersOf(entries: Record<string, string>) {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(entries)) lower.set(k.toLowerCase(), v);
  return {
    get(name: string): string | null {
      return lower.get(name.toLowerCase()) ?? null;
    },
  };
}

describe("extractClientKey", () => {
  it("prefers the Vercel edge IP over spoofable headers", () => {
    const key = extractClientKey(
      headersOf({
        "x-real-ip": "203.0.113.9",
        "x-forwarded-for": "spoofed, 198.51.100.7",
        "cf-connecting-ip": "192.0.2.1",
      }),
    );
    expect(key).toBe("203.0.113.9");
  });

  it("prefers the XFF rightmost entry over CDN fallbacks when no Vercel header", () => {
    const key = extractClientKey(
      headersOf({
        "x-forwarded-for": "spoofed, 203.0.113.9",
        "cf-connecting-ip": "198.51.100.7",
      }),
    );
    expect(key).toBe("203.0.113.9");
  });

  it("uses the rightmost XFF entry so rotating the left prefix keeps one budget", () => {
    const a = extractClientKey(headersOf({ "x-forwarded-for": "spoof-a, 203.0.113.9" }));
    const b = extractClientKey(headersOf({ "x-forwarded-for": "spoof-b, 203.0.113.9" }));
    expect(a).toBe(b);
    expect(a).toBe("203.0.113.9");
  });

  it("rotating XFF prefixes does not mint fresh per-key budgets", () => {
    resetRateLimitsForTests();
    const { scope, limit, windowMs } = AI_RATE_LIMITS.tts; // 10 / min
    for (let i = 0; i < limit; i++) {
      const k = extractClientKey(headersOf({ "x-forwarded-for": `spoof-${i}, 203.0.113.9` }));
      expect(checkRateLimit(scope, k, limit, windowMs, 0, 1_000 + i).allowed).toBe(true);
    }
    const again = extractClientKey(headersOf({ "x-forwarded-for": "fresh-prefix, 203.0.113.9" }));
    expect(checkRateLimit(scope, again, limit, windowMs, 0, 1_001).allowed).toBe(false);
  });

  it("falls back to a shared bucket when no headers exist", () => {
    expect(extractClientKey(undefined)).toBe("shared");
    expect(extractClientKey(headersOf({}))).toBe("shared");
  });

  it("truncates overly long header values", () => {
    const key = extractClientKey(headersOf({ "x-real-ip": "a".repeat(500) }));
    expect(key.length).toBeLessThanOrEqual(256);
  });
});

describe("checkRateLimit", () => {
  it("allows up to the per-key limit then rejects with a retry delay", () => {
    resetRateLimitsForTests();
    const { scope, limit, windowMs } = AI_RATE_LIMITS.tts; // 10 / min
    for (let i = 0; i < limit; i++) {
      const d = checkRateLimit(scope, "client-a", limit, windowMs, 0, 1_000 + i);
      expect(d.allowed).toBe(true);
      expect(d.retryAfterSec).toBe(0);
    }
    const rejected = checkRateLimit(scope, "client-a", limit, windowMs, 0, 1_001);
    expect(rejected.allowed).toBe(false);
    expect(rejected.retryAfterSec).toBeGreaterThan(0);
    // A different key keeps its own budget.
    expect(checkRateLimit(scope, "client-b", limit, windowMs, 0, 1_001).allowed).toBe(true);
  });

  it("re-opens the window once old hits expire", () => {
    resetRateLimitsForTests();
    const { scope, limit, windowMs } = AI_RATE_LIMITS.ingredientAnalyze;
    for (let i = 0; i < limit; i++) {
      checkRateLimit(scope, "k", limit, windowMs, 0, 0);
    }
    expect(checkRateLimit(scope, "k", limit, windowMs, 0, 1).allowed).toBe(false);
    expect(checkRateLimit(scope, "k", limit, windowMs, 0, windowMs + 2).allowed).toBe(true);
  });

  it("enforces a global per-scope ceiling even across spoofed keys", () => {
    resetRateLimitsForTests();
    const { scope, windowMs } = AI_RATE_LIMITS.translate;
    const perKey = 10_000;
    for (let i = 0; i < AI_RATE_LIMITS.translate.globalLimit; i++) {
      const d = checkRateLimit(scope, `key-${i}`, perKey, windowMs, AI_RATE_LIMITS.translate.globalLimit, 5_000);
      expect(d.allowed).toBe(true);
    }
    const over = checkRateLimit(scope, "one-more", perKey, windowMs, AI_RATE_LIMITS.translate.globalLimit, 5_000);
    expect(over.allowed).toBe(false);
  });

  it("produces a client-safe error message with the wait time", () => {
    const err = rateLimitError("tts", 42);
    expect(err.message).toContain("42s");
    expect(err.message).not.toContain("key");
  });
});

describe("checkAiRateLimit — Vercel Firewall integration", () => {
  const originalVercel = process.env.VERCEL;

  afterEach(() => {
    resetFirewallStateForTests();
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
  });

  it("maps the five AI categories to one shared Firewall rule ID", () => {
    const ruleIds = Object.values(FIREWALL_RATE_LIMIT_IDS);
    expect(ruleIds).toHaveLength(5);
    // One rule for analyze/start/translate/tts, one distinct rule for the
    // status endpoint (its quota stays local-only).
    expect(new Set(ruleIds).size).toBe(2);
    const shared = new Set(["ingredientAnalyze", "ingredientStart", "translate", "tts"]);
    for (const name of Object.keys(FIREWALL_RATE_LIMIT_IDS).sort()) {
      const id = FIREWALL_RATE_LIMIT_IDS[name as keyof typeof FIREWALL_RATE_LIMIT_IDS];
      expect(typeof id).toBe("string");
      expect(id).toMatch(/^[a-z0-9-]+$/);
      if (shared.has(name)) {
        expect(id).toBe(FIREWALL_RATE_LIMIT_IDS.ingredientAnalyze);
      } else {
        expect(id).toBe(FIREWALL_RATE_LIMIT_IDS.ingredientStatus);
      }
    }
  });

  it("stays on the local in-memory limiter when not running on Vercel", async () => {
    delete process.env.VERCEL;
    resetRateLimitsForTests();
    let firewallCalls = 0;
    setFirewallRateLimitCheckForTests(async () => {
      firewallCalls += 1;
      return { rateLimited: false };
    });

    const { limit } = AI_RATE_LIMITS.tts;
    for (let i = 0; i < limit; i++) {
      const d = await checkAiRateLimit("tts", { key: "dev-client", now: 2_000 + i });
      expect(d.allowed).toBe(true);
    }
    const denied = await checkAiRateLimit("tts", {
      key: "dev-client",
      now: 2_000 + limit,
    });
    expect(denied.allowed).toBe(false);
    expect(firewallCalls).toBe(0); // local development never consults the SDK
  });

  it("consults the Firewall with the category rule ID and honours a deny", async () => {
    process.env.VERCEL = "1";
    resetRateLimitsForTests();
    const seen: {
      ruleId?: string;
      rateLimitKey?: string;
      request?: Request;
      timeout?: number;
    } = {};
    setFirewallRateLimitCheckForTests(async (ruleId, options) => {
      seen.ruleId = ruleId;
      seen.rateLimitKey = options.rateLimitKey;
      seen.request = options.request;
      seen.timeout = options.timeout;
      return { rateLimited: true };
    });

    const request = new Request("https://example.test/api");
    const d = await checkAiRateLimit("tts", { key: "203.0.113.9", request });
    expect(d.allowed).toBe(false);
    expect(d.retryAfterSec).toBeGreaterThan(0);
    expect(seen.ruleId).toBe(FIREWALL_RATE_LIMIT_IDS.tts);
    expect(seen.rateLimitKey).toBe("203.0.113.9");
    expect(seen.request).toBe(request);
    expect(seen.timeout).toBeGreaterThan(0);
  });

  it("keeps local enforcement and logs loudly when the rule is not configured", async () => {
    process.env.VERCEL = "1";
    resetRateLimitsForTests();
    const logs: string[] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      });
    setFirewallRateLimitCheckForTests(async () => ({
      rateLimited: false,
      error: "not-found",
    }));
    try {
      const { limit } = AI_RATE_LIMITS.tts;
      for (let i = 0; i < limit; i++) {
        const d = await checkAiRateLimit("tts", { key: "k", now: 10_000 + i });
        expect(d.allowed).toBe(true);
      }
      const denied = await checkAiRateLimit("tts", {
        key: "k",
        now: 10_000 + limit,
      });
      expect(denied.allowed).toBe(false); // local quota still enforced...
      expect(logs.length).toBeGreaterThan(0); // ...and loudly reported
      expect(logs[0]).toContain(FIREWALL_RATE_LIMIT_IDS.tts);
    } finally {
      spy.mockRestore();
    }
  });

  it("degrades loudly but does not block traffic when the Firewall check fails", async () => {
    process.env.VERCEL = "1";
    resetRateLimitsForTests();
    const logs: string[] = [];
    const spy = vi
      .spyOn(console, "error")
      .mockImplementation((...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      });
    setFirewallRateLimitCheckForTests(async () => {
      throw new Error("network down");
    });
    try {
      const allowed = await checkAiRateLimit("translate", { key: "k2" });
      expect(allowed.allowed).toBe(true); // local decision still returned
      expect(logs.length).toBeGreaterThan(0); // degradation is not silent
    } finally {
      spy.mockRestore();
    }
  });
});

