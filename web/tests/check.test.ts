import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertFetchableUrl, isPublicAddress } from "../lib/check/safeFetch";
import { splitSentences, tokens, coverage, numbersIn } from "../lib/check/text";
import { buildPassages, rankPassages } from "../lib/check/passages";
import { fragmentUrl, verifyQuote } from "../lib/check/quote";
import { cleanSourceUrl, parseCheckRequest } from "../lib/check/request";
import { judgeHeuristic } from "../lib/check/judge";
import { extractFromHtml } from "../lib/check/extract";

describe("address safety", () => {
  it.each([
    ["8.8.8.8", true],
    ["93.184.216.34", true],
    ["10.1.2.3", false],
    ["127.0.0.1", false],
    ["169.254.169.254", false],
    ["172.20.0.1", false],
    ["192.168.1.1", false],
    ["100.64.0.5", false],
    ["::1", false],
    ["fe80::1", false],
    ["fd12:3456::1", false],
    ["::ffff:127.0.0.1", false],
    ["::ffff:8.8.8.8", true],
    ["2606:4700:4700::1111", true],
  ])("%s public=%s", (ip, expected) => {
    expect(isPublicAddress(ip)).toBe(expected);
  });

  it("rejects dangerous URLs before fetching", () => {
    expect(() => assertFetchableUrl("file:///etc/passwd")).toThrow();
    expect(() => assertFetchableUrl("http://localhost:3000")).toThrow();
    expect(() => assertFetchableUrl("http://169.254.169.254/latest/meta-data")).toThrow();
    expect(() => assertFetchableUrl("https://user:pw@example.com")).toThrow();
    expect(() => assertFetchableUrl("https://example.com:8443/x")).toThrow();
    expect(assertFetchableUrl("https://example.com/a?b=1").hostname).toBe("example.com");
  });
});

describe("text", () => {
  it("splits sentences without breaking on abbreviations", () => {
    const s = splitSentences("Dr. Smith said 200 mg is safe. Most U.S. adults agree! Is it? Yes.");
    expect(s).toEqual(["Dr. Smith said 200 mg is safe.", "Most U.S. adults agree!", "Is it?", "Yes."]);
  });
  it("tokenizes with stemming and keeps numbers", () => {
    expect(tokens("Adults drinking 400 mg of coffee daily")).toEqual(["adult", "drink", "400", "mg", "coffee", "daily"]);
    expect(numbersIn("Up to 1,200 people in 2024")).toEqual(["1200", "2024"]);
  });
  it("measures coverage", () => {
    expect(coverage("caffeine limit 400 mg", "The FDA cites 400 mg of caffeine a day as a limit")).toBe(1);
  });
});

describe("passages and ranking", () => {
  const blocks = [
    "Coffee is a brewed drink. It is popular worldwide. It comes from roasted beans. People drink it in the morning. Some add milk.",
    "The FDA has cited 400 milligrams a day as an amount not generally associated with negative effects in healthy adults.",
    "Tea also contains caffeine but usually less per cup.",
  ];
  const passages = buildPassages(blocks, "https://example.com", 0);
  it("builds overlapping windows with ids", () => {
    expect(passages[0].id).toBe("S1-P1");
    expect(passages.length).toBeGreaterThanOrEqual(4);
  });
  it("ranks the passage with the matching figure first", () => {
    const top = rankPassages("Healthy adults can have 400 mg of caffeine a day", passages, 2);
    expect(top[0].text).toContain("400 milligrams");
  });
});

describe("quotes", () => {
  const passage = "The FDA has cited 400 milligrams a day as an amount not generally associated with negative effects.";
  it("accepts a verbatim quote despite curly quotes and spacing", () => {
    const r = verifyQuote("cited 400  milligrams a day", passage, "claim");
    expect(r.verbatim).toBe(true);
    expect(r.quote).toBe("cited 400 milligrams a day");
  });
  it("replaces an invented quote with a real sentence", () => {
    const r = verifyQuote("The FDA says caffeine is totally harmless", passage, "caffeine harmless");
    expect(r.verbatim).toBe(false);
    expect(passage).toContain(r.quote.replace(/…$/, ""));
  });
  it("builds a text fragment link with reserved characters escaped", () => {
    const url = fragmentUrl("https://ex.com/page#top", "one-time dose, then rest");
    expect(url).toBe("https://ex.com/page#:~:text=one%2Dtime%20dose%2C%20then%20rest");
    const long = fragmentUrl("https://ex.com/p", "a b c d e f g h i j k");
    expect(long).toBe("https://ex.com/p#:~:text=a%20b%20c%20d%20e,h%20i%20j%20k");
  });
});

describe("request parsing", () => {
  it("unwraps Google redirect links and drops Google pages", () => {
    expect(cleanSourceUrl("https://www.google.com/url?q=https://www.fda.gov/x%23y&sa=U")).toBe("https://www.fda.gov/x");
    expect(cleanSourceUrl("https://www.google.com/search?q=hi")).toBeNull();
    expect(cleanSourceUrl("javascript:alert(1)")).toBeNull();
  });
  it("validates claims", () => {
    expect(parseCheckRequest({}).ok).toBe(false);
    expect(parseCheckRequest({ claims: [{ text: "hi", sources: [] }] }).ok).toBe(false);
    const ok = parseCheckRequest({ claims: [{ id: "a", text: "Coffee has caffeine in it.", sources: ["https://a.com", "https://a.com"] }] });
    expect(ok.ok && ok.value.claims[0].sources).toEqual(["https://a.com/"]);
  });
});

