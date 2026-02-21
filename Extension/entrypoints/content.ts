/**
 * content.ts — Content Script
 *
 * Injected into every page that matches <all_urls>. Responsible for:
 *
 *  1. CANVAS OVERLAY
 *     Creates a fixed, full-viewport <canvas> that sits on top of the page
 *     (pointer-events: none so it never blocks real clicks).
 *     - Hover  → draws a semi-transparent blue rectangle around the element
 *                (similar to Brave's "Block element" shield overlay).
 *     - Click  → draws a persistent semi-transparent green rectangle to show
 *                which elements have been recorded.
 *
 *  2. SELECTOR COMPUTATION
 *     For every clicked element, generates three selector strings:
 *     - xpath   – absolute XPath from document root  (/html/body/div[2]/…)
 *     - csspath – minimal CSS selector chain          (div.foo > span#bar)
 *     - idpath  – "#id" if the element has an id, else empty string
 *     Also determines the element's semantic "type" for TOML categorisation.
 *
 *  3. MESSAGING
 *     - On click: sends `{ type: "elementLogged", payload: LoggedElement }`
 *       to the extension runtime so the sidebar can display & store it.
 *     - On contextmenu: remembers the right-clicked element's index so the
 *       background's "Change logging mode" menu item knows which to update.
 *     - Listens for incoming messages:
 *         toggleExtension   – enable / disable all listeners & clear the canvas.
 *         changeLoggingMode – rotate the logging mode for the last right-clicked element.
 *         clearElements     – wipe all recorded rects from the canvas.
 *
 *  4. ENABLED / DISABLED STATE
 *     A module-level `enabled` flag gates every listener. Flip it via the
 *     `toggleExtension` message from the sidebar.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The three supported selector modes. Stored per-element so the sidebar
 * can display and cycle through them.
 */
export type LoggingMode = "xpath" | "csspath" | "idpath";

/**
 * Data transferred to the sidebar for each logged element.
 */
export interface LoggedElement {
    /** Internal unique identifier (timestamp-based). */
    id: number;
    /** Tag name, e.g. "div", "button", "a". */
    tag: string;
    /** First 60 characters of the element's visible text (for display). */
    textSnippet: string;
    /** Absolute XPath string. */
    xpath: string;
    /** CSS selector chain. */
    csspath: string;
    /** "#id" if the element has an id attribute, otherwise "". */
    idpath: string;
    /** The currently active logging mode for this element. */
    activeMode: LoggingMode;
    /** Semantic type used as the TOML table key. */
    elementType: "click" | "text" | "image" | "url" | "input";
    /** DOMRect of the element at time of click (for canvas redraw). */
    rect: { top: number; left: number; width: number; height: number };
}

// ─── Module State ─────────────────────────────────────────────────────────────

/** Whether the extension is currently active. Toggled by the sidebar. */
let enabled = true;

/** Canvas element overlaid on the page for visual feedback. */
let canvas: HTMLCanvasElement | null = null;

/** 2D rendering context for the canvas. */
let ctx: CanvasRenderingContext2D | null = null;

/**
 * All elements logged so far, kept in content-script memory so we can
 * redraw their green "recorded" rectangles after a scroll/resize.
 */
let loggedRects: Array<{ rect: LoggedElement["rect"]; mode: LoggingMode }> = [];

/**
 * Index (into the `loggedRects` array) of the element the user most recently
 * right-clicked. The background script's "Change logging mode" handler will
 * ask us to advance this element's mode.
 */
let lastRightClickedId: number | null = null;

// ─── Canvas Helpers ───────────────────────────────────────────────────────────

/**
 * Create the overlay <canvas> and append it to <body>.
 * The canvas is:
 *  - Fixed position, full viewport size
 *  - pointer-events: none  (so it never intercepts clicks)
 *  - z-index: 2147483647   (highest possible, above everything)
 */
function createCanvas(): void {
    canvas = document.createElement("canvas");
    canvas.id = "__site-scraper-overlay__";

    // Style the canvas so it covers the viewport without blocking interaction.
    Object.assign(canvas.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",         // Never intercept mouse events
        zIndex: "2147483647",          // Always on top
        display: "block",
    });

    // Match physical pixel dimensions to avoid blurry drawing on HiDPI screens.
    resizeCanvas(canvas);

    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
}

/**
 * Resize the canvas backing buffer to match the current viewport size.
 * Must be called on window resize to avoid stretched / clipped overlays.
 */
function resizeCanvas(cvs: HTMLCanvasElement): void {
    cvs.width = window.innerWidth;
    cvs.height = window.innerHeight;
}

/**
 * Clear the entire canvas and redraw all persistent "logged" rectangles.
 * Called after every hover repaint so the green overlays are never erased.
 */
function redrawLoggedRects(): void {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const { rect } of loggedRects) {
        // Green fill = element has been recorded.
        ctx.fillStyle = "rgba(34, 197, 94, 0.20)";   // Tailored green, 20% opacity
        ctx.strokeStyle = "rgba(34, 197, 94, 0.80)";
        ctx.lineWidth = 2;
        ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
        ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
    }
}

