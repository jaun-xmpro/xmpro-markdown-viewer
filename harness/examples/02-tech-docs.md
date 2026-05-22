# XMPro Metablock SDK Reference

This document demonstrates an API reference layout with a table of contents,
callouts, multi-language code samples, and dense tables — the kind of content
engineers actually need to read.

> [!NOTE]
> Turn on **Table of contents** in the toolbar to see the auto-generated TOC
> with active-section highlighting as you scroll.

## Overview

The XMPro Metablock JavaScript runtime exposes three predefined functions that
the host application calls at well-defined points in the metablock lifecycle.
All three are optional.

| Function | Called when | Frequency |
|----------|-------------|-----------|
| `onValueMappingLoaded(config)` | Static configuration is delivered | Once on load |
| `onDataLoaded(data)` | Initial Data Source payload arrives | Once on load |
| `onDataChanged(data, changes)` | Live data updates arrive | Repeatedly |

## Lifecycle

### Initialization

Metablocks must **not** rely on `DOMContentLoaded`. Instead, perform setup
inside the lifecycle hooks above. Use a `hasInitialized` flag to guard against
duplicate initialization if the host invokes the hook more than once.

```javascript
let hasInitialized = false;

function onValueMappingLoaded(config) {
    if (hasInitialized) return;
    hasInitialized = true;

    applyConfig(config);
    setupListeners();
    renderInitialView();
}
```

### Receiving data

The Data Source hooks receive an **array of records**. Validate the structure
defensively — schema drift is the most common source of metablock bugs.

```javascript
function onDataLoaded(data) {
    if (!Array.isArray(data)) {
        console.warn('Expected array, got', typeof data);
        return;
    }

    const valid = data.filter(record =>
        record &&
        typeof record.id === 'string' &&
        typeof record.value === 'number'
    );

    renderRecords(valid);
}
```

### Live updates

For real-time scenarios, the host calls `onDataChanged` with both the full
current dataset and a `changes` delta. Prefer incremental updates over full
re-renders for performance.

```python
# Equivalent Python data shape, for reference
{
    "data": [
        {"id": "pump-001", "value": 72.5, "ts": "2026-05-22T10:30:00Z"},
        {"id": "pump-002", "value": 81.2, "ts": "2026-05-22T10:30:00Z"},
    ],
    "changes": [
        {"id": "pump-002", "value": 81.2, "ts": "2026-05-22T10:30:00Z"},
    ]
}
```

## Configuration

Configuration arrives as a plain object via `onValueMappingLoaded`. Coerce
types defensively — XMPro Value Mapping can deliver booleans as strings
("true"/"false") and numbers as strings depending on the source binding.

### Example mapping

```json
{
    "theme": "dark",
    "background": "aurora",
    "accent_color": "#00d6ef",
    "enable_toc": true,
    "toc_position": "right",
    "debug": false,
    "log_level": "info"
}
```

### Encrypted variables

> [!IMPORTANT]
> When passing API keys or secrets through Value Mapping, mark the variable as
> **encrypted** in XMPro. The value remains a template until the request is
> proxied through the AD Server. Use it only in `fetch` or `XMLHttpRequest`
> calls, never in computed strings.

```javascript
function onValueMappingLoaded(config) {
    // config.api_key is a template; the AD Server substitutes the
    // decrypted value when the fetch is proxied.
    fetch(config.api_url, {
        headers: { 'Authorization': `Bearer ${config.api_key}` }
    });
}
```

## Inter-metablock communication

Metablocks coordinate via `window.postMessage`. The XMPro convention is a
typed envelope with `source: "xmpro-metablock"`.

### Sending

```javascript
function send(type, data) {
    window.parent.postMessage({
        source: 'xmpro-metablock',
        type, data,
        timestamp: new Date().toISOString(),
        metablockId: MY_ID
    }, '*');
}
```

### Receiving

```javascript
window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg?.source !== 'xmpro-metablock') return;
    if (msg.metablockId === MY_ID) return;  // ignore own messages

    handle(msg.type, msg.data);
});
```

## Security checklist

> [!WARNING]
> Every metablock that renders user-controlled HTML **must** sanitize through
> DOMPurify or an equivalent. Marked's output is HTML, not safe HTML.

> [!CAUTION]
> Never use `dangerouslySetInnerHTML` (or any equivalent) on unsanitized text.
> XSS in a metablock can read messages from sibling metablocks.

| Check | Why |
|-------|-----|
| Sanitize all rendered HTML | Prevent XSS |
| Validate `target` URLs | Prevent `javascript:` and `data:` schemes |
| Set `rel="noopener noreferrer"` on external links | Prevent tabnabbing |
| Avoid inline event handlers | CSP compliance |
| Use encrypted Server Variables for credentials | Prevent leakage |

## SQL example

For metablocks that visualize query results:

```sql
SELECT
    asset_id,
    AVG(temperature_c) AS avg_temp,
    MAX(temperature_c) AS peak_temp,
    COUNT(*) AS samples
FROM telemetry
WHERE recorded_at >= NOW() - INTERVAL '24 hours'
GROUP BY asset_id
HAVING AVG(temperature_c) > 70
ORDER BY avg_temp DESC
LIMIT 20;
```

## Bash quickstart

```bash
# Generate a local test harness for your metablock
python generate_test_harness.py ./my-metablock
cd ./my-metablock
npm install
npm start
# Open http://localhost:3000
```

## Recap

> [!TIP]
> Read `onDataChanged` first when debugging. The data shape is the most common
> source of mismatch between expectations and reality, and the changes delta
> tells you exactly what the host thinks updated.