describe("lite judge", () => {
  const passages = buildPassages(
    ["The Eiffel Tower is 330 metres tall and was completed in 1889 for the World's Fair in Paris."],
    "https://ex.com",
    0,
  );
  it("supports a well-covered claim", () => {
    expect(judgeHeuristic("The Eiffel Tower was completed in 1889.", passages).verdict).toBe("supported");
  });
  it("flags a wrong number as not found and never says contradicted", () => {
    const j = judgeHeuristic("The Eiffel Tower was completed in 1887.", passages);
    expect(j.verdict).toBe("not_found");
    expect(j.explanation).toMatch(/figure/);
  });
});

describe("extraction", () => {
  it("pulls article paragraphs and drops navigation and scripts", () => {
    const html = `<!doctype html><html><head><title>Caffeine facts</title><script>alert(1)</script></head><body>
      <nav><ul><li>Home</li><li>About us and our team</li></ul></nav>
      <article><h1>Caffeine facts</h1>
      <p>Caffeine is a stimulant found in coffee, tea, and many soft drinks around the world.</p>
      <p>The FDA has cited 400 milligrams a day as an amount not generally associated with negative effects.</p>
      <p>Pregnant people are often advised to limit caffeine to 200 milligrams per day by many clinicians.</p>
      </article></body></html>`;
    const doc = extractFromHtml(html, "https://ex.com/caffeine");
    expect(doc.title).toBe("Caffeine facts");
    expect(doc.blocks.some((b) => b.includes("400 milligrams"))).toBe(true);
    expect(doc.blocks.join(" ")).not.toContain("alert(1)");
  });
});

describe("pipeline (network mocked)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
  });
  it("streams source and result events in lite mode", async () => {
    vi.doMock("../lib/check/safeFetch", async (orig) => {
      const real = await orig<typeof import("../lib/check/safeFetch")>();
      return {
        ...real,
        safeFetch: vi.fn(async (url: string) => {
          if (url.includes("pdf")) {
            const e = new Error("Unsupported content type: application/pdf");
            e.name = "UnsupportedType";
            throw e;
          }
          return {
            finalUrl: url,
            contentType: "text/html",
            body: `<html><head><title>Tower</title></head><body><article><p>The Eiffel Tower is 330 metres tall and was completed in 1889 for the World's Fair in Paris, France.</p></article></body></html>`,
          };
        }),
      };
    });
    const { runCheck } = await import("../lib/check/pipeline");
    const events: { type: string; [k: string]: unknown }[] = [];
    await runCheck(
      {
        claims: [
          { id: "a", text: "The Eiffel Tower was completed in 1889.", sources: ["https://tower.example/"] },
          { id: "b", text: "The Eiffel Tower is 500 metres tall.", sources: ["https://tower.example/"] },
          { id: "c", text: "The tower has 9 elevators in total.", sources: ["https://files.example/pdf"] },
        ],
      },
      (e) => events.push(e as never),
    );
    expect(events[0]).toMatchObject({ type: "start", mode: "heuristic", sources: 2 });
    const results = Object.fromEntries(
      events.filter((e) => e.type === "result").map((e) => [(e.result as { id: string }).id, e.result as Record<string, unknown>]),
    );
    expect(results.a.verdict).toBe("supported");
    expect((results.a.evidence as { fragmentUrl: string }).fragmentUrl).toContain("#:~:text=");
    expect(results.b.verdict).toBe("not_found");
    expect(results.c.verdict).toBe("unverifiable");
    expect(events.at(-1)).toMatchObject({ type: "done", summary: { supported: 1, not_found: 1, unverifiable: 1 } });
  });
});

describe("model judge (SDK mocked)", () => {
  beforeEach(() => vi.resetModules());
  it("parses the tool call and repairs an invented quote", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const create = vi.fn(async () => ({
      content: [
        {
          type: "tool_use",
          name: "record_verdict",
          input: {
            verdict: "contradicted",
            partial: false,
            passage_id: "S1-P1",
            quote: "The tower is 500 metres tall",
            explanation: "The page says the tower is 330 metres tall, not 500.",
            confidence: 0.9,
          },
        },
      ],
    }));
    vi.doMock("@anthropic-ai/sdk", () => ({ default: class { messages = { create }; } }));
    vi.doMock("../lib/check/safeFetch", async (orig) => ({
      ...(await orig<typeof import("../lib/check/safeFetch")>()),
      safeFetch: vi.fn(async (url: string) => ({
        finalUrl: url,
        contentType: "text/html",
        body: `<html><body><article><p>The Eiffel Tower is 330 metres tall and was completed in 1889 for the World's Fair in Paris, France.</p></article></body></html>`,
      })),
    }));
    const { runCheck } = await import("../lib/check/pipeline");
    const events: Record<string, unknown>[] = [];
    await runCheck({ claims: [{ id: "x", text: "The Eiffel Tower is 500 metres tall.", sources: ["https://t.example/"] }] }, (e) =>
      events.push(e as never),
    );
    const result = events.find((e) => e.type === "result")!.result as Record<string, any>;
    expect(create).toHaveBeenCalledOnce();
    const call = (create.mock.calls[0] as any[])[0];
    expect(call.tool_choice).toEqual({ type: "tool", name: "record_verdict" });
    expect(call.messages[0].content).toContain('<passage id="S1-P1"');
    expect(result.verdict).toBe("contradicted");
    expect(result.mode).toBe("model");
    expect(result.evidence.verbatim).toBe(false);
    expect(result.evidence.quote).toContain("330 metres");
    expect(result.confidence).toBeLessThanOrEqual(0.6);
    delete process.env.ANTHROPIC_API_KEY;
  });
});
