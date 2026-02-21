/**
 * ElementRow.tsx — Single Logged-Element Row Component
 *
 * Renders one entry in the sidebar element list. Each row has two sub-rows:
 *
 *  Top row:
 *    [<tag>]  text snippet…              [↻ cycle] [✕ remove]
 *
 *  Bottom row:
 *    [mode-badge]  active-selector-string
 *
 *  Detail panel (always visible below bottom row):
 *    xpath  /html/body/…
 *    css    div.foo > span
 *    id     #some-id             ← only if element has an id
 *
 * The mode badge and the ↻ button both call `onCycleMode(element.id)`,
 * which asks App.tsx to advance this element to the next available selector
 * mode (xpath → csspath → idpath → xpath, skipping any empties).
 *
 * The detail panel is rendered via <SelectorPanel>, which is its own component.
 */

import React from "react";
import type { LoggedElement } from "../../content";
import SelectorPanel from "./SelectorPanel";

/** Props accepted by ElementRow. */
export interface ElementRowProps {
    /** The full data for this logged element. */
    element: LoggedElement;
    /** Called with the element's id when the user wants to cycle its mode. */
    onCycleMode: (id: number) => void;
    /** Called with the element's id when the user wants to remove it. */
    onRemove: (id: number) => void;
}

/**
 * ElementRow
 *
 * Receives a single `LoggedElement` and two callbacks.
 * Uses React.memo to skip re-renders when neither the element data
 * nor the callbacks have changed reference — important for large lists.
 */
const ElementRow = React.memo(function ElementRow({
    element,
    onCycleMode,
    onRemove,
}: ElementRowProps): React.ReactElement {
    /**
     * Resolve the active selector string based on the element's current mode.
     * Falls back to an empty string when idpath is selected but absent.
     */
    const activeSelector =
        element.activeMode === "xpath"
            ? element.xpath
            : element.activeMode === "csspath"
                ? element.csspath
                : element.idpath;

    return (
        <div className="element-row">
            {/* ── Top row ─────────────────────────────────────────────────── */}
            <div className="element-row-top">
                {/* HTML tag label, e.g. <button> */}
                <span className="element-tag">&lt;{element.tag}&gt;</span>

                {/* First 60 chars of the element's visible text */}
                <span className="element-snippet" title={element.textSnippet}>
                    {element.textSnippet || <em>no text</em>}
                </span>

                {/* Action buttons (right-aligned via flexbox in App.css) */}
                <div className="element-actions">
                    {/* Cycle mode button — advances xpath → csspath → idpath */}
                    <button
                        className="btn-icon"
                        onClick={() => onCycleMode(element.id)}
                        title="Cycle logging mode (xpath → csspath → idpath)"
                    >
                        ↻
                    </button>

                    {/* Remove button — deletes the row from the sidebar list */}
                    <button
                        className="btn-icon btn-remove"
                        onClick={() => onRemove(element.id)}
                        title="Remove from list"
                    >
                        ✕
                    </button>
                </div>
            </div>

            {/* ── Bottom row ──────────────────────────────────────────────── */}
            <div className="element-row-bottom">
                {/*
                 * Mode badge — clicking it also cycles the mode.
                 * Styled in App.css with .mode-xpath/.mode-csspath/.mode-idpath
                 * to give each mode a distinct colour.
                 */}
                <span
                    className={`mode-badge mode-${element.activeMode}`}
                    onClick={() => onCycleMode(element.id)}
                    title="Click to cycle to next selector mode"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && onCycleMode(element.id)}
                >
                    {element.activeMode}
                </span>

                {/* The active selector string — truncated by CSS overflow:ellipsis */}
                <span className="element-selector" title={activeSelector}>
                    {activeSelector || (
                        <em className="no-selector">not available</em>
                    )}
                </span>
            </div>

            {/* ── Selector detail panel ────────────────────────────────────── */}
            {/*
             * Shows all three selector strings at once for quick comparison.
             * Only rendered when at least one selector exists.
             * Moved into <SelectorPanel> to keep this component focused.
             */}
            {(element.xpath || element.csspath || element.idpath) && (
                <SelectorPanel
                    xpath={element.xpath}
                    csspath={element.csspath}
                    idpath={element.idpath}
                />
            )}
        </div>
    );
});

export default ElementRow;
