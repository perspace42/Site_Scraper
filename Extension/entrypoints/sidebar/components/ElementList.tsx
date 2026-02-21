/**
 * ElementList.tsx — Scrollable Element Log Component
 *
 * Renders the main scrollable area of the sidebar. It either shows:
 *  a) An empty-state prompt when no elements have been logged yet, or
 *  b) A vertical list of <ElementRow> components, most-recent-first.
 *
 * This component deliberately owns no state — it receives `elements` and
 * callbacks as props from App.tsx, which holds the single source of truth.
 * Separating the list from App.tsx also means the empty-state can be
 * tested or restyled independently.
 *
 * Styling: `.element-list`, `.empty-state`, `.empty-icon`, `.empty-hint`
 * rules all live in App.css.
 */

import React from "react";
import type { LoggedElement } from "../../content";
import ElementRow from "./ElementRow";

/** Props accepted by ElementList. */
interface ElementListProps {
    /** All currently logged elements, newest first. */
    elements: LoggedElement[];
    /** Forwarded to each ElementRow — cycles selector mode for that element. */
    onCycleMode: (id: number) => void;
    /** Forwarded to each ElementRow — removes that element from the list. */
    onRemove: (id: number) => void;
}

/**
 * ElementList
 *
 * When `elements` is empty: renders a centred empty-state message with
 * a mouse-cursor emoji and brief instructions.
 *
 * When elements exist: maps each one to an <ElementRow>, keyed by element id
 * so React can efficiently patch the DOM on insertions or removals.
 */
export default function ElementList({
    elements,
    onCycleMode,
    onRemove,
}: ElementListProps): React.ReactElement {
    return (
        <div className="element-list">
            {elements.length === 0 ? (
                /* ── Empty state ─────────────────────────────────────────── */
                /*
                 * Shown until the first element is logged.
                 * Intentionally friendly and instructional rather than a
                 * generic "no data" message.
                 */
                <div className="empty-state">
                    <span className="empty-icon">🖱️</span>
                    <p>Click any element on the page to start logging.</p>
                    <p className="empty-hint">
                        Hover to preview • Right-click → "Change logging mode"
                    </p>
                </div>
            ) : (
                /* ── Element rows ────────────────────────────────────────── */
                /*
                 * Most-recent element is first (App.tsx prepends new items
                 * with `[el, ...prev]`), so the user always sees what they
                 * just clicked without scrolling.
                 */
                elements.map((el) => (
                    <ElementRow
                        key={el.id}
                        element={el}
                        onCycleMode={onCycleMode}
                        onRemove={onRemove}
                    />
                ))
            )}
        </div>
    );
}
