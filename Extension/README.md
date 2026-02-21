# Site Scraper Logger — Chrome Extension

A Chrome MV3 sidebar extension that lets you visually click DOM elements on any page, log their selectors, and export them as a TOML config file ready for use with Site_Scraper.

---

## Installation (Load Unpacked)

1. Run the build:
   ```
   npm run build
   ```
2. Open Chrome and go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `.output/chrome-mv3` folder

---

## How to Use

### 1. Open the Sidebar
Click the extension icon in the Chrome toolbar — the sidebar panel opens on the right side of the browser.

### 2. Log Elements
- **Hover** over any element on the page — a blue highlight shows what will be selected
- **Click** an element — it turns green and is added to the sidebar list

Each logged element shows its:
- **Tag** and a text snippet
- **Active selector** (`xpath`, `csspath`, or `idpath`)

### 3. Change the Logging Mode
Two ways to switch an element's selector type:
- **Click the mode badge** (`xpath` / `csspath` / `idpath`) directly in the sidebar list to cycle through modes
- **Right-click** an element on the page and choose **"Change logging mode"** from the context menu

### 4. Download as TOML
Click **Download TOML** in the sidebar to export all logged elements as a `.toml` file structured for Site_Scraper:

```toml
[click.button_login]
xpath = "/html/body/div/button"

[url.nav_home]
csspath = "nav > a.home"

[input.search_box]
idpath = "#search"
```

### 5. Toggle the Extension Off
Click **Toggle Off** in the sidebar to disable all highlighting and click capture without unloading the extension. Click again to re-enable.

### 6. Clear Logged Elements
Click **Clear** in the sidebar to remove all logged elements and reset the canvas overlays.

---

## Development

| Command         | Description                              |
|-----------------|------------------------------------------|
| `npm run dev`   | Start dev server with hot reload         |
| `npm run build` | Build production extension to `.output/` |
| `npm run zip`   | Package extension as a distributable zip |

### Project Structure

```
Extension/
├── entrypoints/
│   ├── background.ts        # Service worker — context menu, side panel setup
│   ├── content.ts           # Content script — canvas overlay, selector logic
│   └── sidebar/             # React sidebar panel
│       ├── index.html
│       ├── main.tsx
│       ├── App.tsx
│       └── components/      # UI components (ElementList, ControlBar, etc.)
├── utils/                   # Shared utilities
├── wxt.config.ts            # WXT build configuration
└── .output/chrome-mv3/      # Built extension (load this folder in Chrome)
```