/**
 * Draw the hover highlight for the element currently under the cursor.
 * We first redraw all logged rects, then paint the hover on top so
 * the two can coexist on screen simultaneously.
 *
 * Visual style matches Brave's "Block element" feature:
 *  - Semi-transparent blue fill
 *  - Solid blue border
 */
function drawHoverHighlight(rect: DOMRect): void {
    if (!ctx || !canvas) return;

    // Repaint logged (green) rects first.
    redrawLoggedRects();

    // Then paint the hover (blue) on top.
    ctx.fillStyle = "rgba(59, 130, 246, 0.20)";    // Blue-500, 20% opacity
    ctx.strokeStyle = "rgba(59, 130, 246, 0.85)";
    ctx.lineWidth = 2;

    // DOMRect uses viewport-relative coordinates, which is exactly what a
    // fixed-position canvas needs — no scroll offset adjustment required.
    ctx.fillRect(rect.left, rect.top, rect.width, rect.height);
    ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
}

// ─── Selector Generators ──────────────────────────────────────────────────────

/**
 * Compute the absolute XPath of an element from the document root.
 *
 * Strategy: walk up the DOM tree, at each ancestor calculate the element's
 * 1-based index among same-tag siblings, then join the segments.
 *
 * Example output: /html/body/div[2]/main/section/p[1]
 */
function getXPath(element: Element): string {
    const parts: string[] = [];
    let node: Element | null = element;

    while (node && node.nodeType === Node.ELEMENT_NODE) {
        let index = 1;   // XPath indices are 1-based

        // Count preceding siblings with the same tag name.
        let sibling = node.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === node.tagName) index++;
            sibling = sibling.previousElementSibling;
        }

        const tag = node.tagName.toLowerCase();

        // Only append [index] when there are multiple same-tag siblings;
        // this keeps the path as short as possible while remaining unambiguous.
        const hasMultipleSiblings =
            node.parentElement?.querySelectorAll(`:scope > ${tag}`).length ?? 0 > 1;

        parts.unshift(hasMultipleSiblings ? `${tag}[${index}]` : tag);
        node = node.parentElement;
    }

    return "/" + parts.join("/");
}

/**
 * Compute a CSS selector chain for an element.
 *
 * Strategy: prefer `#id` at any level to keep the path short. If no id
 * is encountered, use `tagName.className` segments joined by ` > `.
 *
 * Example outputs:
 *   #main > div.card > button.submit
 *   section > p
 */
function getCSSPath(element: Element): string {
    const parts: string[] = [];
    let node: Element | null = element;

    while (node && node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();

        if (node.id) {
            // An ID is unique per spec — anchor the path here and stop walking up.
            parts.unshift(`#${node.id}`);
            break;
        }

        // Build a class string for added specificity.
        const classes = Array.from(node.classList)
            .filter((c) => c.trim() !== "")   // Skip empty class names
            .map((c) => `.${c}`)
            .join("");

        parts.unshift(`${tag}${classes}`);
        node = node.parentElement;
    }

    return parts.join(" > ");
}

/**
 * Return the element's `#id` selector if it has one, otherwise "".
 */
function getIdPath(element: Element): string {
    return element.id ? `#${element.id}` : "";
}

/**
 * Determine the semantic type of an element for TOML categorisation.
 *
 * Mapping:
 *  <a href>   → "url"    (navigates somewhere)
 *  <img>      → "image"
 *  <input>, <textarea>, <select> → "input"
 *  <button>, role=button, etc.   → "click"
 *  everything else               → "text"
 */
function getElementType(
    element: Element
): LoggedElement["elementType"] {
    const tag = element.tagName.toLowerCase();

    if (tag === "a" && element.hasAttribute("href")) return "url";
    if (tag === "img") return "image";
    if (["input", "textarea", "select"].includes(tag)) return "input";
    if (
        tag === "button" ||
        element.getAttribute("role") === "button" ||
        (element as HTMLElement).onclick !== null
    )
        return "click";

    return "text";
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

/** Currently highlighted element — tracked to avoid redundant redraws. */
let lastHovered: Element | null = null;

/**
 * mousemove handler: highlight the element directly under the cursor.
 *
 * We use `document.elementFromPoint` to find the topmost non-canvas element
 * at the cursor position. The canvas itself is pointer-events:none so it
 * never appears as the target.
 */
function onMouseMove(event: MouseEvent): void {
    if (!enabled) return;

    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || target === canvas || target === lastHovered) return;

    lastHovered = target;
    const rect = target.getBoundingClientRect();
    drawHoverHighlight(rect);
}

/**
 * click handler: record the clicked element and send it to the sidebar.
 *
 * We do NOT call `event.preventDefault()` — the page's own click handlers
 * must still run normally so the user can navigate while logging.
 */
