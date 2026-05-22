---
title: Welcome to the XMPro Markdown Viewer
author: XMPro
version: 1.0
---

# Welcome

This is the **XMPro Markdown Viewer Metablock** — a polished, configurable markdown reader
designed to live inside any XMPro application page. Use it for release notes, runbooks,
agent reasoning, ticket descriptions, or any other markdown content you want to surface
beautifully and consistently.

## What this example shows

This document exercises the core typography and inline formatting features so you can
get a feel for how the viewer renders ordinary content out of the box. Switch the
**background** in the toolbar above to see how the same content looks against gradient,
glass, mesh, and aurora surfaces.

## Inline formatting

You can write **bold text**, *italic text*, ***both at once***, and ~~strikethrough~~.
Inline `code` looks like this, and you can press <kbd>Ctrl</kbd> + <kbd>F</kbd> to search
within a document at any time.

Links are friendly: visit the [XMPro website](https://xmpro.com) — external links open in
a new tab by default, but that's configurable.

## Lists

Unordered lists are clean:

- Renders any standard CommonMark
- Plus GitHub-flavoured extensions
- Including task lists, tables, and strikethrough
- Sanitized through DOMPurify before display

Ordered lists too:

1. Parse markdown with `marked`
2. Sanitize with `DOMPurify`
3. Highlight code with `Prism.js`
4. Lazily load `KaTeX` and `Mermaid` only when needed

Task lists work — toggle them mentally:

- [x] Configure themes and backgrounds
- [x] Build the harness
- [ ] Deploy to XMPro App Designer
- [ ] Hand off to your users

## A small code sample

```javascript
function greet(name) {
    const message = `Hello, ${name}!`;
    console.log(message);
    return message;
}

greet('XMPro');
```

## A small table

| Feature | Status | Notes |
|---------|--------|-------|
| Themes | Ready | 5 built-in, plus custom accent color |
| Backgrounds | Ready | 11 styles incl. aurora and glass |
| Math | Optional | Lazy-loaded only when used |
| Diagrams | Optional | Lazy-loaded only when used |

## A blockquote

> The best documentation is the documentation people actually read.
> Make it look inviting and they will.

## What to try next

Pick a different example from the sidebar to see more advanced features: technical
documentation with a table of contents, math equations, mermaid diagrams, long-form
articles, and a kitchen-sink document that exercises every feature in one place.
