# Live Updates Demo

This example demonstrates **live content** — markdown that streams in over
time, the way an LLM agent's reasoning or a long-running job's log output
might arrive in a real XMPro app.

> [!TIP]
> Click **"Start streaming"** in the toolbar above to simulate `onDataChanged`
> being called with growing content. The viewer re-renders incrementally as
> new paragraphs arrive, mirroring what would happen in a live deployment.

In a real XMPro deployment, this content would come from a **Data Source**
bound to the metablock — perhaps a database query that returns the agent's
running thought log, or a webhook endpoint that pushes status updates as a job
progresses.

The viewer doesn't care where the content comes from. As long as the host
calls `onDataChanged(data, changes)` with an array containing a `markdown`
field, the viewer reconciles the new content and re-renders.

For best results with streaming content, keep individual updates small enough
that the re-render feels instantaneous. The viewer hashes content to avoid
re-rendering identical input, so duplicate calls are cheap.
