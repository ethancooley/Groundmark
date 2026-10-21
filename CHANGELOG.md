# Changelog

All notable changes to the Groundmark Chrome extension, available on the [Chrome Web Store](https://chromewebstore.google.com/detail/mhfdggfjdiphhboegcnlkaialmmhjodl). Website-only changes aren't listed here.

## 1.0.2 (2026-10-20)

### Added

- **Faster results on slower computers.** Every sentence now gets an instant lite verdict, shown dimmed, and the on-device model's verdict replaces it as each sentence finishes.
- **Automatic switch to lite mode.** If the on-device model is slow on a computer (two sentences over 8 seconds, or one over 20), the rest of that Overview keeps its lite verdicts, and the bar and evidence cards say why. Getting the model ready the first time doesn't count as slow.
- **A choice of how verdicts are made.** The settings page offers Automatic (the default), Always use the on-device model, and Always use lite mode.

## 1.0.1 (2026-10-20)

### Added

- **"See what the model saw."** Every evidence card links to an inspector page that shows how that sentence was checked: the sources, the passages compared, the exact prompt sent to the model, its raw answer, and the checks Groundmark applied before showing a verdict.
- **A settings page.** Turn reading cited pages off and on, see the on-device model's status, size, and where Chrome stores it, and open Chrome's on-device AI page.
- The popup's status rows now open the matching part of the settings page.

### Changed

- **Reads the whole source page.** Groundmark used to keep only what an article extractor (Mozilla Readability) judged to be the main article, which dropped facts on event pages, product pages, and FAQs. It now reads all of a page's text except menus, buttons, scripts, and cookie banners, plus descriptive image text, the page's summary, and its structured data (such as an event's date and place).
- **Matches dates and times written differently.** "November 13th, 10am" on a page now matches "November 13, 10:00 AM" in an Overview. Quotes are still checked word for word against the original text.
- **Skips follow-up questions.** Sentences like "Would you like information on parking or hotels?" are no longer checked. Their links start new searches; they don't cite sources.

### Fixed

- Sentences whose evidence was in a side section of the cited page were marked "Not found in its source."
- Google's follow-up questions at the end of an Overview were marked "Not found in its source."

## 1.0.0 (2026-10-20)

First release.

- Checks each sentence of a Google AI Overview against the pages Google cited for it, with four verdicts: supported, not found in its source, contradicted by its source, and couldn't check.
- Hover or focus a verdict to see the evidence passage, with a link that opens the source scrolled to it.
- Matches each sentence to the links Google attached to it, falling back to the paragraph's links and then the Overview's sources, and says which was used.
- Runs on the computer with Gemini Nano, Chrome's built-in model. There's no server or account, and searches and Overviews never leave the computer.
- Lite mode for computers that can't run the model. It matches words and figures, never claims a contradiction, and labels every result "Lite check."
- Opens cited pages without cookies, and never opens local-network addresses.
- Treats page text as data, not instructions, so hidden instructions on a page can't steer the model.
- Checks every quote word for word against the page, replacing any that don't match with the closest real sentence.
- Computes confidence from checks on the evidence instead of the model's own estimate.
- A setup page on install, and a toolbar popup with the current page's results and an on/off switch for automatic checking.
