# Video Notes Overlay

A lightweight floating overlay notes panel for YouTube and Bilibili that works even in fullscreen, staying on top of the player UI.

## Features
1. Floating overlay panel that stays above the video UI (even in fullscreen)
2. Quick timestamped notes while watching videos
3. Copy all notes in one click (includes video title + URL)
4. Export notes
5. English/Chinese UI toggle
6. Toolbar button to enable/disable the UI

## Install (Local)
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Click “Load unpacked”
4. Select this project directory

## Usage
1. Open a YouTube or Bilibili video page
2. The notes panel appears on the right
3. Use the header button to collapse/expand
4. Click the toolbar icon to enable/disable the UI

## Development
1. After changes, click “Reload” on the extensions page
2. Refresh the video page if the UI does not update

## Structure
1. `manifest.json` Extension config
2. `src/content.js` Main logic and UI
3. `src/content.css` Styles
4. `src/background.js` Service worker
5. `options.*` Options page
