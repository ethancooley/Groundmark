# Overview Check

**Google's AI cites its sources. Overview Check reads them.**

Overview Check is a Chrome extension and website that checks each sentence of a Google AI Overview against the pages Google cited for it. Every sentence gets one of four verdicts, with the exact passage from the source that backs it up (or doesn't) and a link that opens the page scrolled to that passage.

| Verdict | Meaning |
| --- | --- |
| ✅ Supported | The cited page says it, or it follows directly. Every number, name, and qualifier matches. |
| ❓ Not found in its source | The cited page doesn't back the specifics. The sentence may be true, but its own citation doesn't show it. |
| ❌ Contradicted by its source | The cited page says something that conflicts with the sentence. |
| ➖ Couldn't check | The source was a PDF, blocked, paywalled, or missing. No guess is made. |

Built by Ethan Cooley for Responsible AI, Duke University AI for Product Innovation (AIPI).

## Why it matters

AI Overviews sit above every Google result and link to sources that look like proof. Independent studies keep finding those sources often don't say what the summary claims:

- An [Oumi analysis](https://oumi.ai/blog/oumis-study-finds-50-of-ai-overviews) of 1,609 Gemini 3 AI Overviews found 52% had at least one claim their cited sources didn't support, and only 39% were both correct and fully supported (April 2026).
- A Washington University in St. Louis study (arXiv:2605.14021, [summary](https://somethinginc.com/blog/ai-citation-doesnt-mean-what-you-think/)) of 98,020 claims across 7,583 Overviews found 11% weren't backed by the source Google attributed them to, and 4.1% were directly contradicted.
- [Pew Research Center](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/) found people clicked a search result in 8% of visits with an AI summary, versus 15% without one. Fewer clicks means fewer people checking.

## What's in this repo

```
overview-check/
├── extension/          Chrome extension (Manifest V3, no build step)
│   ├── content.js      Finds the Overview, splits sentences, maps citations, renders verdicts
│   ├── background.js   Streams results from the checking server
│   ├── popup.*         Tally for the current tab, settings, server address
│   └── config.js       Default server address (rewritten when the site builds)
└── web/                Next.js site + checking API (deploys to Vercel)
    ├── app/page.tsx    Landing page
    ├── app/lab/        Test page with the structure of an AI Overview
    ├── app/api/check   The checker (streams NDJSON)
    ├── lib/check/      Fetching, extraction, ranking, judging, quote verification
    ├── tests/          Unit tests (vitest)
    ├── scripts/        Extension packager and evaluation runner
    └── eval/           Labeled cases for measuring accuracy
```

## How it works

1. **Find the claims.** The content script waits for the AI Overview to finish streaming, splits it into sentences, and records which links Google attached to each one: the link right after a sentence first, then its paragraph's links, then the Overview's source list as a last resort (the hover card says which).
2. **Read the sources.** The server fetches each cited page through an SSRF-safe fetcher and extracts the readable article text with Mozilla Readability.
3. **Find the relevant passages.** Each page is split into overlapping three-sentence passages and ranked against the claim with BM25, with a bonus for matching numbers.
4. **Judge.** Claude reads the claim and the top passages and records a verdict through a forced tool call: verdict, a verbatim quote, a one-sentence explanation, and a confidence.
5. **Verify the receipt.** The quote is checked against the source text. If it isn't verbatim, the closest real sentence replaces it and confidence is capped. Users only ever see text that exists on the page.
6. **Show it.** Badges appear after each sentence. Sentences are marked with the CSS Custom Highlight API, so Google's DOM is never rewrapped. Hovering or focusing a badge opens an evidence card in a shadow root, with a [text fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments) link to the exact passage.

## Responsible design choices

- **The query never leaves the browser.** Only the Overview's sentences and the links Google attached are sent.
- **No host permissions.** The extension can only run on Google search pages and the lab page. The server fetches sources, not the browser.
- **Pages can't give orders.** Source text is passed to the model as escaped, tagged data, with a rule to ignore instructions inside it (prompt injection from web pages).
- **No invented receipts.** Quotes are verified verbatim against the page before display.
- **SSRF protection.** The fetcher allows only http(s) on standard ports, rejects credentials, and resolves DNS through a guard that refuses private, loopback, link-local, and metadata addresses, enforced at connect time so DNS rebinding can't slip through. Redirects are re-checked at every hop. Responses are capped at 3 MB and 9 seconds.
- **Untrusted text is never rendered as HTML.** Server and page text reach the DOM through `textContent` only.
- **Uncertainty is explicit.** "Not found" is not "false." Unreadable sources get "Couldn't check," never a guess. Every verdict shows its confidence and which links it used.
- **Lite mode is labeled.** Without an API key the server falls back to word matching, which never claims a contradiction, and every result says "Lite check."
- **Cost and abuse limits.** Per-IP rate limiting, a daily claim cap, request size limits, and result caching.

## Run it locally

Requirements: Node 20+ and Chrome.

```bash
cd web
npm install
cp .env.example .env.local   # then add your Anthropic API key
npm run dev                  # http://localhost:3000
```

Load the extension:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. Open http://localhost:3000/lab, or search on Google for something that shows an AI Overview.

The extension points at `http://localhost:3000` by default. Change it any time in the extension popup under **Checking server**.

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, import the repo and set **Root Directory** to `web`. Leave "Include files outside the root directory" on, because the build packages `../extension`.
3. Add environment variables:
   - `ANTHROPIC_API_KEY` (required for model verdicts; without it the site runs in lite mode)
   - `ANTHROPIC_MODEL` (optional, defaults to `claude-sonnet-5-5`; `claude-haiku-5-5` is cheaper and faster)
   - `SITE_URL` (optional, e.g. `https://overviewcheck.app` if you add a custom domain; otherwise the Vercel production URL is used)
   - `DAILY_CLAIM_LIMIT` and `RATE_LIMIT_PER_5MIN` (optional cost controls)
4. Deploy. The build zips the extension into `/overview-check-extension.zip` with the server address set to your deployment, so the download button on the site gives people a working extension.

If you add a custom domain, also add it to the `matches` list in `extension/manifest.json` (`https://yourdomain/lab*`) so the lab page works there.

## Test and evaluate

```bash
cd web
npm test                                          # 30 unit tests: SSRF guards, parsing, ranking, quotes, pipeline
npm run eval -- http://localhost:3000 eval/cases.jsonl
```

The evaluation runner sends each labeled case through the real API and prints accuracy, a confusion matrix, precision for "contradicted" (false alarms are the costliest error), and every disagreement with the model's explanation and quote. The starter set has 13 rows. Grow it to 200+ by reading pages yourself and recording what they actually say; that number belongs in your write-up.

## Limitations

- It checks whether the cited page supports a sentence, not whether the sentence is true.
- Verdicts come from a language model reading short passages. It can miss context elsewhere on a page or misread tables.
- English Overviews on Google search only. PDFs, video, and pages behind logins or paywalls get "Couldn't check."
- Google changes its markup often. The detector keys on the visible "AI Overview" label and link structure rather than class names, but layout changes can still break sentence or citation mapping.
- The rate limiter and caches are in memory, so on serverless they apply per instance. Swap in a shared store (for example Upstash Redis) for real traffic.

Not affiliated with Google.
