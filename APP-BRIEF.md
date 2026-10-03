# Submitline — app brief

**Pitch:** Paste hackathon rules and draft submission links; Submitline checks what a judge can actually access and shows exactly what still needs attention.

## Problem and user

A solo hackathon entrant can finish the product and still lose judging access to a private video, broken demo, or omitted submission field. The final check is fragmented across the event rules, Devpost draft, browser tabs, and memory. Submitline gives one source-linked, evidence-first workspace immediately before submission.

## Primary job

1. Load LovHack Season 3's official submission contract or paste another event's rules.
2. Enter project description, live demo, repository (optional for LovHack), and public video URL.
3. Run unauthenticated server checks for links. Reject private and local targets. Use deAPI Video Description for timestamped visual observations when a key and supported public video are available.
4. Show each requirement as **verified**, **blocked**, or **needs human review**, with source rule and observation beside it. Never collapse mixed evidence into a numerical score.
5. Fix and rerun one link. Confirm human-only items. Export project description and checklist as Markdown.

## Scope

No accounts, database, payments, automatic Devpost submission, generic chat, contest crawler, or integration with every video host. Browser storage retains a local draft. Next.js route handlers keep the deAPI key on the server.

## Acceptance evidence

The demo must show a truly blocked link becoming reachable after a correction, a repository visibility result, and a real timestamped deAPI output or an explicit unavailable state. It must show official LovHack source passages, manual review, and Markdown export. The 2–3 minute narrated video must be accessible without requesting permission.
