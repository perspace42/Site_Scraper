/**
 * main.tsx — React Entry Point for the Sidebar Panel
 *
 * Bootstraps the React 18 application and mounts it into <div id="root">.
 * This file is intentionally minimal — all application logic lives in App.tsx.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

// Mount the React app.
// React.StrictMode renders every component twice in development to surface
// side-effects, but has no impact on the production bundle.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
