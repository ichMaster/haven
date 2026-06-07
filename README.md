# Haven

A graphical, top-down web world (AI Town style) — a *place*, not a chatbot. Autonomous
characters live in a multi-room home by their own drives; you are present as your own
character, walk the same space, and talk to them in character. They live whether or not
you interact.

> **Status: v0.1 — graphical prototype.** The whole world runs in the browser as a single
> self-contained React file, with no backend yet. From v1 a Python/FastAPI backend owns the
> simulation and the React app becomes a thin client. See [specification/ROADMAP.md](specification/ROADMAP.md).

Лілі is the first inhabitant. In-app text (room names, her voice) is **Ukrainian** by design.

## What's in v0.1

A single file, [lili_house_aitown.jsx](lili_house_aitown.jsx) (default component
`LiliHouseAITown`), holding the whole prototype:

- **World** — a procedural 29×15 floor plan: six rooms (studio, kitchen, hall spine,
  bedroom, office, bathroom) connected through a central hall, with interactive objects and
  decor props.
- **Лілі, autonomous** — four drives (inspiration / calm / energy / warmth) that decay over
  time; each tick she heads to the room that satisfies her lowest drive, navigates there by
  BFS one cell at a time, acts to refill it, and speaks a short in-character line. If you're
  in the office and she needs warmth, she comes to you.
- **You** — walk your own character with arrows/WASD through the same space.
- **Rendering** — an SVG scene (wood walls, pastel floors, emoji props, drawn sprites with
  name tags, a speech bubble, a day/night tint). Characters **glide** smoothly between cells
  and never teleport.
- **Panel** — live drive bars, the current action, interior descriptions of both rooms (or a
  shared card when you're together), a fading event log, and pause/step controls.

Out of scope for v0.1: in-character chat (v0.2), any backend / REST / model calls (v1),
multiple agents (v1.3), persistence (v2).

## Running it

Requires [Node.js](https://nodejs.org/) (used only as the build/test toolchain — the app
itself runs in the browser).

```bash
npm install      # install dev tooling (Vite, Vitest, React)
npm run dev      # start the dev server, then open the printed http://localhost:… URL
npm run build    # produce a static production bundle in dist/
npm test         # run the test suite (Vitest)
```

## How it's built

The design principle, in miniature here and enforced by the backend from v1:
**"Backend in cells, frontend in motion."** All world logic works in integer grid cells; all
smoothing/animation is CSS-transition interpolation in the render. In this prototype both
halves live in the one file, split cleanly:

- **Pure logic** (no React) — floor plan, derived grids, drives, `pickTarget`, `bfsNext`, and
  the per-tick decision loop (`advance`, with an injectable RNG so it's deterministic).
  Exported by name so the tests exercise them directly.
- **Rendering** — the `Scene` / `Sprite` components and the UI panel, driven purely from the
  simulation state.

### Layout

```
lili_house_aitown.jsx   # the v0 prototype (the whole app)
main.jsx, index.html    # dev entry that mounts the component
tests/                  # Vitest suite (logic + mounted render/movement/UI)
vite.config.js          # dev server + test runner config
specification/          # MISSION, ARCHITECTURE, ROADMAP, the v0 prototype spec
```

The planned `/frontend`, `/backend`, and `/shared` directories are created when **v1** begins
— they don't exist yet.

## Documentation

- [specification/MISSION.md](specification/MISSION.md) — what Haven is, principles, glossary.
- [specification/ARCHITECTURE.md](specification/ARCHITECTURE.md) — components, world model, REST contracts, stack.
- [specification/ROADMAP.md](specification/ROADMAP.md) — phased plan (v0 → v3).
- [specification/PROTOTYPE_PHASE1_SPEC.md](specification/PROTOTYPE_PHASE1_SPEC.md) — the parameter-level spec for this prototype.

## License

See [LICENSE](LICENSE).
