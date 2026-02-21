/**
 * AppHeader.tsx — Sidebar Header Component
 *
 * Displays the extension's icon, name, and a one-line subtitle.
 * Entirely presentational — receives no props and owns no state.
 * Styling comes from the `.app-header`, `.app-title`, `.app-icon`,
 * and `.app-subtitle` rules in App.css.
 */

import React from "react";

/**
 * AppHeader
 *
 * Fixed banner shown at the top of every sidebar panel render.
 * Intentionally static so React never needs to re-render it.
 */
export default function AppHeader(): React.ReactElement {
    return (
        <header className="app-header">
            <div className="app-title">
                {/* Decorative target emoji used as the extension "logo" */}
                <span className="app-icon">🎯</span>
                <h1>Site Scraper Logger</h1>
            </div>
            <p className="app-subtitle">
                Click elements on the page to record their selectors.
            </p>
        </header>
    );
}
