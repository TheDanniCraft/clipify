# Privacy Request Portal Plan

## Delivery phases

### Phase 1: mergeable policy and navigation fixes

This branch keeps the existing email-based privacy-request process and:

- links the privacy notices of external providers named in the Privacy Policy;
- replaces the repository-only `SECURITY.md` direction with the public security contact;
- removes the inaccurate office-visit wording; and
- makes footer links to Features and FAQs work from every route.

### Phase 2: privacy request cases

Build the case portal after the Better Auth and transactional-email migration lands. Keep email as a durable fallback channel throughout the rollout.

#### Request intake

Provide a first-party form at `/legal/privacy-requests/new` with:

- request type: access, correction, deletion, portability, restriction, objection, consent withdrawal, or another privacy question;
- contact email and optional Twitch username or Clipify user ID;
- a short scoped description and acknowledgement not to submit passwords, tokens, payment-card details, or identity documents initially;
- abuse protection, rate limiting, CSRF protection, and an accessible confirmation screen.

An authenticated user may start from account settings with known account details prefilled. People without an account must remain able to submit a request.

#### Case access and authentication

Do not use a UUID by itself as authentication. Use a non-secret human-readable case reference plus a separate, high-entropy bearer token:

1. Email a short-lived, single-use magic link after intake.
2. Store only a hash of the token.
3. Redeem it into a short-lived, HTTP-only, secure, SameSite cookie and immediately redirect to a URL without the token.
4. Offer an emailed one-time code as a fallback and require fresh verification before a sensitive download or final deletion confirmation.
5. Bind authenticated requests to the account when possible, while retaining the email verification path for non-account requests.

Do not use questions about account settings as the primary authentication factor; those answers can be guessable or visible to collaborators. They can support a manual verification decision when stronger account or email proof is unavailable.

Every case read and mutation must enforce case ownership server-side. Case identifiers must not be enumerable, and tokens, codes, and download URLs must be rate-limited and excluded from logs and analytics.

#### Case states

Use an explicit state machine rather than free-form status text:

- `opened`
- `verifying_identity`
- `in_review`
- `waiting_for_requester`
- `processing`
- `package_ready`
- `resolved`
- `limited_or_refused`

The case page should show a timestamped timeline, the next action, messages, verification state, files that are ready, and the date on which portal access expires.

#### Safe automation

Automate preparation, not legal judgment:

- Generate an allowlisted summary of account profile data, connected services, configured features, consent choices, subscriptions, and support conversations.
- Build exports asynchronously from versioned per-domain adapters rather than dumping database rows.
- Include token metadata such as provider, scopes, status, and relevant dates, but never include access tokens, refresh tokens, encrypted token ciphertext, session secrets, password-equivalent values, fraud signals, or another person's data.
- Let signed-in users correct suitable profile fields and use the existing account-deletion control where it is sufficient.
- For deletion, generate a preflight showing what can be deleted, what will be disconnected, and what may need to be retained. Require a fresh verification step and queue destructive work so it can be reviewed or cancelled before execution.
- Route legal exceptions, disputed identity, third-party data, billing retention, legal holds, and partial refusals to a human reviewer.

Exports should use short-lived signed downloads, encryption at rest, strict content disposition, malware-safe generation, and an auditable record of creation and access.

#### Email and support chat

Transactional email should notify the requester when verification is needed, a response is posted, a package is ready, or the case is resolved. Emails should link to the case without including personal data.

Chatwoot should not be embedded as the case system or the only request channel. An iframe is likely to conflict with frame and consent controls, and a chat transcript is a poor authoritative case record. If conversational help is useful, integrate Chatwoot through its API or webhooks so selected messages are copied into the case timeline, or offer an optional consent-gated chat link while keeping the portal as the source of truth.

#### Retention

Revoke portal access and delete the case conversation, generated packages, and temporary verification material 30 days after resolution. Keep only a separately protected, minimal audit record when a documented legal, security, or dispute-retention need applies. The UI must state this distinction instead of promising that every trace of the request is erased after 30 days.

#### Suggested implementation slices

1. Schema, state machine, permissions, and retention jobs.
2. Intake form, email verification, and case timeline.
3. Staff review queue and requester messaging.
4. Allowlisted data summary and export adapters.
5. Deletion preflight and queued deletion orchestration.
6. Optional Chatwoot bridge, observability, abuse tests, and compliance audit.

## Phase 3: community-powered demo

Defer this until the portal and authentication migration are stable. Start with a curated, opt-in showcase from partners and approved creators instead of accepting arbitrary public clips.

Require explicit display permission, a revocation path, content and quality review, minimum playback-quality checks, and a reliable fallback asset. Periodically verify that showcased clips still exist and play smoothly. A small rotating set of approved community examples will feel more authentic than a single house demo without introducing the moderation, licensing, and reliability risk of an open submission feed.
