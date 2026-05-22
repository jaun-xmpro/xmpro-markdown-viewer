# Backgrounds

Eleven background styles ship with the viewer. Set `background` in Value
Mapping. All backgrounds adapt to the current theme by referencing CSS
custom properties, and all respect `prefers-reduced-motion`.

| Name | Visual | Technique | Best for |
|------|--------|-----------|----------|
| `solid` | flat single color | `--bg-primary` | Default. Minimal, content-focused. |
| `gradient` | subtle top-to-bottom fade | `linear-gradient(--bg-primary → --bg-secondary)` | Adds depth without distraction. |
| `xmpro` | XMPro brand gradient | `linear-gradient(--xmpro-dark-blue → mid-tone)` plus radial highlights | Brand-forward dashboards. Forces white text. |
| `dots` | repeating dot pattern | `radial-gradient` 1px dots on 20px grid, faded | Engineering / blueprint feel. |
| `grid` | engineering grid lines | crossed `linear-gradient` lines, soft mask fade | Schematic / technical look. |
| `paper` | subtle texture | inline SVG fractal noise | Long-form reading. |
| `glass` | frosted glass card | `backdrop-filter: blur(...)` over a soft mesh | Modern, premium feel. Content sits on a translucent card. |
| `mesh` | static colored mesh | layered `radial-gradient`s in brand hues | Soft color without intrusion. |
| `aurora` | slow animated mesh | animated gradient + 50px blur, 20s loop | Hero / landing surfaces. Animation freezes on `prefers-reduced-motion`. |
| `image` | custom background image | `background-image` + theme overlay (configurable opacity) | Custom branding. Use `background_image_url` and `background_overlay`. |
| `none` | transparent | inherits XMPro page | Embedding inside a styled host. |

## Notes

- **Text contrast**: `xmpro` is the only background that overrides theme
  tokens (it forces high-contrast white text and translucent code surfaces
  because the gradient is dark and saturated). All other backgrounds keep
  the theme's text colors intact.

- **Performance**: `aurora` animates a gradient + blur. Modern GPUs handle
  this fine, but on very low-power devices you may prefer `mesh` for a
  similar look without animation. `prefers-reduced-motion: reduce` disables
  the animation automatically.

- **Glass**: Requires `backdrop-filter` support (~95% of browsers as of 2026).
  On unsupported browsers it falls back to a translucent solid.

- **Image**: When using `background="image"`, set `background_image_url` to
  any reachable URL. The `background_overlay` value (0–1) controls how
  strongly the theme color washes over the image — set to `0` for full
  image visibility, `1` for full overlay. Default is `0.55`.

## Choosing a background

| If you want… | Try… |
|---|---|
| Maximum readability, no distraction | `solid` or `gradient` |
| Brand-forward look | `xmpro` |
| Technical / engineering aesthetic | `dots` or `grid` |
| Warm, document-like feel | `paper` |
| Modern card-on-blur look | `glass` |
| Soft, decorative color | `mesh` |
| Eye-catching hero surface | `aurora` |
| Custom imagery | `image` with appropriate `background_overlay` |
| Seamless embedding | `none` |
