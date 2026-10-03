# Submitline — Devpost draft

Replace the bracketed URLs only after the live app, public repository, and accessible 2–3 minute video are verified. Do not submit sample links.

## Elevator pitch

Paste your hackathon rules and draft submission links; Submitline checks what a judge can actually access and shows exactly what still needs attention.

## Inspiration

A project can be finished and still become invisible to judges: a demo video is private, a deployed link returns 404, or a required field was omitted. The last hour before a deadline deserves a better tool than memory and a row of browser tabs.

## What it does

Submitline loads LovHack Season 3's source-linked submission requirements or extracts a conservative checklist from pasted rules. An entrant enters their project story, live app, optional repository, and demo video. The app checks links from an unauthenticated server request, confirms GitHub public visibility through its public API, reads available YouTube metadata, and uses deAPI Video Description to turn a public demo into timestamped visual observations. It leads with blockers, marks ambiguous results for human review, allows corrected links to be rerun, and exports a final Markdown checklist. There is no synthetic readiness score.

## How we built it

Next.js App Router, TypeScript, Tailwind CSS, local browser storage, Node.js route handlers, GitHub's public REST API, YouTube oEmbed, and deAPI's Marlin_2B Video Description API. Public link checks pin a vetted DNS address and revalidate redirects to reject private-network targets. The deAPI key stays on the server.

## What we built during LovHack Season 3

The Submitline repository, product design, requirement parser, safe link checker, deAPI integration, evidence workspace, Markdown export, tests, and documentation were created during the September 26–October 4, 2026 period. No earlier project code was reused. Third-party npm packages and the official API documentation were used as dependencies and references. The Northstar sample in the app is fictional and is not the submitted product.

## Challenges and lessons

Automated access is not identical to a human judge's browser. Some hosts block bots; a 200 response cannot prove product functionality; a model description cannot prove a click worked. Submitline makes these limits visible with a needs-human-review state and asks entrants to confirm logged-out playback.

## Links and media

- Working demo: [verify and insert public URL]
- Public source: [verify and insert repository URL]
- 2–3 minute narrated, captioned product demo: [verify and insert public URL]

## Built by

Rishik Rontala — solo entrant.
