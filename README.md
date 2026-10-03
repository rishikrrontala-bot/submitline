# Submitline

**Paste your hackathon rules and draft links. See what a judge can actually reach before you submit.**

Submitline is a LovHack Season 3 entry built by **Rishik Rontala**. It pairs the official submission contract with unauthenticated link checks, GitHub public-visibility evidence, YouTube metadata, and deAPI Video Description observations. Each requirement stays **verified**, **blocked**, or **needs human review**; there is no readiness score.

## Run locally

Requires Node.js 22 or newer.

1. Run npm install.
2. Copy .env.example to .env.local and set DEAPI_API_KEY to enable video analysis. Keep the key server-side; never use a NEXT_PUBLIC_ name.
3. Run npm run dev.
4. Open http://localhost:3000.

Without a deAPI key, link checks, requirement review, browser draft storage, and Markdown export still work. Video analysis reports its unavailable state explicitly.

## Deploy

Deploy as a **Node web service**, since link checks and video analysis use server routes. The included `render.yaml` configures Render's build, start command, and root health check. Keep `DEAPI_API_KEY` as a server-side environment secret if enabled. The same project can run on Vercel with its normal Next.js build; do not expose the key through a `NEXT_PUBLIC_` variable.

## Verify

- npm test — requirement extraction, status classification, address rejection, deAPI job states, and evidence labels.
- npm run typecheck
- npm run build
- npm run verify:ui — with the app running at http://127.0.0.1:3000 (or SUBMITLINE_URL), runs real Chrome desktop/phone checks and the example's broken live link, public GitHub repository, and public YouTube metadata path. Screenshots are saved in proof/.
- npm run verify:a11y — runs an axe-core WCAG audit at desktop and phone widths against both the empty workspace and populated evidence board. It excludes YouTube's cross-origin iframe internals, which the app cannot edit; the iframe has its own accessible title.

## How it works

The client keeps the draft and corrected requirements in browser storage. The /api/check route performs unauthenticated checks. It rejects local/private/credentialed URLs, resolves public DNS before each request, pins the vetted address for the connection, and revalidates every redirect. A GitHub repository is verified through GitHub's unauthenticated public API; other repository hosts remain human-review items. A reachable video page is never treated as proof of logged-out playback.

With the entrant's consent, /api/video/start sends a supported public URL to deAPI's Marlin_2B Video Description model. /api/video/job polls the documented pending, processing, done, and error states. The timeline shows model descriptions as visual observations, with YouTube jump links. deAPI reads pixels, not audio.

## Scope and source

LovHack's [requirements](https://lovhack-season-3.devpost.com/#challenge-requirements) require a project description, 2–3 minute video accessible without permission, technology list, and build-period disclosure. A working demo is requested whenever possible. A repository is an example of a prototype link, **not** a separate mandatory item. Pasted rules from another event are extracted conservatively and remain editable by the entrant.

This repository was created on **October 2, 2026**, inside LovHack's September 26–October 4 build period. The application code, design, and documentation are new work for this entry. npm packages are third-party dependencies; no earlier Rishik project code was copied. The built-in Northstar entry is explicitly fictional, and its public repo/video links are reference material for testing, not Submitline submission artifacts.

See [APP-BRIEF.md](APP-BRIEF.md), [WIN-CONTRACT.md](WIN-CONTRACT.md), [DESIGN.md](DESIGN.md), and [LIMITATIONS.md](LIMITATIONS.md) for the product contract, event research, visual direction, and honest boundaries.
