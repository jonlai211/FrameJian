# 帧笺 FrameJian

> 边看边笺，随帧成记 — A Chrome extension for timestamped notes and AI summaries on YouTube and Bilibili.

FrameJian floats a frosted-glass panel over the video page so you can capture
moments as you watch, then turn the whole video into a structured AI summary
with clickable timestamps that jump back to the exact frame.

## Features

- **Timestamped notes** — one keystroke (`⌘/Ctrl + Enter`) saves the current
  playback position with whatever you typed
- **AI summary via Gemini** — uses your existing browser session, no API key
  required; streams a markdown summary with `[MM:SS]` timestamp links
- **Per-video library** — notes and summary are saved together per video
  (`vn:{platform}:{id}`) and survive across sessions
- **Collapsible pill** — overlay shrinks into a corner badge so it never
  blocks the player; auto-stays on top in fullscreen too
- **Bilingual UI** — English / 中文, locale shared between overlay and library
  page
- **Library page** — search, filter, view summaries with full markdown render,
  jump to any timestamp in a new tab, bulk export to Markdown
- **Works on** — YouTube (`youtube.com`, `youtu.be`, mobile YouTube) and
  Bilibili (`bilibili.com`)

## Install (Developer Mode)

1. Clone or download this repo
2. Open `chrome://extensions` and enable **Developer mode**
3. Click **Load unpacked** and select the project folder
4. Pin the icon to your toolbar if you want a quick toggle

The toolbar icon toggles the overlay globally; the icon greys out when disabled.

## Usage

### Overlay
- Open any supported video page — the panel slides in from the right
- Type a note → `⌘/Ctrl + Enter` (or click **Save**) to anchor it to the
  current frame
- Click any timestamp pill in the Notes list to seek to that moment
- Switch to **AI Summary** tab → **Summarize** to generate; the result streams
  in and persists for that video forever (or until you delete it)
- Click the book icon in the header to open your full library
- Click the dash icon to collapse to a pill

### Library Page (Options)
- Every saved video gets a card with its real thumbnail, title, platform,
  link, and last-updated time
- Per-card tabs for **Notes** / **AI Summary**
- Search box filters across titles, URLs, note bodies, summary text
- Each card exports its notes + summary as a single Markdown file; the global
  **Export all** stitches everything together

### AI Summary requirements
- Must be signed in to <https://gemini.google.com> in the same browser profile
- YouTube only for now (Gemini's video understanding doesn't reach Bilibili)
- No API key — auth flows through your existing cookies

## Architecture

```
manifest.json              MV3 manifest (storage, tabs, cookies permissions)
src/content.js             Overlay UI + logic injected into video pages
src/content.css            Overlay styles (scoped under #vn-root)
src/background.js          Service worker — toolbar toggle, AI message routing
src/gemini-client.js       Cookie-based Gemini streaming client
options.html               Library page
options.css                Library page styles
options.js                 Library page logic + markdown renderer
icons/                     Brand icons + disabled-state variants
```

Storage layout (`chrome.storage.local`):

| Key                     | Value                                                   |
| ----------------------- | ------------------------------------------------------- |
| `vn:{platform}:{id}`    | `{ title, url, platform, id, thumbnail, notes[], summary?, updatedAt }` |
| `vn:locale`             | `"en"` \| `"zh"`                                        |
| `vn:enabled`            | `boolean`                                               |

A `note` is `{ t: number, text: string, createdAt: number }`.
A `summary` is `{ text: string, updatedAt: number }`.

## Development

No build step — plain JS, no bundler.

1. Make changes
2. Click **Reload** on the extension card in `chrome://extensions`
3. Refresh the video tab (content scripts only re-inject on navigation)
4. Background changes apply on reload; content changes need a tab refresh

The overlay's root DOM is scoped under `#vn-root` to avoid host-page bleed.
Strings live in a single `STRINGS` table at the top of `content.js` and a
parallel one in `options.js`; whenever you add UI text, fill both EN and ZH.

## Design

The UI follows a hand-tuned design system (see `ref/Claude Design Work/` for
the original hi-fi mockups): warm orange accent (`#ff5a3c`), Inter + Noto
Serif SC + JetBrains Mono typography, frosted-glass surfaces.

## License

Not yet decided.