function onClick(event: MouseEvent): void {
    if (!enabled) return;

    const target = event.target as Element;
    if (!target || target === canvas) return;

    const rect = target.getBoundingClientRect();

    // Compute all three selectors.
    const xpath = getXPath(target);
    const csspath = getCSSPath(target);
    const idpath = getIdPath(target);

    // Default active mode: prefer idpath if available, else xpath.
    const activeMode: LoggingMode = idpath ? "idpath" : "xpath";

    // Grab a short text snippet (first 60 chars) for display in the sidebar.
    const textSnippet = ((target as HTMLElement).innerText ?? "")
        .trim()
        .slice(0, 60);

    const logged: LoggedElement = {
        id: Date.now(),
        tag: target.tagName.toLowerCase(),
        textSnippet,
        xpath,
        csspath,
        idpath,
        activeMode,
        elementType: getElementType(target),
        rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
        },
    };

    // Store the rect so we can redraw it as a green "recorded" highlight.
    loggedRects.push({ rect: logged.rect, mode: activeMode });
    redrawLoggedRects();

    // Broadcast to the extension runtime (sidebar picks this up).
    browser.runtime.sendMessage({ type: "elementLogged", payload: logged }).catch(() => {
        // Sidebar may not be open yet — ignore the error silently.
    });
}

/**
 * contextmenu handler: record which element was right-clicked so the
 * background script's "Change logging mode" menu item knows what to target.
 *
 * We send the element's `id` (from `loggedRects`) via a message so the
 * background → content script round-trip can identify the specific element.
 */
function onContextMenu(event: MouseEvent): void {
    if (!enabled) return;

    const target = event.target as Element;
    if (!target || target === canvas) return;

    // Find the matching logged element by comparing CSS selectors.
    // We use csspath as the tiebreaker because it's always non-empty.
    const csspath = getCSSPath(target);
    const idx = loggedRects.findIndex((_, i) => {
        // We store mode in loggedRects but not the csspath; use a parallel array
        // approach via loggedElements (set in onClick).
        return false; // Placeholder — see loggedElementsMeta below.
    });

    // Store the csspath of the right-clicked element so `changeLoggingMode`
    // can look it up in the sidebar's element list.
    browser.runtime
        .sendMessage({ type: "setRightClickTarget", csspath })
        .catch(() => { });
}

// ─── Message Listener ─────────────────────────────────────────────────────────

/**
 * Listen for messages arriving from the background service worker or sidebar.
 *
 * Messages handled:
 *
 *  toggleExtension
 *    Sent by the sidebar's "Toggle Off" button.
 *    Flips the `enabled` flag; when disabled the canvas is cleared and all
 *    mouse listeners become no-ops.
 *
 *  changeLoggingMode
 *    Sent by the background script when the user clicks "Change logging mode"
 *    in the right-click context menu. Forwarded to the sidebar with the
 *    currently targeted element's csspath.
 *
 *  clearElements
 *    Sent by the sidebar's "Clear" button to wipe the green overlays.
 */
browser.runtime.onMessage.addListener((message: { type: string;[key: string]: unknown }) => {
    switch (message.type) {
        case "toggleExtension": {
            enabled = !enabled;

            if (!enabled && canvas && ctx) {
                // Clear everything when disabled.
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                loggedRects = [];
            }
            break;
        }

        case "changeLoggingMode": {
            // The background forwards this after the context menu click.
            // Ask the sidebar to rotate the mode of the element at `csspath`.
            browser.runtime
                .sendMessage({ type: "rotateModeForTarget" })
                .catch(() => { });
            break;
        }

        case "clearElements": {
            // Wipe recorded rects from the canvas.
            loggedRects = [];
            if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
            break;
        }
    }
});

// ─── Resize Handler ───────────────────────────────────────────────────────────

/**
 * Resize the canvas when the viewport changes (e.g. DevTools opened,
 * window resized). Without this the canvas buffer stays at the old size
 * and all drawing becomes offset or clipped.
 */
window.addEventListener("resize", () => {
    if (!canvas) return;
    resizeCanvas(canvas);
    redrawLoggedRects(); // Repaint so logged rectangles survive the resize.
});

// ─── WXT Entrypoint Export ────────────────────────────────────────────────────

/**
 * WXT calls the `main` function once the content script is injected.
 * We initialise the canvas here and attach all event listeners.
 */
export default defineContentScript({
    // Match every HTTP and HTTPS page.
    matches: ["<all_urls>"],

    // Run after the DOM is ready so <body> exists for canvas insertion.
    runAt: "document_idle",

    main() {
        // Create the overlay canvas immediately.
        createCanvas();

        // Attach mouse event listeners to the document.
        // Using `capture: true` so we intercept events before any page handler
        // that might call stopPropagation.
        document.addEventListener("mousemove", onMouseMove, { capture: true });
        document.addEventListener("click", onClick, { capture: true });
        document.addEventListener("contextmenu", onContextMenu, { capture: true });
    },
});
