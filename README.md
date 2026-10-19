# Groundmark

**Google's AI cites its sources. Groundmark reads them.**

Groundmark is a free Chrome extension that checks each sentence of a Google AI Overview against the pages Google cited for it. Every sentence gets one of four verdicts, with the exact passage from the source that backs it up (or doesn't) and a link that opens the page scrolled to that passage.

**[Add Groundmark to Chrome](https://chromewebstore.google.com/detail/mhfdggfjdiphhboegcnlkaialmmhjodl)** · Chrome 138 or later

It runs entirely on your computer. Verdicts come from **Gemini Nano**, the language model built into Chrome. There's no server, no account, no API key, and nothing to pay.

| Verdict | Meaning |
| --- | --- |
| ✅ Supported | The cited page says it, or it follows directly. Every number, name, and qualifier matches. |
| ❓ Not found in its source | The cited page doesn't back the specifics. The sentence may be true, but its own citation doesn't show it. |
| ❌ Contradicted by its source | The cited page says something that conflicts with the sentence. |
| ➖ Couldn't check | The source was a PDF, blocked, or missing. No guess is made. |

The name comes from *grounding*, the AI term for whether an answer is actually backed by its sources.

Built by Ethan Cooley for Responsible AI, Duke University AI for Product Innovation (AIPI).

## Why it matters

AI Overviews sit above every Google result and link to sources that look like proof. Independent studies keep finding those sources often don't say what the summary claims:

- An [Oumi analysis](https://oumi.ai/blog/oumis-study-finds-50-of-ai-overviews) of 1,609 Gemini 3 AI Overviews found 52% had at least one claim their cited sources didn't support, and only 39% were both correct and fully supported (April 2026).
- A Washington University in St. Louis study (arXiv:2605.14021, [summary](https://somethinginc.com/blog/ai-citation-doesnt-mean-what-you-think/)) of 98,020 claims across 7,583 Overviews found 11% weren't backed by the source Google attributed them to, and 4.1% were directly contradicted.
- [Pew Research Center](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/) found people clicked a search result in 8% of visits with an AI summary, versus 15% without one. Fewer clicks means fewer people checking.

## What's in this repo

```
groundmark/
├── extension/              Chrome extension (Manifest V3, no build step)
│   ├── content.js          Finds the Overview, splits sentences, maps citations, shows verdicts
│   ├── background.js       Routes checks from Google pages to the offscreen checker
│   ├── offscreen.*         Runs the checker: fetches pages, extracts text, runs Gemini Nano
│   ├── setup.*             First-run setup: page access and the on-device model download
│   ├── popup.*             Tally for the current tab, setup status, settings
│   ├── lib/                The checker itself (shared with the website and the tests)
│   │   ├── checker.js      Orchestration, URL safety, caching
│   │   ├── judge.js        Gemini Nano judge, lite judge, computed confidence
│   │   ├── extract.js      Readable text from HTML (Mozilla Readability, vendored)
│   │   ├── passages.js     Passage windows and BM25 ranking
│   │   ├── quote.js        Verbatim quote checks and text-fragment links
│   │   └── text.js         Sentences, tokens, numbers (including number words)
│   └── eval/               Developer-only evaluation page and labeled cases
└── web/                    Static Next.js site (deploys free on Vercel)
    ├── app/page.tsx        Landing page
    ├── app/lab/            Test page with the structure of an AI Overview
    ├── app/privacy/        Privacy policy (needed for the Chrome Web Store listing)
    ├── components/TryIt    "Check a claim right here," running the extension's checker in the browser
    ├── tests/              Unit tests (vitest) for extension/lib
    └── scripts/            Builds the store-ready extension zip
```

## How it works

1. **Find the claims.** The content script waits for the AI Overview to finish streaming, splits it into sentences, and records which links Google attached to each one: the link right after a sentence first, then its paragraph's links, then the Overview's source list as a last resort (the evidence card says which).
2. **Read the sources.** An offscreen document opens each cited page without cookies and extracts the readable article text with Mozilla Readability.
3. **Find the relevant passages.** Each page is split into overlapping three-sentence passages and ranked against the claim with BM25, with a bonus for matching numbers (spelled-out numbers count too).
4. **Judge.** Gemini Nano reads the claim and the top passages and returns a verdict, a quote, and a one-sentence explanation, constrained to a JSON schema. Each claim runs in a fresh clone of a session primed with instructions and two worked examples.
5. **Verify the receipt.** The quote is checked against the source text. If it isn't verbatim, the closest real sentence replaces it and confidence drops. Users only ever see text that exists on the page.
6. **Show it.** Badges appear after each sentence. Sentences are marked with the CSS Custom Highlight API, so Google's DOM is never rewrapped. Hovering or focusing a badge opens an evidence card in a shadow root, with a [text fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Reference/Fragment/Text_fragments) link to the exact passage.

If Chrome's model isn't available on a computer, the extension falls back to **lite mode**: word and figure matching that never claims a contradiction, labeled "Lite check" everywhere it appears.

## Responsible design choices

- **Nothing leaves the computer** except requests to open the pages Google cited, the same as clicking the links. The search query, Overview text, and verdicts stay local.
- **No cookies on page requests** (`credentials: "omit"`), so sites never see the user's logged-in sessions.
- **Permission only when asked.** Reading cited pages needs access to websites, so it's an optional permission requested once from the setup page, with an explanation. The content script still runs only on Google search pages.
- **No local-network requests.** The checker refuses localhost, private and link-local IP ranges, `.local`/`.internal` hosts, non-standard ports, and URLs with credentials, before and after redirects.
- **Pages can't give orders.** Source text reaches the model only as labeled passage data, with an instruction to ignore commands inside it.
- **No invented receipts.** Quotes are verified verbatim against the page before display.
- **Untrusted text never becomes HTML.** Page and model text reach the DOM through `textContent` only.
- **Confidence is computed, not self-reported.** Small models rate their own certainty poorly, so confidence comes from whether the quote is verbatim and whether the verdict agrees with simple word overlap.
- **Uncertainty is explicit.** "Not found" is not "false." Unreadable sources get "Couldn't check," never a guess.

## Install

Install from the [Chrome Web Store](https://chromewebstore.google.com/detail/mhfdggfjdiphhboegcnlkaialmmhjodl). A setup page opens automatically: allow Groundmark to read the pages Google cites, and download Chrome's on-device model if your computer supports it. Then search on Google as usual.

## Run it locally

Requirements: Node 20+ and Chrome 138 or later.

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Load the extension:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select the `extension/` folder.
3. A setup tab opens. Click **Allow reading cited pages**, then **Download the model** if your computer supports it.
4. Open http://localhost:3000/lab, or search on Google for something that shows an AI Overview.

The on-device model needs Windows 10/11, macOS 13+, Linux, or a Chromebook Plus; at least 22 GB of free disk space; and either a GPU with more than 4 GB of memory or 16 GB of RAM with 4+ CPU cores. You can check its status at `chrome://on-device-internals`.

## Deploy the website

The site is fully static, so it's free on Vercel's Hobby plan.

1. Push this repo to GitHub.
2. In Vercel, import the repo and set **Root Directory** to `web`. Leave "Include files outside the root directory" on: the site uses `../extension/lib` and the build packages `../extension`.
3. Optional: set `SITE_URL` (for example `https://overviewcheck.app`) so the packaged extension also runs on your deployed lab page. Otherwise the Vercel production URL is used.
4. Deploy. The download button serves `/groundmark-extension.zip`.

## Publish to the Chrome Web Store

Listing: https://chromewebstore.google.com/detail/mhfdggfjdiphhboegcnlkaialmmhjodl (item ID `mhfdggfjdiphhboegcnlkaialmmhjodl`).

`npm run package-extension` (also run by every build) writes `web/public/groundmark-extension.zip`, ready to upload:

- `manifest.json` at the top level of the zip
- development-only matches (`localhost`, `*.vercel.app`) removed, your own lab page added if `SITE_URL` is set
- the evaluation page left out

For the listing:

- **Privacy policy:** `https://<your-site>/privacy`
- **Single purpose:** Checks whether the pages cited by Google AI Overviews support each sentence of the Overview.
- **Permission justifications:**
  - `storage`: saves settings and per-tab verdict counts.
  - `offscreen`: parses cited pages and runs Chrome's on-device model in the background.
  - Optional host access (`https://*/*`, `http://*/*`): opens the pages an AI Overview cites so their text can be compared with the Overview. Requested only after the user clicks Allow. Requests are sent without cookies.
- **Data use:** The extension handles website content (the Overview text and cited pages) locally. Nothing is collected or transmitted to the developer.
- **Remote code:** none.

## Test and evaluate

```bash
cd web
npm test        # unit tests for extension/lib: URL safety, parsing, ranking, quotes, judges, end-to-end checker
```

To measure accuracy with the real model, open `chrome-extension://<extension id>/eval/eval.html` (find the ID on `chrome://extensions`). It runs the labeled cases in `extension/eval/cases.json` through the same checker, on your computer, and reports accuracy, a confusion matrix, and precision for "contradicted" (false alarms are the costliest error). The starter set has 13 rows; grow it to 200+ by reading pages yourself and recording what they actually say.

## Limitations

- It checks whether the cited page supports a sentence, not whether the sentence is true.
- Gemini Nano is a small model. It's less accurate than large cloud models and can be wrong; treat a verdict as a reason to look, not a final answer.
- Computers that can't run the on-device model get lite mode, which can't understand meaning or detect contradictions.
- English Overviews on Google search only. PDFs, video, and pages behind logins or paywalls get "Couldn't check."
- Google changes its markup often. The detector keys on the visible "AI Overview" label and link structure rather than class names, but layout changes can still break sentence or citation mapping.

Not affiliated with Google.
