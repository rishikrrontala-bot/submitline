# Submitline — Devpost draft

The story below reflects the public deployment as verified on October 3. Add the YouTube or Vimeo video URL only after a logged-out playback check. Do not submit the fictional Northstar sample links.

## Project overview

- **Name:** Submitline
- **Tagline:** Check your hackathon submission as a judge would before the deadline.
- **Built with tags:** Next.js, TypeScript, Tailwind CSS, Node.js, GitHub API, YouTube oEmbed, deAPI, Playwright
- **Team:** Rishik Rontala (solo)

## Elevator pitch

Paste your hackathon rules and draft submission links; Submitline checks what a judge can actually access and shows exactly what still needs attention.

## Inspiration

I once finished and deployed a hackathon project, then missed its submission deadline by eight minutes. That failure made the final submission step feel like a product problem of its own. A strong project can still become invisible to judges when its video is private, a link returns 404, or a required field is missing. Submitline is for solo student builders who need one clear answer before they press submit: what can a judge actually open?

## What it does

Submitline loads LovHack Season 3's source-linked submission requirements or extracts a conservative, editable checklist from pasted rules. An entrant enters their project story, live app, optional repository, and demo video. The app checks links from an unauthenticated server request, confirms GitHub public visibility through its public API, and reads available YouTube metadata. It leads with blockers, marks ambiguous results for human review, allows a corrected link to be rerun on its own, and exports the final Markdown checklist. In the real demo, a broken URL returns 404, then the corrected URL returns 200; the app still makes clear that reachability is not proof of functionality. There is no synthetic readiness score.

The video panel integrates deAPI's Marlin_2B Video Description API to display timestamped visual observations when a server-side key is configured and the entrant consents. This public deployment currently has no deAPI key, so it explicitly shows that analysis is unavailable instead of displaying invented model output.

## How we built it

Next.js App Router, TypeScript, Tailwind CSS, local browser storage, Node.js route handlers, GitHub's public REST API, YouTube oEmbed, and deAPI's Marlin_2B Video Description API. Public link checks pin a vetted DNS address and revalidate redirects to reject private-network targets. The deAPI key stays on the server. I verified the build with unit tests, desktop and phone browser checks, and an accessibility audit of both empty and populated states.

## What we built during LovHack Season 3

The Submitline repository, product design, requirement parser, safe link checker, deAPI integration, evidence workspace, Markdown export, tests, and documentation were created during the September 26–October 4, 2026 period. No earlier project code was reused. Third-party npm packages and official API documentation were used as dependencies and references. The Northstar sample in the app is fictional and is not the submitted product.

## Challenges and lessons

Automated access is not identical to a human judge's browser. Some hosts block bots; a 200 response cannot prove product functionality; a model description cannot prove a click worked. Submitline makes these limits visible with a needs-human-review state and asks entrants to confirm logged-out playback.

## Links and media

- Working demo: https://submitline.vercel.app
- Public source: https://github.com/rishikrrontala-bot/submitline
- 2–3 minute narrated, captioned product demo: [YouTube or Vimeo URL after logged-out playback check]

## Built by

Rishik Rontala — solo entrant.

## Devpost form map

| Step | Prepared material |
| --- | --- |
| Manage team | Rishik Rontala, solo. |
| Project overview | Use the name and tagline above; upload `proof/submitline-thumbnail.png` as the project thumbnail. |
| Project details | Use the sections above as the story, the eight built-with tags, the live and source links, and the **new** public or unlisted 2:36 video URL. |
| Additional details | Answer LovHack-specific questions from the live form and select only prizes whose requirements the entry actually meets. |
| Submit | Review every field, accept the site terms, submit the project, and confirm Devpost shows **Submitted**. A saved draft is not an entry. |

The previously shared `https://youtu.be/6R_b9qodNaQ` is 1:52 and must not be used for the required video. The exact event-specific fields become visible only after signing into Devpost; the account was logged out during the October 3 form audit. The final entry should be opened while logged out to confirm that its app and video links work.
