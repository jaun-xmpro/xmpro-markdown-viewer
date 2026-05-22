# Harness — local preview

A self-contained showcase for the XMPro Markdown Viewer metablock. Loads the
metablock in an iframe and provides live controls for every customization
option, plus a postMessage log for inspecting the inter-iframe protocol.

## Prerequisites

- **Node.js 18+** ([nodejs.org](https://nodejs.org/))

No external dependencies required — the server uses only Node built-ins.

## Run

```bash
cd harness
npm start
```

Then open <http://localhost:3000>.

To run on a different port:

```bash
PORT=8080 npm start
```

## What to try

1. Click through each example in the left sidebar.
2. Cycle through every background style in the toolbar — try `aurora`,
   `mesh`, and `glass` against both light and dark themes.
3. Toggle the **Table of contents** checkbox, then cycle TOC position
   (left / right / top / floating).
4. Turn on **Math** and view example 03; the metablock fetches KaTeX on demand.
5. Turn on **Diagrams** and view example 04; the metablock fetches Mermaid on demand.
6. Load example 06 ("Live updates") and click **▶ Start streaming** to see
   the metablock re-render incrementally as content arrives.
7. Click **⌗ Log** to expose the postMessage log. Interact with the
   metablock — every event in both directions appears.

## Architecture

```
harness/index.html         Showcase UI (toolbar, sidebar, iframe slot)
harness/harness.css        Chrome styles (intentionally separate from metablock)
harness/harness.js         Drives the iframe via postMessage
harness/server.js          Static file server, ~80 lines, zero deps
harness/examples/*.md      Eight curated example documents
```

The harness has **no special knowledge of the metablock's internals** beyond
the documented postMessage protocol (`markdown:set-content`,
`markdown:set-theme`, `markdown:set-background`, `markdown:update-config`,
`markdown:scroll-to` outbound; `markdown:ready`, `markdown:loaded`,
`markdown:link-clicked`, `markdown:heading-clicked`, `markdown:scroll-progress`
inbound). The same protocol works in production — sibling metablocks can
drive the viewer the same way the harness does.
