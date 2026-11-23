# Sneaky Sneaky

A weaponless, pacifist 3D stealth puzzle game for the browser, with proper
desktop controls and portrait + landscape phone controls.
Target: <https://sneakysneaky.win>

No weapons, ever. Sneak past guards, crouch behind cover, crawl vents, knock
to distract, put the occasional guard to sleep, and steal extremely silly
treasure. If a guard's vision cone fills up, the `!` pops and the mission is
over — one tap (or `R` / `Space`) and you're back at the start of the room.

Everything is procedural: rooms, guards, textures, characters, loot props and
sound. There are no downloaded assets.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move (camera-relative) | `WASD` / arrows | Left-half floating thumbstick (soft tilt = tiptoe, full = jog) |
| Crouch | `C` toggle, `Shift` hold | **CROUCH** |
| Context action (choke / vent / grab / switch) | `E` / `Space` | **ACTION** (label changes to `CHOKE`, `VENT`, `GRAB`, `SWITCH`) |
| Knock distraction | `Q` / `F` | **KNOCK** |
| Orbit camera | Mouse drag, `J` / `L` | Drag the right side, pinch to zoom |
| Zoom | Scroll wheel | Pinch |
| Chase / Overhead Tactical camera | `V` | **CAM** |
| Retry room | `R` | Tap **RETRY** |
| Mute | `M` | Pause menu |
| Pause | `Esc` / `P` | Pause button |

### How it works

- **Vision cones are real.** Each cone is raycast against the room every
  frame, so walls and cover visibly cut it. The solid part sees you even
  crouched; the striped part only sees you standing (it's looking over
  waist-high cover).
- **Detection is a meter, not a tripwire.** Close up it fills almost
  instantly; at the far edge you get about a second. Cyan → amber `?` → red `!`.
- **Jogging is loud.** Running next to a guard makes them turn round.
  Crouching and tiptoeing are silent.
- **Sleeper hold.** Get close, directly behind a guard, and take the prompt.
  A guard who spots a sleeping colleague walks over and wakes them up.
- **Knock** sends guards in earshot to investigate where you were standing.
- **Vents** link two grates of the same colour. **Lasers** need their wall
  switch, or a vent around them.
- **Rank** (S / A / B) comes from time against the ghost par, knockouts and
  close calls. Zero knockouts earns the Ghost Bonus. Loot goes in the Vault.

### Difficulty and the endless ramp

**Mission Setup** (title screen and pause menu) lets you pick your own curve.
It is saved in `localStorage` and mirrored into the address bar, so a link
reproduces the exact setup.

| Difficulty | Detection | Cone reach | Also |
| --- | --- | --- | --- |
| Tourist (Relaxed) | 0.65× | 0.88× | calmer patrols, fewer guards, puzzles arrive later |
| Operative (Classic) | 1× | 1× | the default |
| Shadow (Hard) | 1.35× | 1.12× | brisker patrols, more guards, lasers and extra vents from room 1 |
| Ghost Master (Extreme) | 1.7× | 1.22× | dense guards, lasers and vents, compounds two size tiers bigger |

| Ramp pace | Size tier gained per room |
| --- | --- |
| Steady | 0 — stays at your starting size forever |
| Gradual | ½ |
| Classic | 1 |
| Turbo | 2 |

| Starting size | Tier | Roughly |
| --- | --- | --- |
| Compact | 1 | 3 chambers, 1 guard |
| Standard | 4 | 4–5 chambers, 4 guards, first lasers |
| Large Compound | 8 | ~7 chambers, 6 guards, 3 vents |
| Mega-Facility | 14 | 48 × 30 m, 10–15 chambers, 9–14 guards, ~5 vents, 2–3 laser doors |

Rooms stop growing at tier 20 but the run never ends. **Fine tuning** adds
Guard Alertness (50–200 %) and Vision Range (80–130 %) sliders on top of the
preset, and Setting can be Endless Shuffle or locked to one theme. The HUD,
room briefing and clear screen show the current state, e.g.
`SECTOR 07 · LARGE COMPOUND · OPERATIVE · CLASSIC RAMP` (a `+` after the
difficulty means the sliders are off default).

