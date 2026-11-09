# Research decisions

## Existing architecture

Decision: reuse authorizeLockedMutation, getVerifiedSessionPrincipal, Better Auth provider linking, clip-discovery/clip-references, creator-brand and existing dashboard editor/tour patterns. Rationale: keeps agency/team/MCP trust boundaries shared. Alternative rejected: separate login/provider credential store without existing token ownership.

## Viewer auth

Existing Twitch callbacks onboard creator profiles and user creation queues welcome mail. Both must recognize server-validated event participation intent. Viewer-only identities stay in Better Auth tables without creator organization; deliberate creator onboarding remains possible.

## UX references

[7shifts event creation](https://mobbin.com/flows/c1fa7094-ef35-4c93-b013-3aa7c1e34e47?tab=screens): inspected schedule context, focused event form, date/time adjacent to event fields. Use proximity of timing controls, not its modal layout for the whole Clipify editor. Additional flow references gathered before each UI slice.

## Google

Incremental scopes work with one OAuth client; permission checks must inspect granted scopes. Preserve selected YouTube Brand identity. Drive file storage and public delivery are separate concerns; delivery must be validated before release.

## Additional inspected UI references

- [Tally upload](https://mobbin.com/screens/416f33ce-03ed-47ae-8949-0db5b1634da9): visible drop target and size guidance; use inline in submission source form, preserve entered text on failure.
- [Substack selected table actions](https://mobbin.com/screens/1ae6cda7-a71e-408f-bf26-b2198e562d16): selected-count/action toolbar and focused confirmation; borrow for review bulk grouping/nomination, not subscriber-specific semantics.
- Voting search returned [Zoom setup](https://mobbin.com/screens/b8a67c06-900f-43a1-89f7-e786c243f551), not an appropriate nominee-card voting reference. Do not claim its cards as evidence; search refined before voting UI.
- [Pitch slide editor](https://mobbin.com/screens/37d0056e-75e2-499c-a607-6248570906e5): ordered slide list adjacent to selected-slide settings/preview and distinct Present action; simplify to the agreed non-canvas deck editor.

## Presenter reference and chat transport checkpoint

Inspected [Pitch recorder/presentation screen](https://mobbin.com/screens/87702475-884a-4c03-b109-8221d48ab7fe): large central canvas and small navigation at the lower edge. Reuse the restrained presentation controls, not recording controls. Manus speaker notes and Gamma's editable canvas were less relevant to the broadcast output. Existing Pitch slide-order reference still guides the dashboard deck.

Twitch's [current IRC documentation](https://dev.twitch.tv/docs/chat/irc/) recommends EventSub and documents authenticated IRC. A read-only anonymous socket connectivity probe timed out; this is not evidence that a production anonymous chat integration works. The repository already receives signed `channel.chat.message` EventSub notifications and subscribes its existing bot using host `channel:bot` grants. Reuse that established transport for awards rather than introducing another IRC client or exposing creator OAuth tokens to a presenter URL. Relay follows the existing process-local live-overlay architecture; a separate distributed chat framework is outside this PR.

Use the current [SevenTV repository](https://github.com/SevenTV/SevenTV) for API models. The older SevenTV/API repository is archived and must not be treated as the current implementation without checking compatibility.

Presenter canvas reference: Pitch's presentation screen (https://mobbin.com/screens/87702475-884a-4c03-b109-8221d48ab7fe), inspected earlier: large canvas with small unobtrusive bottom controls. Kept media inspection manual and put publication after closing, outside ordinary slide transitions.

Discovery reference: Meetup web events grid (https://mobbin.com/screens/b4fe71f0-664e-439c-a0a8-427f227bd361), image inspected: event title, host and time/status belong together in a scannable card grid. Clipify does not need Meetup's location, attendance or topic filters for the first awards release.

Chat provider verification: Twitch's current EventSub documentation (https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#channelchatmessage) and SevenTV's maintained v3 compatibility endpoints in https://github.com/SevenTV/SevenTV/blob/main/apps/api/src/http/v3/rest/emote_sets.rs and users.rs. Reuse Clipify's existing app-bot channel.chat.message subscription and signature-verifying webhook. Contextual participant login remains identity-only; creator channel:bot permission already exists in the explicit creator authorization flow.
