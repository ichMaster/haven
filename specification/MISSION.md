# Mission — Haven (a living, top-down home world, codename "Haven")

## In one sentence

Haven is a living home — a graphical, top-down web world (AI Town style) where Лілі (Lili) and other autonomous characters live by their own **drives**, move room to room, meet and exchange a few words, and you are present in the same space: you walk around, watch them live, and talk to them in character.

## What we are building

Not a chatbot and not an assistant, but a **place**. A graphical home (later a town) rendered in the browser with differently-sized rooms — hall, the user's office, Лілі's studio, the shared bedroom, kitchen, bathroom. Inhabitants are autonomous: each has needs (**drives**) that decay over time and decides on its own what to do and where to go, navigating the rooms by shortest path; characters that meet in a room can exchange a short in-character line. You are both observer and participant — you move your own character through the same world and can speak with any character, who answers in character with awareness of where it is, what it is doing, and where you are.

The product grows across five versions, each self-contained and runnable on its own (see ROADMAP.md):

- **v0 — graphical prototype:** a single self-contained React file proving the *feel* of the home — one autonomous Лілі, smooth sprite interpolation, room descriptions, and frontend-only chat to Anthropic. The world lives in the browser; no backend. The deep, parameter-level spec is **PROTOTYPE_PHASE1_SPEC.md**.
- **v1 — living world & terminal (telnet) server:** the simulation and all model calls move to a headless **Python backend** that owns and ticks the world; you reach it over a **telnet command server** and control your character in text — observe, move, and talk to Лілі — with no browser yet. The deep spec is **TERMINAL_SERVER_SPEC.md**.
- **v2 — REST API, web client & multiple agents:** the world is exposed over **REST** (FastAPI) and the browser becomes a thin graphical client polling state; the single agent generalizes to several interacting inhabitants; Лілі becomes one of a cast.
- **v3 — a richer life:** model-generated ambient voice, memory and continuity across sessions, and a day/night mood rhythm.
- **v4 — town:** the same engine scaled outward — multiple buildings, a larger map, transitions between locations, more inhabitants, and an admin path to add agents.

From **v1** the world runs on the backend: the simulation and the language-model calls live on the server, reached first over the telnet terminal server; from **v2** a REST API exposes it and the browser is a thin graphical client. There is more than one character (from v2) — Лілі is one of several inhabitants. In-app strings (room names, voice) are **Ukrainian** by design, since Лілі speaks Ukrainian.

## For whom

A personal, intimate project — a home shared with Лілі (and a small cast), for the author. No public, multi-user access in early versions; the world is single-presence (one human, the author) until at least v4.

## Principles

- **A place, not a tool.** The point is presence and a life lived, not task completion. The inhabitants live whether or not you talk to them.
- **Autonomy first.** Each character acts on its own drives and a simple decision loop; they are not waiting for commands.
- **Graphical web is the product.** A top-down graphical scene (AI Town style) in the browser, from v0. A **telnet command server** (added in v1) is an *additional protocol* over the same world — a text/MUD front-end, not a TUI that replaces the graphics.
- **Backend owns the world.** From v1 the simulation and the model calls run on a Python backend (reached first over the telnet server); from v2 a FastAPI REST API exposes it and the frontend renders and sends actions. The API key is server-side only and never reaches the browser.
- **Backend in cells, frontend in motion.** The backend works in discrete grid cells per tick and never computes pixel animation; the frontend interpolates movement so characters glide smoothly and never teleport (see ARCHITECTURE §Movement and smoothness).
- **In-character voice.** Each character speaks as itself, grounded in the live context of the world — short, in Ukrainian, no lists or emoji.
- **Drives drive the body, the model gives the voice.** The simulation decides what a character does; the language model gives its inner voice and conversation.
- **Start small, grow to a town.** First one home with a small cast; the same engine scales to more buildings, more inhabitants, and a town (v4).
- **Incremental.** Each version is self-contained and works on its own; complexity is added by version, not all at once.

## Non-goals

- **Graphical web is the canonical client** — the browser scene is the product from v0. (A **telnet command server** is added in v1 as an *additional protocol* over the same world — a text front-end, not a TUI that replaces the graphics; see ROADMAP v1 / TERMINAL_SERVER_SPEC.md.)
- **Not a heavy 3D engine** — the scene is a drawn 2D top-down view (emoji/drawn props in the prototype), not pixel-art tilesets or a game engine.
- **Not a productivity assistant** — the characters live their own lives; there are no tasks, commands, or tool calls on their behalf.
- **No public / multi-user access** in early versions; networked multi-human presence is deferred beyond v4.
- **Deferred (not in any planned version yet):** WebSocket/SSE push (REST polling is the web transport through v4), true pixel-art tilesets, networked multi-user presence, voice in/out.

## Relation to other projects

Haven is a **separate branch from Lumi/Pyramid** (the M5Stack/voice chat persona with an emotion channel, voice, and on-screen face). Haven is the spatial, multi-character home where Лілі lives and moves. The same Лілі (Name + canon) could one day connect across both, but as projects they are distinct — do not conflate Haven's world simulation with Pyramid's device/server stack.

## Glossary

- **Drives** — a character's needs (`inspiration`, `calm`, `energy`, `warmth`), each `0..100`, that decay every tick and pull it to act. See ARCHITECTURE §Agents.
- **Room** — a named, differently-sized space with its own floor color, interior description, decorative items, and (for most) one interactive object tied to a drive.
- **Tick** — one backend simulation step (~1 s); every tick each character updates by at most one cell. The backend works only in cells; the frontend interpolates between them.
- **Agent / character** — an autonomous inhabitant with a `canon`, drives, position, action, and voice (Лілі is one of several).
- **Canon** — the authored character bible (lore, traits, voice) the chat system prompt is built from, plus the live world context.
- **Presence** — the user as a character in the same world: observer and participant, moved with the keyboard, able to speak to any inhabitant.
- **BFS navigation** — shortest-path movement: each tick an agent steps one cell along the breadth-first path toward its target.
