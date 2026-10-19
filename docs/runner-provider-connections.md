# Runner channel connections

Runner destinations are account-wide. Connect Twitch or YouTube once in Manage destinations and reuse that destination on other computers. Manual stream keys remain available. Connecting a streaming channel does not add a new Clipify login provider or change the scopes requested at normal Twitch sign-in.

The connection prompt requests all supported streaming permissions together:

| Provider | Permissions                                                             | Configuration                                          |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Twitch   | `channel:read:stream_key`, `channel:manage:broadcast`                   | Existing `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` |
| YouTube  | `https://www.googleapis.com/auth/youtube.force-ssl` with offline access | `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET`        |

Register the exact production or preview origin followed by `/runner/connect/twitch/callback` or `/runner/connect/youtube/callback` in the provider console. YouTube uses a web OAuth client with the YouTube Data API enabled. Configure the Google consent screen and complete Google's applicable verification before enabling it for public users. It is a streaming authorization, not Google sign-in.

YouTube destinations select an existing stream key from the connected channel. Create it in YouTube Studio if the channel has none. For scheduled metadata, bind one upcoming or live broadcast to that stream key. Clipify refuses ambiguous matches rather than changing an arbitrary video. It does not create, publish or change a video's privacy automatically.

## Scheduled details

Pro's event editor has a Set stream details toggle, off by default. When enabled, it exposes each selected connected channel. An empty stream-title override uses the event title. Other empty fields preserve the provider's existing values. Twitch supports title/category; YouTube supports title/description/thumbnail. The existing This occurrence / This and following choices preserve metadata along with each occurrence's schedule. Current and past streaming settings stay read-only.

Details are captured with the authorized occurrence, not applied while generating its seven-day cache. A connected Runner's heartbeat applies due updates before returning execution commands. If the Runner starts from its offline cache, the provider's previous details remain until the Runner reconnects during that occurrence. Metadata failure does not terminate an otherwise valid broadcast. Failed updates appear on the schedule and retry with a one-minute backoff.

## Private Twitch tests

Test connection sends video from the user's Runner to Twitch with `?bandwidthtest=true`. It uses a temporary session, the Runner's saved target overlay and a single Twitch-owned output. Existing broadcasts must stop first. It never encodes in Clipify's cloud, writes a reusable test destination or changes the saved broadcast configuration.

The selected 30/60/120-second deadline bounds the signed output lease, including offline operation. End test requests an immediate stop; expiry also requests a stop on heartbeat. Normal output-closure acknowledgement remains necessary before releasing occupied capacity. Closing the browser cannot extend the deadline.

## Security and validation

Connection state is random, short-lived, single-use, and bound to the initiating authenticated session, creator and provider. Both begin and callback recheck creator authority. Provider tokens and stream keys are encrypted at rest. OAuth responses, browser views and logs exclude tokens and keys. Row locks serialize refresh rotation; an expected downstream denial commits a successful refresh so it cannot lose a rotated token. Provider requests use fixed HTTPS endpoints, bounded bodies and deadlines.

No generated migration belongs on the feature branch. The normal master migration workflow owns the schema change.

Local validation uses disposable loopback PostgreSQL, fixture accounts and controlled provider responses. The browser journey uses installed HeroUI components and intercepts only the external consent page. Real consent, live-stream eligibility and delivery must also be checked with authorized provider test accounts after credentials and callback URLs are configured.
