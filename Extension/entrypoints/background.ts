/**
 * background.ts — Background Service Worker
 *
 * Responsibilities:
 *  1. Register the "Change logging mode" right-click context menu on install.
 *  2. When the context menu item is clicked, forward a `changeLoggingMode`
 *     message to the content script running in the active tab so it can
 *     update the preferred selector for the most recently right-clicked element.
 *  3. Enable the Chrome Side Panel for every tab so users can open the sidebar.
 *
 * WXT auto-discovers this file because it lives in entrypoints/ and exports
 * a `default` object with a `main` method.
 */

export default defineBackground(() => {
    // ─── Context Menu Setup ─────────────────────────────────────────────────────

    /**
     * Register a single context menu item when the extension is first installed.
     * We use `browser.runtime.onInstalled` so this only runs once, avoiding
     * "duplicate ID" errors on service worker restarts.
     */
    browser.runtime.onInstalled.addListener(() => {
        browser.contextMenus.create({
            // Unique identifier used to recognise this item in onClicked handler.
            id: "changeLoggingMode",

            // Human-readable label shown in the browser's right-click menu.
            title: "Change logging mode",

            // Only show this item when the user right-clicks on a page element
            // (not on images, links, selections, etc. exclusively — `page` covers all).
            contexts: ["page", "link", "image", "selection"],
        });
    });

    // ─── Context Menu Click Handler ──────────────────────────────────────────────

    /**
     * When the user clicks "Change logging mode" in the context menu,
     * relay the command to the content script in the active tab.
     *
     * The content script tracks which element was most recently right-clicked
     * (via the contextmenu DOM event) and will cycle its logging mode when
     * it receives this message.
     */
    browser.contextMenus.onClicked.addListener((info, tab) => {
        if (info.menuItemId !== "changeLoggingMode") return;
        if (!tab?.id) return;

        // Send message to the content script; it will handle the mode rotation.
        browser.tabs
            .sendMessage(tab.id, { type: "changeLoggingMode" })
            .catch((err) => {
                // Content script may not be loaded on certain special pages (e.g. chrome://).
                // Silently swallow the error to avoid polluting the service worker log.
                console.warn("[Site Scraper Logger] Could not reach content script:", err);
            });
    });

    // ─── Side Panel ──────────────────────────────────────────────────────────────

    /**
     * Enable the Chrome side panel for every tab.
     * Without this call the side panel icon in the toolbar remains disabled.
     */
    browser.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: true })
        .catch((err) => {
            // Older Chrome builds may not support setPanelBehavior; ignore gracefully.
            console.warn("[Site Scraper Logger] setPanelBehavior failed:", err);
        });
});
