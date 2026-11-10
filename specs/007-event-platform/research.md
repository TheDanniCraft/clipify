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

## Resource creation and load recovery refinement

[Revolut Business connection issue](https://mobbin.com/screens/b719158e-0a19-4b2e-8cc0-5217648ea20a): inspected the short error caption and retry grouped within the resource area. Clipify keeps its existing surface tokens, muted 14px body copy and compact secondary action in one responsive row/stack. The shared ResourceLoadError applies this to Events, discovery, layout loading and streams without changing field-validation errors. Creation follows Clipify's existing overlay/gallery pattern: create a generic unlisted New event draft and navigate directly to its editor; no title modal and no Awards-specific creation label.

## Event workspace and safe review links

Follow-up references: Payloadbay's route-aware dashboard shell in [PR 13](https://github.com/payloadbay/payloadbay/pull/13), GitLab project navigation and n8n context, plus Gamma/Pitch slide editing (individual Mobbin screen links in ux-audit.md). Adopt focused Event navigation, an ordered slide strip and the same show renderer as a stable editable preview. Keep the installed Clipify/HeroUI visual language.

The installed HeroUI Switch implementation makes Switch.Content the interactive SwitchButton. Control/Thumb belong inside it alongside the Label. A hidden-input click does not verify this composition; the regression must click the visible control.

Google [incremental authorization](https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth) supports requesting the relevant extra scope when a feature is used; separate OAuth clients are not required for that purpose. Google identifies [drive.file](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) as the recommended non-sensitive per-file scope. Reuse the existing linking and contextual intent flow; verify the generated redirect scopes. This does not claim exemption from all branding/provider configuration requirements or verify a live consent exchange.

Shareable previews need a different capability from a presenter that can publish results. Use a signed seven-day token bound to the event and current presenter generation, no schema change. Its read projection can include unreviewed root candidates, labelled as a preview, while excluding grouped originals and voter identity. Protected media verifies both this capability and the referenced root nominee. A preview never advances phases, freezes data, casts votes or publishes results.

## Google OAuth incident: verification, grants and return URLs (2026-11-09)

The user's screenshots confirm approved branding, approved data access and a green check beside youtube.force-ssl. They list drive.file as non-sensitive. The Event connection nevertheless requests the separate sensitive scope youtube.readonly, absent from that list; the supplied consent description, “YouTube-Konto abrufen”, matches it. Approval of the existing Runner scope is real. It does not establish approval of the additional Event scope. Google's [minimum-scope migration guidance](https://support.google.com/cloud/answer/13807380?hl=en) explicitly warns that using new narrower scopes before approval produces the unverified-app warning. [Data access management](https://support.google.com/cloud/answer/15549135?hl=en) describes adding the scope, submitting new sensitive scopes and providing a justification/demo. Retain the approved production scope during that process. No fixed propagation delay or need to redo approval of the existing Runner scope has been established.

The incompatible-scope error is separate: Google explicitly rejected drive.file together with youtube.force-ssl in the user's request. Both Event and Runner link calls enable include_granted_scopes, also enabled by default in the installed Better Auth Google provider. [Google's incremental authorization documentation](https://developers.google.com/identity/protocols/oauth2/web-server#incrementalAuth) says earlier grants can combine across clients within one project and cause warnings/errors. Production and preview share a client; the public production initiation response for the Runner contains only basic identity plus force-ssl explicitly, with grant merging enabled. This does not establish the effective merged scopes of a signed-in user or prove all production users are affected. Simply deleting the merging flag is insufficient because the provider default still enables it. Simply setting it false without credential isolation is also unsafe: Event and Runner connections currently reference one linked Better Auth credential, and linking a different grant can replace it. Do not revoke existing tokens or request broad Drive access as a workaround.

The internal redirect is a separate proven application bug, fixed with resolveBaseUrl in the existing Event completion route. Both flows already use Better Auth linking and the existing Google callback/proxy; Event completion is an application destination, not an additional Google callback registration. The standalone preview MCP approval failure remains unresolved live, despite successful disposable real-browser OAuth/SDK flows. Existing CMS timeouts are not evidence for either OAuth cause.

Sanitized research exports: reports/google-oauth-research-2026-11-09.json and .jsonl. They include observations, source links, precise remaining uncertainties, Console steps, an Event readonly justification and validation evidence. They omit session URLs, cookies, codes, tokens and secrets. No original audio is available and no export was uploaded to an external service.

## Independent Google grants through the existing proxy

The same Google subject linked twice as provider `google` updates one Better Auth account, because the account key is provider ID plus immutable provider subject. Separate permission bundles therefore need separate provider IDs. Use the installed [Generic OAuth plugin](https://better-auth.com/docs/plugins/generic-oauth) to register `google-drive` and `google-events-youtube`, with Google OIDC discovery, required ID-token verification, nonce and PKCE. Keep the built-in `google` provider for Runner. All credentials, callbacks, exchanges and refresh remain Better Auth owned; there is no custom OAuth handler or token snapshot store. Disable inclusion of earlier grants so Drive and YouTube are not combined automatically.

Production's proxy resolves the provider before exchanging the code. PR [561](https://github.com/TheDanniCraft/clipify/pull/561) is the isolated production registration prerequisite for Event PR 560. Add only the two stable production callback URIs documented in docs/google-connections.md. An earlier proposed preview callback/proxy bypass was incorrect and withdrawn. Final tests exercise production callback → encrypted proxy payload → preview completion without a bypass. Registering the providers requests no new feature permissions from existing production users.

Events initiates authorization through the existing authClient.linkSocial browser API after the server checks creator/session authority and creates the intent. This avoids issuing OAuth cookies inside a Server Action and its accompanying page rerender. The original user screenshot's global crash was not reproduced by ordinary local browser runs; no matching Sentry event was available. This is not evidence that the screenshot was spurious, and live verification remains necessary after the prerequisite is deployed.

Basic Google reauthentication had a separately reproduced credential bug: it replaced a Runner token with login-only-access in both production and preview. Reuse the existing Twitch credential-preservation hook for Google. Native tests now retain three encrypted account rows for one Google identity, preserve other links across reconnect/denial, refresh all three independently through Better Auth and keep the session. Legacy Event links using the shared google account require reconnecting; their Runner tokens are not rewritten. Google revocation is project-wide, so removing a separate Event link or a Google link with known siblings does not revoke the shared project grant.
