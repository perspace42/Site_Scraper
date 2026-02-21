/**
 * ControlBar.tsx — Extension Control Buttons Component
 *
 * Renders the three action buttons at the top of the sidebar:
 *   ⏸ Pause / ▶ Resume  — toggle the canvas overlay on/off
 *   ⬇ Download TOML     — export the logged elements as captured.toml
 *   🗑 Clear All         — wipe logged elements and canvas overlays
 *
 * All three callbacks are passed in from App.tsx, which holds the
 * authoritative state and performs the browser.tabs.sendMessage calls.
 * ControlBar itself is entirely presentational.
 *
 * Button styling comes from the `.btn`, `.btn-toggle`, `.btn-download`,
 * and `.btn-clear` rules in App.css.
 */

import React from "react";

/** Props accepted by ControlBar. */
interface ControlBarProps {
    /** Whether the content script overlay is currently enabled. */
    enabled: boolean;
    /** Total elements logged — used to disable download/clear when empty. */
    elementCount: number;
    /** Called when the user clicks the Pause / Resume button. */
    onToggle: () => void;
    /** Called when the user clicks the Download TOML button. */
    onDownload: () => void;
    /** Called when the user clicks the Clear All button. */
    onClear: () => void;
}

/**
 * ControlBar
 *
 * Three action buttons in a horizontal flex row.
 * Download and Clear are disabled when no elements have been logged.
 */
export default function ControlBar({
    enabled,
    elementCount,
    onToggle,
    onDownload,
    onClear,
}: ControlBarProps): React.ReactElement {
    /** True when there is nothing logged — used to grey out download/clear. */
    const isEmpty = elementCount === 0;

    return (
        <div className="control-bar">
            {/* ── Toggle button ────────────────────────────────────────────── */}
            {/* Switches between "Pause" (green) and "Resume" (amber) states.  */}
            <button
                className={`btn btn-toggle ${enabled ? "btn-enabled" : "btn-disabled"}`}
                onClick={onToggle}
                title={
                    enabled
                        ? "Disable the overlay and stop logging"
                        : "Re-enable logging"
                }
            >
                {enabled ? "⏸ Pause" : "▶ Resume"}
            </button>

            {/* ── Download button ──────────────────────────────────────────── */}
            {/* Triggers TOML serialisation and a file download.
                Disabled until at least one element has been logged.        */}
            <button
                className="btn btn-download"
                onClick={onDownload}
                disabled={isEmpty}
                title={
                    isEmpty
                        ? "No elements logged yet"
                        : `Download ${elementCount} element(s) as captured.toml`
                }
            >
                ⬇ Download TOML
            </button>

            {/* ── Clear button ─────────────────────────────────────────────── */}
            {/* Wipes all logged elements from state and from the canvas.
                Disabled when there is nothing to clear.                    */}
            <button
                className="btn btn-clear"
                onClick={onClear}
                disabled={isEmpty}
                title="Remove all logged elements"
            >
                🗑 Clear All
            </button>
        </div>
    );
}
