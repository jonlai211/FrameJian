# Video Notes Overlay — Dev Guide

Chrome extension (MV3) that injects a floating, draggable notes panel into YouTube and Bilibili video pages. Notes are timestamped and persisted per video in `chrome.storage.local`.

## Architecture

```
manifest.json          Extension manifest (MV3, permissions: storage only)
src/content.js         All overlay UI + logic injected into video pages
src/content.css        Overlay styles
src/background.js      Service worker: toolbar toggle, icon state
options.html/css/js    Management page: browse/edit/export all saved notes
```

### Storage keys

| Key pattern            | Value                                      |
|------------------------|--------------------------------------------|
| `vno:{platform}:{id}`  | `{ title, url, platform, id, notes[], updatedAt }` |
| `vn:locale`            | `"en"` or `"zh"`                           |
| `vn:enabled`           | `boolean`                                  |

> **Important**: notes use the `vno:` prefix to avoid collisions with settings keys.
> The current code uses `vn:` for everything — this is a known bug (see below).

### Note object shape

```js
{ t: number, text: string, createdAt: number }
// t = video.currentTime in seconds
```

### Platform detection

`getPlatform()` and `getVideoId()` in `content.js` handle YouTube (both `youtube.com/watch?v=` and `youtu.be/`) and Bilibili (`/video/BVxxx`).

SPA navigation is handled by polling `location.href` every 800ms in `tick()`, supplemented by a MutationObserver that detects new `<video>` elements.

## Development workflow

1. Make changes
2. Go to `chrome://extensions` → click **Reload** on this extension
3. Refresh the video tab
4. For background.js changes, reload is enough; for content.js, also refresh the tab

No build step — plain JS, no bundler.

## Known bugs ~~to fix~~

1. ~~**Storage key collision** (`options.js:42`)~~ **Fixed**: filter now checks `Array.isArray(payload?.notes)` so `vn:locale` / `vn:enabled` are excluded.

2. ~~**Duplicate element ID** (`content.js:289`)~~ **Fixed**: removed `editor.id = "vn-input"` from the inline editor textarea.

3. ~~**`waitForVideo` CPU cost**~~ **Fixed**: replaced `requestAnimationFrame` loop with a one-shot MutationObserver that disconnects on first match.

## Style / conventions

- Vanilla JS only, no frameworks, no build tools
- All overlay DOM is scoped under `#vn-root` to avoid leaking into host page
- CSS variables live in `:root` in `content.css`; options page has its own separate set
- `formatTime(seconds)` is duplicated in `content.js` and `options.js` — extract to `src/utils.js` before adding more shared logic
- Strings for EN/ZH live in the `STRINGS` object at the top of `content.js`; add both translations whenever adding UI text

## Planned improvements (prioritized)

- [ ] Dark mode: detect `prefers-color-scheme` / YouTube dark theme, add `--vn-*` dark variants
- [ ] Keyboard shortcuts: `Alt+N` to focus input, `Ctrl+Enter` to save note
- [ ] Collapsed state: show note count badge instead of just the title
- [ ] Options page: make timestamps clickable (open video at that time)
- [ ] Resizable panel width (drag handle on left edge)
- [ ] Note search/filter inside the overlay
- [ ] Import from Markdown (reverse of current export)
