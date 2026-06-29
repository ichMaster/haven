# TERMINAL_SERVER_SPEC.md — Haven v1 TCP/telnet server

Detailed specification of the **terminal server** introduced in **ROADMAP v1**:
a TCP server speaking a line-based telnet command protocol that lets a person
connect with a telnet client, control their character (`ти`), and observe, move
through, and talk to the living Haven world — entirely in text, with no browser.

It is the human-facing front-end for the **headless, backend-owned world** built
in v1.1. The graphical web client (v2) and this terminal server are two
**protocols over one shared world** — see [ROADMAP.md](ROADMAP.md) and the
amended non-goal in [MISSION.md](MISSION.md).

> The terminal server is **not** a TUI replacement for the graphical product.
> Haven stays a graphical web world; telnet is an additional door into the same
> backend simulation (a MUD-style text interface).

---

## 1. Goals & non-goals

**Goals.**
- Prove "the world ticks without a browser": a person can `telnet` in and see the
  living world.
- Let the connection **control the player character** (`ти`) — observe, move, and
  talk to inhabitants — reusing the same backend world operations the REST API
  will expose.
- Stay simple and dependency-light: standard-library asyncio TCP, line-based
  commands, plaintext, opt-in.

**Non-goals (here).**
- Not a replacement for the graphical client. Not authenticated multi-tenant
  access. Not full telnet option negotiation (we strip control sequences, not
  implement them). Not its own world — it shares the one backend world. No TLS
  (local/personal use); see Security.

---

## 2. Architecture

```
                    ┌────────────────────────── backend process ──────────────────────────┐
                    │                                                                       │
   telnet client ───┼─▶ asyncio TCP server ──┐                                              │
   (you, "ти")      │     (Session per conn) │                                              │
                    │                         ├─▶  World (singleton)  ◀── tick loop (~1s)    │
   browser ─────────┼─▶ FastAPI / REST ───────┘     • cells, drives, agents, clock          │
   (v2, web client) │     GET /world …              • emits domain events ─▶ Event bus       │
                    │                                                  │                    │
                    └──────────────────────────────────────────────────┼────────────────────┘
                                                                        ▼
                                              sessions subscribe to the event bus
```

