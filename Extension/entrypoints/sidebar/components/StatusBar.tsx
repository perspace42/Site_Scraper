/**
 * StatusBar.tsx — Live Status Indicator Component
 *
 * Shows a pulsing coloured dot and a short human-readable summary:
 *   "Logging active — 3 elements captured"
 *   "Logging paused — 0 elements captured"
 *
 * The dot animation (defined in App.css under `.status-active .status-dot`)
 * only runs when `enabled` is true, matching the behaviour of Brave's
 * element-picker status indicator.
 */

import React from "react";

/** Props accepted by StatusBar. */
interface StatusBarProps {
    /** Whether the content script overlay is currently active. */
    enabled: boolean;
    /** How many elements have been logged so far. */
    elementCount: number;
}

/**
 * StatusBar
 *
 * Purely presentational — all logic lives in App.tsx.
 * Re-renders only when `enabled` or `elementCount` changes.
 */
export default function StatusBar({
    enabled,
    elementCount,
}: StatusBarProps): React.ReactElement {
    return (
        <div className={`status-bar ${enabled ? "status-active" : "status-paused"}`}>
            {/* Animated dot — pulses green when active, static amber when paused */}
            <span className="status-dot" />
            <span>
                {enabled ? "Logging active" : "Logging paused"} —{" "}
                {elementCount} element{elementCount !== 1 ? "s" : ""} captured
            </span>
        </div>
    );
}
