# App languages

All seven pages share `web/i18n.js` and the same language picker. The picker supports English, Turkish, French, German, Danish, Spanish, Brazilian Portuguese, Indonesian, Arabic, Korean, Japanese, Russian, Vietnamese, Thai, Italian, Polish, Simplified Chinese and Traditional Chinese. It remembers the selected language on this device. A first visit uses a supported browser language, otherwise English.

Translation is presentation only. Player IDs, names, troop inputs, ratios, model results, saved profiles, API requests, JSON backups and CSV column names keep their canonical values. In particular, selecting another language does not rebuild a form or save a profile. Generated results, validation feedback and chat instructions are translated when displayed or copied.

## Updating copy

`web/locales/en.json` is the canonical message inventory. Each other catalog must have the exact same keys. The English message itself is the key. Parameters such as `{0}` must appear with the same count in every translation. Source fragments can cover a composed message, but prefer a complete sentence template when word order matters.

Static paragraphs with inline links or emphasis use `data-i18n-rich`. The `{b0}` markers represent original trusted page tags, including closing tags. Keep their order and pairing. Translations are escaped before these original tags are restored. Do not add tags to a translation.

For new copy, add the English key and all seventeen translations. Use `scripts/i18n-overrides.tsv` for reviewed shared vocabulary and important instructions. The columns are English, Turkish, French, German, Danish, Spanish, Portuguese, Indonesian, Arabic, Korean, Japanese, Russian, Vietnamese, Thai, Italian, Polish, Simplified Chinese and Traditional Chinese. Run `python scripts/build_locales.py` after editing the TSV, then `node tests/check_i18n.cjs`.

The initial catalogs were drafted offline with NLLB (Indonesian uses OPUS-MT), then corrected for the core game vocabulary and Bear instructions. No translation service or model is loaded in the app. Catalogs are served with the static site. Native speakers can improve phrasing directly in the catalogs or TSV without changing the calculations.

## Dynamic content and data

Use `BearI18n.text(english)` for copied text, and `BearI18n.instructions(english)` for Bear setup instructions, which preserve the player-name header. UI text nodes and accessible labels are updated by the shared observer. New messages outside the inventory remain in English rather than blocking the app.

Put `translate="no"` on user-authored names, custom offer names, event labels or other raw text. Textareas, code, preformatted source, player-picker options and member names are excluded by default. Never translate input values, option values, element IDs, enum keys or exported machine-readable data.

Numbers used to compose UI messages are formatted in English first, then localized once by the presentation layer. Clocks, raw IDs and date strings are excluded from this numeric substitution. Dates can use `BearI18n.locale` with Intl. Use the `bear:languagechange` event only for safe read-only redraws; never use it to reset form state.

An incomplete or unavailable language catalog leaves the current page and entries intact and shows a retry message. Rapid switches use a request counter so a slow earlier request cannot replace the newer choice.

## Verification

`node tests/check_i18n.cjs` checks coverage, required names, placeholders, dynamic instructions, number handling and page wiring. The existing model and UI tests must also pass. Browser checks cover language persistence, generated output, input and selection preservation, guide tabs, and phone layouts. Bump the i18n asset version in all pages and the catalog version in `i18n.js` when shipping changes.


## Saved player preference

Optimize Me has an optional explicit `input.preferredLanguage` field. It is separate from the device's viewing language. Blank means not specified; no browser language, name or flag is used to infer a preference. Choices use stable catalog codes, including `zh-CN` and `zh-TW`.

Worker **version 8** (`player-language-preference`) validates and stores the choice inside the existing profile JSON. No schema change or database initialization is needed. Deploy the generated `web/cloudflare-worker.js` from Organizer to the existing Cloudflare Worker. The static website deploy does not update that service.

With an older Worker, troop saves continue normally, the preference stays in the device draft, and the save feedback explicitly says it was not shared online. Old online profiles cannot silently erase a local preference. A saved blank choice on a new Worker explicitly clears the old preference.

The alliance summary counts all current roster members, independently of table search/filter. Successfully checked profiles without a choice are Not specified; failed or pending reads are Not checked. The field follows the existing public profile visibility. Anyone can edit profiles, so members should only update their own.

Arabic sets `dir=rtl` on the page. Numeric inputs, charts, IDs and code remain isolated left to right. Browser language matching distinguishes Traditional (`zh-TW`, `zh-HK`, `zh-Hant`) from Simplified Chinese. Catalogs are machine-drafted with reviewed key instructions; native-player review remains useful.