- **One process, one world.** A single `World` singleton owns all state (integer
  cells, agents, drives, clock) and is advanced by **one** fixed-interval tick
  loop (~1 s, the prototype's `TICK_MS` re-tuned for the server). Both the telnet
  server and (from v2) the REST API act on this same world — no duplicated logic
  and no second simulation.
- **Telnet server.** An `asyncio.start_server` TCP listener. Each accepted
  connection becomes a **`Session`** (an async task) with its own reader/writer,
  output queue, and per-session state (current location, verbosity).
- **Event bus.** The world emits domain events as it ticks (agent moved, agent
  spoke an ambient line, agent arrived/left a location, day rolled). Sessions
  **subscribe** and receive events relevant to them (location-scoped narration,
  §6). The bus is in-process pub/sub (an `asyncio.Queue` per session).
- **Commands → world ops.** A command handler parses a line and calls a world
  operation (`look`, `move`, `travel`, `chat`, …). These are the *same* service
  functions the REST endpoints call from v2, so behaviour is identical across
  protocols.
- **Non-blocking.** The tick loop never blocks on a session, and a session never
  blocks the tick. Model calls (chat) run as fire-and-forget tasks that stream
  their result back to the requesting session.

**Module layout (planned).** `/backend/world/` (the ported world + tick + event
bus), `/backend/telnet/` (server, session, command parser, renderers),
`/backend/api/` (FastAPI, from v2). All over the same `World`.

---

## 3. Protocol

### 3.1 Transport & framing
- **TCP**, line-oriented. The unit of input is one line terminated by `\n`
  (CRLF tolerated — trailing `\r` stripped). Output is UTF-8 text lines.
- **Encoding: UTF-8.** All output (Ukrainian room descriptions, names, replies)
  is UTF-8. Clients should be in UTF-8 mode (`telnet`, `nc`, PuTTY raw, modern
  terminals). Documented in the welcome banner.
- **Greeting.** On connect the server sends a banner: `Ласкаво просимо до Haven.
  День D · HH:MM. Введіть help.` followed by an initial `look` and a prompt.
- **Prompt.** After handling a command (and when idle) the server writes a
  prompt: `> ` (configurable). Pushed event lines may appear between prompts.

### 3.2 Telnet handling
- We do **not** implement full telnet option negotiation. On connect the server
  may send `IAC WILL ECHO`/`IAC WILL SGA` to request character-at-a-time only if
  needed; by default we assume **line mode** and the client's local echo.
- Inbound **IAC** sequences (bytes `0xFF …`) are **stripped** from the input
  stream before line parsing, so raw `telnet` negotiation never reaches the
  command parser.
- No password/auth handshake in v1 (single-user/local). Optional shared-secret
  gate is a later, opt-in extension.

### 3.3 Output kinds
| Kind | Example | Notes |
|---|---|---|
| Command result | `Мій кабінет. Тут: ти. Лілі — у майстерні.` | reply to your line |
| Event narration | `[Лілі]: Пахне теплом і домом.` | pushed; location-scoped (§6) |
| System notice | `* Лілі прямує до кухні.` | pushed; movement/arrivals |
| Error | `Не розумію. Введіть help.` | unknown/invalid command |
| Prompt | `> ` | after results / when idle |

Optional ANSI color is **off by default** (`HAVEN_TELNET_COLOR=on` to enable);
plain text is the baseline so dumb clients stay readable.

---

## 4. Sessions & identity

- A telnet session **is the user character** (`ти`) — the same presence the web
  player controls. There is one player in the world (single-user/personal, early
  versions).
- **Simultaneous web + telnet** both drive the same `ти`: the world is shared,
  actions mutate one state, **last action wins**, and the web client's `/state`
  polling reflects telnet-initiated moves (and vice-versa). No locking in v1;
  if this proves confusing, a future "active controller" lock is an opt-in.
- A session holds only **view state** (current location, verbosity, recent chat
  history for prompt assembly); the **world** holds the authoritative player
  position and all simulation state.
- On disconnect the session unsubscribes from the event bus; the player presence
  remains in the world (you simply stop steering it).

---

## 5. Command reference

Commands are **case-insensitive**, line-based, `verb [args]`. **English verbs are
canonical; Ukrainian aliases are accepted.** Unknown input → `Не розумію. Введіть
help.` Commands become available per ROADMAP phase (see the Phase column).

### 5.1 Grammar
```
line     := verb (SP arg)*
verb     := <letters>            ; case-insensitive, EN canonical or UA alias
arg      := <token> | <rest-of-line>   ; e.g. `tell <agent> <rest-of-line>`
```

### 5.2 Commands

**Observe (v1.2)**

| Verb (canonical) | Aliases | Args | Effect |
|---|---|---|---|
| `look` | `l`, `дивись`, `огляд` | — | Describe your location: name + interior description, exits/doors, who's here, notable items. |
| `look` | — | `<agent>` | Describe an agent in your location: their current action + thought. |
| `map` | `m`, `карта` | — | ASCII town map with your location marked (`*`); future locations shown locked. |
| `who` | `хто` | — | List inhabitants and their current locations. |
| `time` | `час` | — | Day and clock (`День 1 · 09:48`). |
| `drives` | `стан`, `драйви` | `[agent]` | Text drive bars for an agent in your location (default: the nearest inhabitant). |
| `help` | `?`, `допомога` | `[verb]` | List commands, or explain one. |
| `verbose` / `quiet` | `тихо` | — | Toggle live event narration on/off. |
| `quit` | `exit`, `вихід` | — | Disconnect. |

**Move (v1.3)**

| Verb | Aliases | Args | Effect |
|---|---|---|---|
| `n` `s` `e` `w` | `north`/`південь`… | — | Step one walkable cell (N/S/E/W). Rejected into walls/bounds: `Туди не пройти.` |
| `move` | `іди`, `йди` | `<dir>` | Same as the single-letter forms. |
| `go` | `travel`, `перейти` | `<location>` | Travel to another town location (e.g. `go cafe`). One home for now; more in v4.1. |

**Interact (v1.4)**

| Verb | Aliases | Args | Effect |
|---|---|---|---|
| `say` | `скажи` | `<text>` | Speak aloud in your location; co-located agents may react. |
| `tell` | `talk`, `звернись` | `<agent> <text>` | Address an agent → in-character model reply (prompt assembled server-side from canon + live context). |

### 5.3 Argument resolution
- **`<agent>`** matches by name, case-insensitive, accent-insensitive, prefix
  allowed when unambiguous (`tell лі привіт` → Лілі). Ambiguous/absent →
  `Тут немає такого, з ким поговорити.`
- **`<location>`** matches a travelable location id or its name (`cafe`, `Кафе`).
- **`<dir>`** ∈ `n|s|e|w` (+ UA/long forms).

---

## 6. Event narration (live world)

Because the world is continuous, the server **pushes** events to a session as
they happen — the "event log" the web UI dropped becomes the terminal's live
narration.

- **Scope:** by default only events in the session's **current location** (the
  room/location feed): an agent's ambient line, an agent arriving/leaving, the
  day rolling. `verbose` widens to the whole active location; `quiet` silences
  pushes (command results still appear).
- **Format:** speech as `[Name]: line`; movement/system as `* …`. Lines are
  flushed between prompts; the prompt is re-issued after a burst.
- **Backpressure:** each session has a bounded output queue; if a client stalls,
  oldest narration is dropped (never blocks the tick). Command results are never
  dropped.

---

## 7. Text rendering of the world

The renderers map the same world model the prototype/UI use into text:

