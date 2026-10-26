# Runner provider connections

Approved 2026-10-19 after the real-code Runner mockup review.

- PC-1: One optional account-wide connection per provider/channel requests stream credentials and metadata permissions together. Twitch login permissions remain unchanged. Provider connections explicitly link social identities to the existing Clipify user through Better Auth. A linked Google identity resolves to that same user; Google sign-up and a Google login button are outside this release. Automatic merging stays disabled. Explicit linking permits different verified provider emails without replacing the Clipify email/profile or existing Twitch login.
- PC-2: Keep manual keys. Provider destinations use fixed ingest endpoints. Save and reuse channel identity safely across Runners; never expose OAuth tokens or saved keys to the browser.
- PC-3: Event details contain an off-by-default Set stream details toggle. When enabled, each selected authorized destination has relevant fields. Blank title inherits the event title. Other omitted fields stay unchanged.
- PC-4: Twitch supports title/category. YouTube supports title/description/thumbnail. Metadata is applied per occurrence, including This occurrence / This and following, without altering protected past/current events.
- PC-5: Twitch test output uses bandwidth-test mode on the end user's Runner, never cloud encoding or a public live stream. Test controls remain separate from the primary save action.
- PC-6: Use approved HeroUI layouts, secondary fields, mobile/light/dark review and recoverable local validation. Frontend mutations use server actions; Better Auth owns OAuth callbacks and the existing preview proxy; Runner requests and the internal popup-completion page use route handlers.

Security: authorization state is short-lived, single-use and bound to initiating session, creator and editor. Recheck creator authority at callback; keep provider secrets encrypted, refresh serialized, outbound endpoints fixed and requests bounded. Cancellation preserves the editor draft. A missing provider configuration is a typed recoverable result.
