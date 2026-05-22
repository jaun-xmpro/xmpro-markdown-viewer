# Diagrams with Mermaid

This document exercises **Mermaid** diagrams. As with KaTeX, Mermaid only
loads when `enable_diagrams` is on **and** the content has at least one
```` ```mermaid ```` fenced block. Empty docs pay zero cost.

## Flowchart

A typical metablock initialization flow:

```mermaid
flowchart TD
    A[Page loads] --> B{Value Mapping?}
    B -- yes --> C[onValueMappingLoaded called]
    B -- no  --> D[Wait]
    C --> E[Apply config]
    E --> F{Data Source?}
    F -- yes --> G[onDataLoaded called]
    F -- no  --> H[Render with config only]
    G --> I[Render content]
    H --> I
    I --> J[Listen for updates]
    J -.live update.-> K[onDataChanged]
    K --> I
```

## Sequence

Two metablocks coordinating via `postMessage`:

```mermaid
sequenceDiagram
    participant L as List Metablock
    participant H as XMPro Host
    participant D as Details Metablock

    L->>H: postMessage(asset-selected, {id: 'pump-001'})
    H->>D: forward message
    D->>D: fetchAssetData('pump-001')
    D-->>L: postMessage(data-loaded, {recordCount: 1})
    Note over L,D: Both metablocks now share state
```

## Gantt

A small project plan:

```mermaid
gantt
    title Markdown Viewer rollout
    dateFormat YYYY-MM-DD
    section Build
    CSS foundation       :done,    a1, 2026-05-20, 1d
    HTML shell           :done,    a2, after a1, 1d
    JS renderer          :done,    a3, after a2, 1d
    Example suite        :active,  a4, after a3, 1d
    section Validation
    Local harness QA     :         b1, after a4, 1d
    Lighthouse audit     :         b2, after b1, 1d
    section Deploy
    Upload to XMPro      :         c1, after b2, 1d
    Pilot in one app     :         c2, after c1, 3d
```

## Class diagram

The runtime types involved in rendering:

```mermaid
classDiagram
    class ViewerConfig {
        +string theme
        +string background
        +string font_family
        +number font_size
        +bool enable_toc
        +bool enable_math
        +bool enable_diagrams
    }

    class MarkdownRenderer {
        -ViewerConfig config
        +render(markdown) HTMLElement
        +applyConfig(partial)
        +scheduleRender()
    }

    class MessageBus {
        +send(type, data)
        +on(type, handler)
        -dispatch(message)
    }

    MarkdownRenderer --> ViewerConfig : uses
    MarkdownRenderer --> MessageBus : emits via
```

## State diagram

The metablock lifecycle as a finite state machine:

```mermaid
stateDiagram-v2
    [*] --> Loading
    Loading --> Empty : no content
    Loading --> Rendering : content available
    Rendering --> Idle : render complete
    Idle --> Rendering : config or data changed
    Idle --> Searching : Ctrl+F
    Searching --> Idle : Escape
    Empty --> Rendering : content arrives
    Rendering --> Error : exception thrown
    Error --> Idle : new render succeeds
```

## ER diagram

If your metablock visualizes a relational schema:

```mermaid
erDiagram
    APP ||--o{ PAGE : contains
    PAGE ||--o{ METABLOCK : embeds
    METABLOCK }o--|| DATASOURCE : binds
    METABLOCK }o--o{ VALUEMAPPING : reads
    DATASOURCE ||--o{ RECORD : produces

    METABLOCK {
        string id
        string type
        json config
    }
    DATASOURCE {
        string id
        string connection
        string query
    }
```

## Pie chart

```mermaid
pie title Library weight (gzipped, KB)
    "marked" : 32
    "DOMPurify" : 22
    "Prism core + autoload" : 18
    "KaTeX (lazy)" : 280
    "Mermaid (lazy)" : 600
```

## Notes

> [!TIP]
> Mermaid respects the current viewer theme — it initializes with `theme: 'dark'`
> in dark mode and `'default'` in light mode. The viewer re-renders diagrams
> when you flip the theme so colors and contrast stay consistent.
