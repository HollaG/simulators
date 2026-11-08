# practicedesk

**[Open practicedesk](https://hollag.github.io/simulators/)**

Browser practice simulators for audio and video hardware. Pick a desk, explore its
physical controls, and rehearse with built-in sources or your own local media.

| Desk                 | Live page                                                                   | Source                                   |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| Practice library     | [All simulators](https://hollag.github.io/simulators/)                      | [Landing page](apps/landing)             |
| Mackie ProFX22v3     | [Open simulator](https://hollag.github.io/simulators/mackie-profx22v3/)     | [Audio mixer](apps/mackie-profx22v3)     |
| CineTreak Mixer Plus | [Open simulator](https://hollag.github.io/simulators/cinetreak-mixer-plus/) | [Video mixer](apps/cinetreak-mixer-plus) |

## Run locally

Requires Node.js 24 or later. From the repository root:

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5300. The landing server connects the two simulators on ports
5301 and 5302, with live reload. Stop all three using Ctrl+C.

```text
apps/
  landing/                Practice library
  mackie-profx22v3/        Audio mixer, signals and routing
  cinetreak-mixer-plus/    Video switcher, compositor and menus
packages/ui/              Shared practicedesk header and footer
skill/                    Hardware Simulator Builder skill and resources
scripts/                  Development, build and static preview
```

Each simulator keeps its own state, engine, assets, tests and package versions.
The shared UI provides consistent branding and navigation across all three pages.
See the app READMEs for practice sequences and device-specific accuracy limits.
The original projects are [Mackie](https://github.com/HollaG/simulator-mackie-profx22v3)
and [CineTreak](https://github.com/HollaG/simulator-cinetreak-mixer-plus).

## Build and check

```sh
npm test
npm run build
npx playwright install chromium
npm run test:browser
npm run preview
```

Preview: http://127.0.0.1:4173/simulators/. The browser command runs each desk's
existing suite, followed by tests of all three production pages and navigation.
Builds are combined into one `dist/`, with one folder per simulator.

## Build another simulator

Read **[the Hardware Simulator Builder skill](skill/SKILL.md)**. Its reference
notes, UI metadata and PDF extraction helper are included under [`skill/`](skill/).
Copy that folder into your coding agent's skills directory to use it locally.
PDF extraction dependencies are tooling dependencies; they are not needed to run
the website. The copy is a snapshot of the local skill used for this project.

## Deployment

[GitHub Actions](.github/workflows/pages.yml) installs from the root lockfile,
runs both apps' tests, builds the three pages, tests the combined site, then
deploys it to GitHub Pages. Pages must use GitHub Actions as its publishing source.
The site root comes from Pages metadata through `SITE_BASE_PATH`; each app gets
its own asset prefix. `VITE_SITE_BASE` keeps shared navigation pointed at the hub.

This is an unofficial practice collection. Device names, trademarks, photos and
manuals belong to their respective owners. Simulated analog/DSP and firmware
details have documented accuracy limits; no real hardware is controlled.
