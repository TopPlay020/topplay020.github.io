# topplay020 portfolio

Portfolio site for topplay020: custom desktop and web apps in C# / .NET. A low-poly 3D world sits behind the page: as you scroll, the camera walks down a faceted gradient wall while 1,500 triangles shatter and reassemble into a new shape for each section, including each project's real screenshot.

## Structure

| Path | What it is |
| --- | --- |
| `index.html` | Page skeleton. Content is rendered from `data.json`. |
| `data.json` | Every piece of content. Each item holds both languages (`{ "en": "...", "ar": "..." }`). |
| `Assets/site.css`, `Assets/site.js` | Styles and behaviour (no framework, no build step). |
| `Assets/scene.js` | The Three.js shard mesh and gradient wall. Reads the scroll position; never captures it. |
| `Assets/vendor/` | Three.js r170, self-hosted. |
| `Assets/icons.svg` | Phosphor icon sprite, only the icons in use. Add a `<symbol>` for a new one. |
| `Assets/thumbs/` | 960px and 480px copies of the project images for the list. The full images assemble in the 3D scene. |
| `Assets/scene-poster.webp` | Still of the scene, shown while the scene loads and when WebGL is unavailable. |
| `wach-taaref/` | Sub-site for the Wach Ta3ref game. |
| `scripts/check-data.mjs` | Validates `data.json` (both languages present, images and links exist). |

## Working on it

```bash
python -m http.server 5173      # fetch() and modules need http, not file://
node scripts/check-data.mjs     # run after editing data.json
```

- **Add a project:** append an object to `projects` in `data.json`, set its `size`, drop its image in `Assets/` and 960px and 480px copies in `Assets/thumbs/` (`name.webp`, `name-480.webp`), run the check. The scene adds a stop for it by itself.
- **Language:** the site opens in the visitor's last choice, then their browser language. `?lang=ar` / `?lang=en` forces one.

## Design notes

Deep indigo ground with the blue, violet, pink, gold low-poly gradient, Urbanist + DM Mono + IBM Plex Sans Arabic, logical CSS properties so one stylesheet serves LTR and RTL. The scene spins gently at half frame rate when idle (a button pauses it), lowers its resolution on slow devices, and falls back to the still poster under data-saver or without WebGL. Under `prefers-reduced-motion` it jumps between stops and nothing animates on its own. Each project's surface, pose and shard move come from `SURFACE_ORDER`, `POSES` and `MOVES` at the top of `scene.js`.
