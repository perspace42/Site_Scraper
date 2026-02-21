/**
 * tomlSerializer.ts — TOML Serialization Utility
 *
 * Uses the FLOSS library `smol-toml` (MIT License) to serialise the logged
 * element list into a valid TOML document that matches the format of
 * Config/example.toml used by Site_Scraper.
 *
 * `smol-toml` is chosen because:
 *  - MIT license (Free, Libre, Open Source Software)
 *  - Pure ESM, eval-free, zero native bindings → works cleanly in browser extensions
 *  - Full TOML 1.0 spec support (both parse AND stringify)
 *  - Tiny footprint (~10 kB), no transitive dependency on any Node.js built-ins
 *  - npm: https://www.npmjs.com/package/smol-toml
 *
 * Output TOML structure mirrors Config/example.toml:
 *
 *   [site]
 *   [[site.url]]       ← initial page URL placeholder
 *
 *   [[site.click]]     ← one table per logged clickable element
 *   name    = "..."
 *   xpath   = "..."
 *   csspath = "..."
 *   idpath  = "..."
 *
 *   [[site.text]]      ← text elements
 *   [[site.image]]     ← image elements
 *   [[site.input]]     ← input elements
 *   [[site.url]]       ← anchor/url elements
 *
 * Only selector fields that are non-empty are written, exactly as the
 * example.toml shows them.
 */

import { stringify } from "smol-toml";
import type { LoggedElement } from "../entrypoints/content";


// ─── Type Alias ───────────────────────────────────────────────────────────────

/**
 * Internal representation of a single site element as a TOML-compatible
 * JavaScript object (plain key→value). smol-toml's stringify() accepts
 * a plain JS object whose values may be strings, numbers, booleans, arrays,
 * or nested objects. undefined values must be filtered out before passing.
 */
type TomlElementRecord = Record<string, string>;

// ─── Build TOML Object ────────────────────────────────────────────────────────

/**
 * Convert an array of LoggedElement objects into the nested JS object
 * structure that @iarna/toml can serialise.
 *
 * The site URL (current tab's href) is used as the `address` field of the
 * first [[site.url]] entry, matching the example.toml convention.
 *
 * @param elements  – array of elements captured by the content script
 * @param pageUrl   – the URL of the page that was scraped (optional)
 * @returns         – a TOML document string (UTF-8)
 */
export function buildTomlString(
    elements: LoggedElement[],
    pageUrl?: string
): string {
    // Build the top-level object that smol-toml will serialise.
    // Each `[[site.X]]` array becomes `site.X: Array<Record<…>>`.
    const siteObj: Record<string, TomlElementRecord[]> = {
        url: [],  // [[site.url]]
        click: [],  // [[site.click]]
        text: [],  // [[site.text]]
        image: [],  // [[site.image]]
        input: [],  // [[site.input]]
        list: [],  // [[site.list]] (unused by this tool, reserved for manual edit)
    };

    // First [[site.url]] entry is the base page URL (matches example.toml).
    siteObj.url.push({
        name: "captured_page",
        address: pageUrl ?? window.location.href,
    });

    // Iterate every logged element and push into the appropriate bucket.
    for (const el of elements) {
        // Build the record — only include a selector key if it has a non-empty value.
        // smol-toml does not accept undefined values, so we filter them out explicitly.
        const record: TomlElementRecord = Object.fromEntries(
            Object.entries({
                name: el.tag + (el.textSnippet ? `: ${el.textSnippet}` : ""),
                xpath: el.xpath,
                idpath: el.idpath,
                csspath: el.csspath,
                // Exclude any key whose value is an empty string.
            }).filter(([, v]) => v !== "")
        ) as TomlElementRecord;

        // Route to the correct TOML sub-table based on element type.
        switch (el.elementType) {
            case "click": siteObj.click.push(record); break;
            case "text": siteObj.text.push(record); break;
            case "image": siteObj.image.push(record); break;
            case "url": siteObj.url.push(record); break;  // second+ [[site.url]] entries
            case "input": siteObj.input.push(record); break;
            default: siteObj.text.push(record); break;
        }
    }

    // Remove empty buckets (e.g. no images found) so the TOML isn't cluttered.
    for (const key of Object.keys(siteObj)) {
        if (siteObj[key].length === 0) delete siteObj[key];
    }

    // Wrap in the top-level `site` table as required by Config/example.toml.
    const document = { site: siteObj };

    // Use smol-toml's named stringify() to produce a spec-compliant TOML 1.0 string.
    // stringify() is synchronous and returns a UTF-8 encoded string.
    // We cast through `unknown` because smol-toml's type narrowing is strict;
    // the runtime values are all valid TOML primitives (strings and arrays).
    return stringify(document as unknown as Parameters<typeof stringify>[0]);
}

// ─── File Download Helper ─────────────────────────────────────────────────────

/**
 * Trigger a browser "Save file" download for the given content.
 *
 * Creates a temporary <a> element with a blob: URL, clicks it programmatically,
 * then immediately revokes the URL to avoid memory leaks.
 *
 * @param content  – the TOML string to save
 * @param filename – suggested filename shown in the save dialog
 */
export function downloadToml(content: string, filename = "captured.toml"): void {
    // Encode as UTF-8 blob with the TOML MIME type.
    const blob = new Blob([content], { type: "application/toml; charset=utf-8" });
    const url = URL.createObjectURL(blob);

    // Create a hidden <a> and trigger a click to start the download.
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Free the object URL after a short delay (so the download can start).
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
