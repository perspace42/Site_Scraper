/**
 * UI.tsx — Composite Sidebar Layout Component
 *
 * Acts as the single import surface for App.tsx.
 * Assembles all visual sub-components into a named export so that App.tsx
 * only needs one import line for the rendered UI.
 *
 * Props mirror App.tsx's state / callbacks exactly — UI does no logic of
 * its own; it is a pure layout shell that distributes props downward.
 *
 * Sub-components rendered (in order):
 *   <AppHeader>   — static title banner
 *   <ControlBar>  — pause/resume, download TOML, clear all
 *   <StatusBar>   — live dot indicator + captured count
 *   <ElementList> — scrollable list of <ElementRow> cards (or empty state)
 */

import React from "react";
import type { LoggedElement } from "../../content";

import AppHeader from "./AppHeader";
import ControlBar from "./ControlBar";
import StatusBar from "./StatusBar";
import ElementList from "./ElementList";

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UIProps {
    /** Whether the content-script canvas overlay is currently active. */
    enabled: boolean;
    /** All logged elements, newest first. */
    elements: LoggedElement[];
    /** Toggle the overlay on/off. */
    onToggle: () => void;
    /** Serialize and download as captured.toml. */
    onDownload: () => void;
    /** Clear all logged elements and overlays. */
    onClear: () => void;
    /** Cycle the selector mode for a single element by id. */
    onCycleMode: (id: number) => void;
    /** Remove a single element from the list by id. */
    onRemove: (id: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * UI — Stateless layout shell.
 *
 * Receives all state and callbacks from App.tsx and distributes them to the
 * correct sub-component. Nothing rendered here should hold local state.
 */
export default function UI({
    enabled,
    elements,
    onToggle,
    onDownload,
    onClear,
    onCycleMode,
    onRemove,
}: UIProps): React.ReactElement {
    return (
        <div className="app">
            {/* Static title banner — never re-renders */}
            <AppHeader />

            {/* Pause/Resume, Download TOML, Clear All buttons */}
            <ControlBar
                enabled={enabled}
                elementCount={elements.length}
                onToggle={onToggle}
                onDownload={onDownload}
                onClear={onClear}
            />

            {/* Animated status dot + "N elements captured" count */}
            <StatusBar
                enabled={enabled}
                elementCount={elements.length}
            />

            {/* Scrollable list of ElementRow cards, or empty-state prompt */}
            <ElementList
                elements={elements}
                onCycleMode={onCycleMode}
                onRemove={onRemove}
            />
        </div>
    );
}