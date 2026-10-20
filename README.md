# Groundmark

**Google's AI cites its sources. Groundmark reads them.**

Groundmark is a free Chrome extension that checks each sentence of a Google AI Overview against the pages Google cited for it. Every sentence gets a verdict, along with the exact passage from the source behind it and a link that opens the page scrolled to that passage.

**[Add Groundmark to Chrome](https://chromewebstore.google.com/detail/mhfdggfjdiphhboegcnlkaialmmhjodl)** · Requires Chrome 138 or later

It runs entirely on your computer. Verdicts come from Gemini Nano, the language model built into Chrome. There's no server, no account, and nothing to pay.

## Verdicts

| Verdict | Meaning |
| --- | --- |
| ✅ Supported | The cited page says it, or it follows directly. Every number, name, and qualifier matches. |
| ❓ Not found in its source | The cited page doesn't back the specifics. The sentence may be true, but its own citation doesn't show it. |
| ❌ Contradicted by its source | The cited page says something that conflicts with the sentence. |
| ➖ Couldn't check | The source was a PDF, blocked, or missing, so no verdict is given. |

Hover or focus any verdict to see the evidence. Every evidence card also links to **See what the model saw**, a page showing exactly how that sentence was checked: the sources, the passages compared, the prompt sent to the model, its raw answer, and the checks Groundmark applied before showing you anything.

The name comes from *grounding*, the AI term for whether an answer is actually backed by its sources.

## Why it matters

AI Overviews sit above every Google result and link to sources that look like proof. Independent studies keep finding that those sources often don't say what the summary claims:

- An [Oumi analysis](https://oumi.ai/blog/oumis-study-finds-50-of-ai-overviews) of 1,609 Gemini 3 AI Overviews found 52% had at least one claim their cited sources didn't support, and only 39% were both correct and fully supported (April 2026).
- A Washington University in St. Louis study (arXiv:2605.14021, [summary](https://somethinginc.com/blog/ai-citation-doesnt-mean-what-you-think/)) of 98,020 claims across 7,583 Overviews found 11% weren't backed by the source Google attributed them to, and 4.1% were directly contradicted.
- [Pew Research Center](https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/) found people clicked a search result in 8% of visits with an AI summary, versus 15% without one. Fewer clicks means fewer people checking.

## Getting started

1. Install Groundmark from the [Chrome Web Store](https://chromewebstore.google.com/detail/mhfdggfjdiphhboegcnlkaialmmhjodl). A setup page opens automatically.
2. Allow Groundmark to read the pages Google cites.
3. Download Chrome's on-device model if your computer supports it.
4. Search on Google as usual. When an AI Overview appears, each sentence gets a verdict.

Click the Groundmark icon in the toolbar to see the current page's results, check your setup, or turn automatic checking off. Clicking a setup row opens the settings page, where you can stop Groundmark from reading pages and see the model's size and where Chrome stores it.

**The on-device model** needs Windows 10 or 11, macOS 13 or later, Linux, or a Chromebook Plus; at least 22 GB of free disk space; and either a GPU with more than 4 GB of memory or 16 GB of RAM with 4 or more CPU cores. On other computers, Groundmark uses **lite mode**, which matches words and figures instead of reading meaning. Lite mode never claims a contradiction, and every lite result is labeled "Lite check."

## How it works

1. **Find the claims.** When an AI Overview finishes loading, Groundmark splits it into sentences and notes which links Google attached to each one.
2. **Read the sources.** It opens each cited page, without your cookies, and extracts the readable article text.
3. **Find the relevant passages.** Each page is split into short passages, ranked by how many of the sentence's key words and figures they share.
4. **Judge.** Gemini Nano compares the sentence with the best passages and returns a verdict, a quote from the source, and a one-sentence explanation.
5. **Verify the receipt.** The quote is checked word for word against the page. If it doesn't match, the closest real sentence replaces it and confidence drops, so every quote you see exists on the page.
6. **Show it.** A badge appears after each sentence, with the evidence one hover away.

## Privacy and responsible design

- **Nothing leaves your computer** except requests to open the pages Google cited, the same as clicking the links. Your search, the Overview text, and the verdicts stay local.
- **No cookies on page requests**, so sites never see your logged-in accounts.
- **Access only when you allow it.** Reading cited pages needs permission to open websites, so Groundmark asks once, with an explanation, and still runs only on Google search pages. It never opens local-network addresses.
- **Pages can't give orders.** Web pages can hide instructions meant for AI. Source text reaches the model only as labeled data, with an instruction to ignore commands inside it.
- **Confidence is computed, not self-reported.** Small models rate their own certainty poorly, so confidence comes from checks on the evidence.
- **Honest about uncertainty.** "Not found" isn't "false," and unreadable sources get "Couldn't check," never a guess.

The full methodology, including the exact prompt given to the model, is on the Groundmark website's methodology page, and the code that produces it is in [`extension/lib/judge.js`](extension/lib/judge.js).

## Limitations

- It checks whether the cited page supports a sentence, not whether the sentence is true.
- Gemini Nano is a small model. It's less accurate than large cloud models and can be wrong, so treat a verdict as a reason to look closer, not a final answer.
- Lite mode can't understand meaning or detect contradictions.
- It works on English AI Overviews on Google search only. PDFs, video, and pages behind logins or paywalls get "Couldn't check."
- Google changes its page layout often, which can occasionally break how sentences and citations are matched until Groundmark is updated.

## Working on the code

```
extension/   The Chrome extension (no build step). The checker itself is in extension/lib.
web/         The website, including the test page and the methodology page
```

To try a local copy, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose the `extension` folder. To run the tests, run `npm install` and then `npm test` in `web`.

---

Built by Ethan Cooley. Not affiliated with Google.