Vision range, patrol speed and guard count feed the generator, so the ghost
route is re-proved for whatever you pick. Detection speed only changes how
quickly a guard who *can* see you reacts, so it never affects solvability.

### URL parameters

| Parameter | Effect |
| --- | --- |
| `?seed=anything` | Reproducible run. Room *n* uses seed `anything#n`. |
| `?theme=yacht\|office\|lab\|bunker\|museum\|vr` | Lock the setting. |
| `?diff=tourist\|operative\|shadow\|master` | Difficulty preset. |
| `?ramp=steady\|gradual\|classic\|turbo` | Ramp pace. |
| `?start=compact\|standard\|large\|mega` | Starting size. |
| `?alert=1.25` `?vision=1.1` | Fine-tuning sliders. |
| `?level=5` | Debug: add 4 extra size tiers to every room. |
| `?lowpower` | Force the mobile quality tier (no bloom, smaller shadow map). |
| `?nobloom` | Disable post-processing only. |

## Guaranteed-solvable rooms

`src/core/generator.js` builds each room from a seed: a BSP of chambers joined
by doorways, waist-high cover, crawl vents, laser doors with switches, a loot
pedestal, an extraction pad and guards on loop / ping-pong / lookout patrols.

Every room is then checked by two verifiers in `src/core/solver.js` before it
is ever returned:

1. **Topology** — BFS over (cell × carrying-loot × lasers-off) proves the loot
   and exit are physically reachable using doors, vents and switches.
2. **Ghost route** — BFS over a time-expanded graph. Guard patrols are pure
   functions of time (`src/core/patrol.js`), so the solver knows exactly where
   every cone will be. It searches for a crouch-walk route that is never
   inside any padded vision cone, with no knockouts and no distractions.

If no ghost route exists the guards are re-rolled, and as a last resort
thinned out. So every room can be beaten as a perfect ghost; knockouts and
knocking are there to make it easier, never because you have to.

## Project layout

```
index.html            HUD, menus and touch controls markup
src/main.js           entry point
src/style.css         all UI styling (100dvh, safe-area insets, portrait/landscape)
src/core/             pure logic, no three.js, unit tested
  rng.js              seeded PRNG
  grid.js             cells, DDA raycast, line of sight, pathfinding
  patrol.js           patrol timelines (pose as a function of time)
  stealth.js          vision, detection rate, choke-out arc, ranking
  solver.js           topology + time-expanded ghost-route verifiers
  generator.js        room generator
  difficulty.js       presets, ramp maths, shareable setup params
  themes.js, loot.js  the six settings and 28 loot items
src/render/           three.js: textures, characters, world, cones, effects
src/game/             game loop, camera, input, audio, save data
src/ui/               HUD/menus, radar, customizer form, mission setup panel
tests/                node:test suites
public/               _headers, favicon.svg, site.webmanifest
```

## Scripts

```bash
npm test         # unit tests: 250+ seeded rooms across all 6 themes, presets and size tiers
npm run lint     # ESLint 9 flat config, zero warnings allowed
npm run build    # static site in dist/, ready for Cloudflare Pages
npm run preview  # serve dist/ locally
```

The tests cover solvability (both verifiers, plus a continuous replay of each
ghost route against the real vision code), vent placement and connectivity,
laser/switch pairing, patrol validity, line-of-sight and cover occlusion, the
choke-out angle maths, every difficulty preset, the ramp-pace calculations, and
Large Compound / Mega-Facility generation speed and solvability.

## Deploying

Cloudflare Pages: build command `npm run build`, output directory `dist`.
`public/_headers` sets the security headers and cache rules (hashed bundles
under `/assets/` are immutable; `index.html` always revalidates).

## License

MIT — see `LICENSE`.
