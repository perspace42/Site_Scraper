/**
 * SelectorPanel.tsx — All-Selectors Detail Sub-Component
 *
 * Renders the collapsible detail section at the bottom of each ElementRow,
 * showing all three selector strings (xpath / css / id) with their
 * colour-coded labels.
 *
 * Extracted from ElementRow so that ElementRow stays focused on the
 * top-level row layout, and the selector detail has a clear home of its own.
 *
 * This component is only rendered when at least one selector is non-empty.
 */

import React from "react";

/** Props accepted by SelectorPanel. */
interface SelectorPanelProps {
    /** Absolute XPath — always present, never empty. */
    xpath: string;
    /** CSS selector chain — always present, never empty. */
    csspath: string;
    /** "#id" selector — may be empty if element has no id attribute. */
    idpath: string;
}

/**
 * SelectorPanel
 *
 * Displays each available selector on its own labelled line:
 *
 *   xpath  /html/body/div[2]/…
 *   css    body > div > button.submit
 *   id     #submit-btn
 *
 * Labels are colour-coded to match the mode badges in ElementRow:
 *   xpath → blue, css → orange, id → purple  (see App.css)
 */
export default function SelectorPanel({
    xpath,
    csspath,
    idpath,
}: SelectorPanelProps): React.ReactElement {
    return (
        <div className="element-all-selectors">
            {/* XPath row — always shown because xpath is always computed */}
            {xpath && (
                <div className="selector-line">
                    <span className="selector-label xpath-label">xpath</span>
                    <code className="selector-code">{xpath}</code>
                </div>
            )}

            {/* CSS selector row */}
            {csspath && (
                <div className="selector-line">
                    <span className="selector-label css-label">css</span>
                    <code className="selector-code">{csspath}</code>
                </div>
            )}

            {/* ID path row — only shown when the element has an HTML id */}
            {idpath && (
                <div className="selector-line">
                    <span className="selector-label id-label">id</span>
                    <code className="selector-code">{idpath}</code>
                </div>
            )}
        </div>
    );
}
