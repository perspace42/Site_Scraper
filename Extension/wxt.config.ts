import { defineConfig } from "wxt";

// WXT configuration for the Site Scraper Logger extension.
// See https://wxt.dev/api/reference/wxt/functions/defineConfig.html
export default defineConfig({
    modules: ["@wxt-dev/module-react"],

    manifest: {
        // Extension metadata shown in the browser's extensions page.
        name: "Site Scraper Logger",
        description:
            "Click DOM elements to log their selectors (xpath, csspath, idpath) and export as TOML for Site_Scraper.",
        version: "1.0.0",

        // Required permissions:
        //   activeTab      – interact with the current tab's content
        //   storage        – persist logged elements across sidebar opens
        //   contextMenus   – add right-click "Change logging mode" menu item
        //   scripting      – inject the canvas overlay into the active page
        //   sidePanel      – register the sidebar panel (Chrome MV3)
        permissions: [
            "activeTab",
            "storage",
            "contextMenus",
            "scripting",
            "sidePanel",
        ],

        // Allow the content script to run on every HTTP/HTTPS page.
        host_permissions: ["<all_urls>"],

        // Declare the side panel. WXT will overwrite default_path with the
        // source-relative path "sidebar/index.html"; the hook below corrects
        // it to the actual output file "sidebar.html" after generation.
        side_panel: {
            default_path: "sidebar.html",
        },
    },

    // WXT auto-generates side_panel.default_path from the entrypoint source
    // path ("sidebar/index.html"), which does not match the actual output file
    // name ("sidebar.html"). This hook runs after manifest generation and
    // forcibly corrects the path so Chrome can locate the side panel file.
    hooks: {
        "build:manifestGenerated": (_wxt, manifest) => {
            const m = manifest as Record<string, unknown>;
            if (m["side_panel"] && typeof m["side_panel"] === "object") {
                (m["side_panel"] as Record<string, string>)["default_path"] =
                    "sidebar.html";
            }
        },
    },
});
