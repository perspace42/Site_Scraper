/**
 * App.tsx — Sidebar Root Component (Orchestrator)
 *
 * App is the single source of truth for all sidebar state. Its only job is:
 *   1. Own state: logged elements array, enabled flag, right-click target ref
 *   2. Load and persist state via browser.storage.local
 *   3. Listen for runtime messages from the content script
 *   4. Define event handlers (toggle, download, clear, cycleMode, remove)
 *   5. Hand all state + callbacks to <UI> for rendering
 *
 * Visual layout is delegated entirely to UI.tsx (./components/UI).
 * Every style rule lives in App.css.
 */

import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
} from "react";

// ── Type imports ──────────────────────────────────────────────────────────────
import type { LoggedElement, LoggingMode } from "../content";

// ── Utility imports ───────────────────────────────────────────────────────────
import { buildTomlString, downloadToml } from "../../utils/tomlSerializer";

// ── UI import — single entry-point for all visual components ─────────────────
import UI from "./components/UI";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Shape of the data persisted to browser.storage.local.
 * Keeps the sidebar's element list and enabled state between opens.
 */
interface AppState {
    /** All logged elements in insertion order (newest first). */
    elements: LoggedElement[];
    /** Whether the content script overlay was enabled when the sidebar closed. */
    extensionEnabled: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** storage.local key used to persist AppState. */
const STORAGE_KEY = "siteScraper_loggedElements";

/**
 * Rotation order for selector logging modes.
 * Cycling wraps around: xpath → csspath → idpath → xpath → …
 */
const MODE_ORDER: LoggingMode[] = ["xpath", "csspath", "idpath"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return the next available logging mode for `element`, skipping any mode
 * whose selector string is empty (e.g. idpath when the element has no id).
 *
 * Always falls back to "xpath" because xpath is always computed.
 */
function nextMode(element: LoggedElement): LoggingMode {
    const currentIdx = MODE_ORDER.indexOf(element.activeMode);
    for (let i = 1; i <= MODE_ORDER.length; i++) {
        const candidate = MODE_ORDER[(currentIdx + i) % MODE_ORDER.length];
        if (candidate === "xpath" && element.xpath) return "xpath";
        if (candidate === "csspath" && element.csspath) return "csspath";
        if (candidate === "idpath" && element.idpath) return "idpath";
    }
    return "xpath";
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * App — Root sidebar component.
 *
 * Manages all state and side-effects; delegates every visual concern to the
 * components imported above.
 */
export default function App(): React.ReactElement {
    // ── State ──────────────────────────────────────────────────────────────────

    /** Logged elements, newest first. */
    const [elements, setElements] = useState<LoggedElement[]>([]);

    /** Whether the content script canvas overlay is currently active. */
    const [enabled, setEnabled] = useState<boolean>(true);

    /**
     * CSS selector of the element most recently right-clicked on the page.
     * Stored as a ref (not state) because changing it must not trigger a render —
     * it's only consulted when a `rotateModeForTarget` message arrives.
     */
    const rightClickTargetRef = useRef<string | null>(null);

    // ── Persistence: load on mount ─────────────────────────────────────────────

    useEffect(() => {
        /**
         * Restore the saved element list and enabled flag from storage.local.
         * This runs once on mount so the sidebar feels persistent across opens.
         */
        browser.storage.local.get(STORAGE_KEY).then((stored) => {
            const data = stored[STORAGE_KEY] as AppState | undefined;
            if (data?.elements) setElements(data.elements);
            if (data?.extensionEnabled !== undefined) setEnabled(data.extensionEnabled);
        });
    }, []);

    // ── Persistence: save on every state change ────────────────────────────────

    useEffect(() => {
        /**
         * Write the current state to storage.local any time elements or
         * the enabled flag change. React batches rapid updates so this
         * won't fire too frequently in practice.
         */
        browser.storage.local.set({
            [STORAGE_KEY]: {
                elements,
                extensionEnabled: enabled,
            } satisfies AppState,
        });
    }, [elements, enabled]);

    // ── Runtime message listener ───────────────────────────────────────────────

    useEffect(() => {
        /**
         * Single message handler for the sidebar's lifetime.
         *
         *  elementLogged        – content script logged a new element
         *  setRightClickTarget  – user right-clicked; record the target's csspath
         *  rotateModeForTarget  – context menu was clicked; cycle that element's mode
         */
        function handleMessage(message: {
            type: string;
            payload?: LoggedElement;
            csspath?: string;
        }): void {
            switch (message.type) {
                case "elementLogged": {
                    if (!message.payload) break;
                    // Prepend so the most recently clicked element is always
                    // at the top of the list without scrolling.
                    setElements((prev) => [message.payload!, ...prev]);
                    break;
                }

                case "setRightClickTarget": {
                    // Record which element the user right-clicked so the
                    // `rotateModeForTarget` case below knows what to update.
                    rightClickTargetRef.current = message.csspath ?? null;
                    break;
                }

                case "rotateModeForTarget": {
                    // Rotate the mode for whichever element csspath was stored above.
                    const targetCss = rightClickTargetRef.current;
                    if (!targetCss) break;
                    setElements((prev) =>
                        prev.map((el) =>
                            el.csspath === targetCss
                                ? { ...el, activeMode: nextMode(el) }
                                : el
                        )
                    );
                    break;
                }
            }
        }

        browser.runtime.onMessage.addListener(handleMessage);
        // Clean up when the component unmounts (e.g. sidebar closed).
        return () => browser.runtime.onMessage.removeListener(handleMessage);
    }, []);

    // ── Handlers (passed as props to child components) ────────────────────────

    /**
     * Toggle the canvas overlay on/off.
     * Sends a `toggleExtension` message to the content script in the active tab,
     * then flips the local `enabled` flag so the UI reflects the new state.
     */
    const handleToggle = useCallback(async () => {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await browser.tabs.sendMessage(tab.id, { type: "toggleExtension" }).catch(() => { });
        }
        setEnabled((prev) => !prev);
    }, []);

    /**
     * Serialize logged elements to TOML (via smol-toml) and download the file.
     * Guard against calling download when the list is empty to avoid an empty file.
     */
    const handleDownload = useCallback(async () => {
        if (elements.length === 0) return;

        // Include the current page URL as the [[site.url]] address.
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        const tomlContent = buildTomlString(elements, tab?.url ?? "");
        downloadToml(tomlContent, "captured.toml");
    }, [elements]);

    /**
     * Clear all logged elements from local state and ask the content script
     * to erase the green "recorded" overlay rectangles from the canvas.
     */
    const handleClear = useCallback(async () => {
        setElements([]);
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id) {
            await browser.tabs.sendMessage(tab.id, { type: "clearElements" }).catch(() => { });
        }
    }, []);

    /**
     * Cycle the logging mode of the element with the given id.
     * Uses `nextMode()` to skip modes with empty selectors.
     */
    const handleCycleMode = useCallback((id: number) => {
        setElements((prev) =>
            prev.map((el) =>
                el.id === id ? { ...el, activeMode: nextMode(el) } : el
            )
        );
    }, []);

    /**
     * Remove a single element from the sidebar list by id.
     * Note: does not erase the canvas overlay for that element because the
     * canvas is managed by the content script and would require a separate
     * message with the element's rect to selectively repaint.
     */
    const handleRemove = useCallback((id: number) => {
        setElements((prev) => prev.filter((el) => el.id !== id));
    }, []);

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <UI
            enabled={enabled}
            elements={elements}
            onToggle={handleToggle}
            onDownload={handleDownload}
            onClear={handleClear}
            onCycleMode={handleCycleMode}
            onRemove={handleRemove}
        />
    );
}
