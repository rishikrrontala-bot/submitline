# Limitations and honest claims

- A successful unauthenticated HTTP response is evidence of reachability from Submitline's server at that moment. It cannot prove every judge's browser, region, device, login state, or full product functionality.
- Hosts may deny automated requests while working in a browser. Such results are **needs human review**, with a logged-out manual check suggested; they are never silently marked verified.
- LovHack asks for a working demo whenever possible. Its rules do not require a public repository as a separate item.
- deAPI Video Description observes video pixels, not audio. A scene description is a model observation, not proof that a button works or that a spoken claim is true. Processing sends the video URL or file to deAPI. This app uses URLs only.
- YouTube oEmbed does not return duration. The optional server-side YouTube Data API key enables an automated 2–3 minute length check; without a key or when that API is unavailable, length needs manual confirmation. The current public deployment has no YouTube API key.
- YouTube observations can jump in the embedded player. Other supported deAPI hosts may provide observations without a reliable timestamp deep link; those moments need manual seeking.
- deAPI analysis requires a configured key and a supported public video host. Its free/basic quota and duration or size limits may delay or prevent a run. The app must show that state explicitly.
- The current public deployment has no deAPI key. The provider request and polling paths have contract tests, but model accuracy on small UI actions has not been verified by a live inference. The demo shows this limitation plainly.
- Draft data is saved in this browser only. There is no account, synchronization, background monitoring, automatic Devpost submission, or guarantee of judging eligibility.