- **`look` (location):** `{location/room name}. {interior description}.` then
  `Виходи: …` (doors/locations reachable), `Тут: {who, incl. ти}`, and notable
  `ITEM` glyphs as words where useful. Room descriptions come from the world's
  room/location data (the prototype's `ROOMS[...].desc`).
- **`look <agent>`:** `{Name} — {action}. {thought/observation}.`
- **`map`:** the town grid as ASCII, your cell marked `*`, travelable vs locked
  locations distinguished (e.g. `[☕ Кафе]` vs `[🔒 Парк]` — or ASCII-only when
  color/emoji are off).
- **`drives`:** four labelled 10-cell bars (`натхнення [████░░░░░░]`) reusing the
  bar fill rule (`round(v/10)`).

Renderers are pure functions of world state + the session's location, so they're
unit-testable without a socket.

---

## 8. Configuration

| Env var | Default | Meaning |
|---|---|---|
| `HAVEN_TELNET` | `off` | Enable the telnet server (opt-in). |
| `HAVEN_TELNET_HOST` | `127.0.0.1` | Bind address (localhost by default). |
| `HAVEN_TELNET_PORT` | `8023` | TCP port. |
| `HAVEN_TELNET_COLOR` | `off` | ANSI color in output. |
| `HAVEN_TICK_MS` | `1000` | World tick interval (shared by all protocols). |

The server binds to **localhost by default** and is off unless enabled.

---

## 9. Security

- **Plaintext, no auth, local-only by default.** Suitable for single-user /
  personal use on `127.0.0.1`. Do not expose the port to untrusted networks; if
  remote access is ever needed, front it with SSH tunneling or add an opt-in
  shared-secret gate — not in v1 scope.
- **The Anthropic key never leaves the server.** `tell`/`say` model calls run
  server-side (v1.4); the key is in server config (gitignored `.env`), never sent
  to a client. This is the same backend-only key rule the REST chat (v2.5) uses.
- **Input is untrusted text:** commands are parsed defensively; IAC/control bytes
  stripped; argument lengths bounded; no shell-out, no `eval`.

---

## 10. Testing

- **Renderers** (look/map/who/drives) — pure unit tests over crafted world states.
- **Command parser** — verb/alias resolution, argument parsing, unknown-command
  handling (EN + UA).
- **Session/integration** — drive a fake reader/writer pair: connect → banner +
  initial look; issue commands; assert results and that pushed events arrive
  (over a mock clock / deterministic tick). No real sockets or model calls (chat
  uses an injected fake client, mirroring the v0.2 pattern).
- **World ops parity** — `move`/`travel`/`chat` over telnet hit the same service
  functions REST will use; a contract test pins that parity once v2 lands.

---

## 11. Mapping to roadmap phases

| Capability | Phase |
|---|---|
| Headless world + tick + event bus | v1.1 |
| TCP server, sessions, parser, **observe** commands, live narration | v1.2 |
| Player presence + **move**/`go`/`travel` | v1.3 |
| **say**/**tell** in-character chat (server-side model, key server-side) | v1.4 |
| REST surface (`/world`, `/state`) over the same world | v2.1 |
| Multiple agents appear in `who`/`look`/narration | v2.3 |

The terminal server's write-commands deliberately track the same backend
capabilities the REST API exposes, so the two front-ends never diverge.

---

## 12. Example session

```
$ telnet 127.0.0.1 8023
Ласкаво просимо до Haven. День 1 · 09:48. Введіть help.
Мій кабінет. Твій кабінет: книги, тепле світло лампи й крісло, у якому добре думається.
Виходи: хол (захід). Тут: ти.

> who
ти — Мій кабінет
Лілі — Майстерня Лілі (малює)

> drives Лілі
Лілі:
  натхнення [███████░░░]  спокій [██████░░░░]
  енергія   [█████░░░░░]  тепло  [████░░░░░░]

> w
Ти йдеш у хол.
* Лілі переходить до кухні.
[Лілі]: Заварю собі чаю.

> tell Лілі що там пахне?
Лілі друкує…
[Лілі]: Чай з чебрецем — діда колись так заварював. Зайдеш на горнятко?

> map
  [🏠 Дім Лілі*]   [🔒 Сусіди]   [🔒 Котедж]   [🌳 Парк] …
  [🔒 Квартири]    [🔒 Школа]    [🔒 Книгарня] [☕ Кафе] …
  (* — ви тут)

> go cafe
Ти прямуєш до Кафе. Тут: Марко, Зоя.

> quit
До зустрічі.
```

---

## 13. Relation to other specs

- [ROADMAP.md](ROADMAP.md) — schedules the server across v1.1–v1.4 and the shared
  world/REST in v2.
- [ARCHITECTURE.md](ARCHITECTURE.md) — the world model, data shapes, and the
  REST contracts the terminal server shares.
- [MISSION.md](MISSION.md) — the amended non-goal: graphical web is the product;
  telnet is an additional protocol.
- [PROTOTYPE_PHASE1_SPEC.md](PROTOTYPE_PHASE1_SPEC.md) / [UI_SPEC.md](UI_SPEC.md)
  — the world model and on-screen UI the text renderers mirror.
