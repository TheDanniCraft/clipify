# Privacy Request Portal Plan

## Scope and agreed decisions

This document covers only the second delivery phase: a first-party privacy request portal built after the Better Auth and transactional-email migration lands.

The portal will:

- give each requester a case page with status, actions, files, and a conversation;
- use Chatwoot as the conversation system instead of building a second chat backend;
- generate a comprehensive data package containing both stored and derived personal data;
- assist with correction, deletion, consent withdrawal, and other privacy rights;
- keep substantive case communication and downloads on the case page, not in email; and
- remove case content and access 30 days after resolution, subject to a narrowly documented audit-retention exception.

It will not:

- treat a UUID or case reference as authentication;
- offer local editing of Twitch-owned profile fields;
- include live credentials or replayable secrets in an export; or
- duplicate Chatwoot message bodies in a separate Clipify chat database.

## Request intake

Provide a first-party form at `/legal/privacy-requests/new` with:

- request type: access, correction, deletion, portability, restriction, objection, consent withdrawal, or another privacy question;
- contact email and optional Twitch username or Clipify user ID when the requester is not signed in;
- a short scoped description and acknowledgement not to submit passwords, tokens, payment-card details, or identity documents initially;
- abuse protection, rate limiting, CSRF protection, and an accessible confirmation screen.

Signed-in users should start with their known identity already attached. People without an account must remain able to submit requests.

## Case access and authentication

Use two access paths:

### Signed-in requester

- Bind the case to the Better Auth user ID.
- Let the user return through their normal signed-in session without an email round trip.
- Require fresh Twitch authentication before generating or downloading a data package and before confirming deletion.
- Do not ask account-setting questions as an authentication factor.

### Requester without an account

- Assign a non-secret, human-readable case reference.
- Send a separate, short-lived, single-use, high-entropy magic link; store only its hash.
- Redeem the link into a short-lived, HTTP-only, secure, SameSite cookie and immediately redirect to a URL without the token.
- Provide a one-time-code fallback and require fresh verification before a sensitive download or final deletion confirmation.

Email is only an out-of-band access, recovery, or generic notification channel. It must not contain case messages, personal-data summaries, or packages. Every case read and mutation must enforce ownership server-side. References must not be enumerable, and tokens, codes, and download URLs must be rate-limited and excluded from logs and analytics.

## Case page and states

Use an explicit state machine:

- `opened`
- `verifying_identity`
- `in_review`
- `waiting_for_requester`
- `processing`
- `package_ready`
- `resolved`
- `limited_or_refused`

The page should show:

- the current state, next action, verification state, and expiry date;
- a timestamped event timeline;
- the Chatwoot-backed conversation;
- available package files and their expiry; and
- self-service actions that are safe for the current case state.

Chatwoot conversation states must not silently change the legal case state. Explicit portal rules or a staff action should perform each case transition.

## Chatwoot-backed conversation

Use a dedicated Chatwoot API inbox. Chatwoot remains the system of record for message bodies and attachments; Clipify stores only the case-to-Chatwoot mapping and the minimum delivery metadata needed for authorization and idempotency.

When a case is created, the server should:

1. create or locate the Chatwoot contact;
2. create a contact-inbox source mapping;
3. create one conversation for the case; and
4. save the Chatwoot contact, inbox, source, and conversation identifiers with non-sensitive case attributes.

Use a least-privilege server-side Chatwoot token. Never expose it to the browser.

Build the conversation as a first-party component on the case page. It calls an authenticated Clipify backend that:

- lists requester-visible Chatwoot messages;
- posts requester messages as incoming messages;
- returns agent replies and delivery updates;
- supports carefully validated attachments; and
- never exposes Chatwoot private notes.

Do not add a separate Clipify messages table or copy message bodies into the case timeline. The timeline may record content-free events such as “requester message received” or “staff replied.”

Register signed Chatwoot webhooks for message and conversation events. Verify the timestamp and HMAC signature against the raw request body, reject stale requests, and process event IDs idempotently.

Attachments need a strict type allowlist, size limit, malware scanning, and an authorized download proxy so a raw Chatwoot asset URL cannot bypass case access checks.

## Comprehensive data package

Generate an asynchronous ZIP archive with:

- a readable `README.html` or `README.txt` explaining the package and warning that it may contain sensitive personal data;
- a manifest listing every system and data category checked, whether matching data was found, the export time, schema version, and any omission with its reason;
- machine-readable JSON for completeness;
- CSV files where tabular review is useful; and
- requester-owned attachments that are part of the stored record.

The export adapters should cover all personal data Clipify can associate with the requester, including:

- Twitch and Clipify identifiers and historical profile snapshots;
- account configuration, connected services, configured features, and user preferences;
- consent records and communication preferences;
- subscription, entitlement, invoice, and payment-provider references held by Clipify;
- Chatwoot support conversations and requester-visible attachments;
- privacy cases and their requester-visible history;
- attributable audit, security, and operational-log records where disclosure does not expose another person or create a concrete security risk;
- derived or inferred data, classifications, scores, flags, and the purpose for which each is used; and
- systems that were checked but contained no matching data.

The goal is to disclose both what Clipify knows and what it has inferred, not merely dump the main user row. Exports must redact other people's data and explain each redaction or omission in the manifest.

### Token metadata

Include the raw metadata Clipify stores about tokens, such as:

- provider and provider subject;
- internal token-record identifier and token type;
- granted scopes;
- creation, update, issue, expiry, refresh, revocation, and last-used timestamps when stored;
- active, expired, revoked, or disconnected status; and
- relationships to accounts or connected features.

Never include access-token or refresh-token values, encrypted token ciphertext, encryption nonces or authentication tags, key references, session cookies, signing secrets, or any other value that can authenticate or help replay a credential. Encryption makes a secret safer at rest; it does not turn that secret into useful personal-data export content.

Security-sensitive personal data should otherwise be disclosed by default. Omit only the minimum needed to protect another person, comply with a legal duty, preserve a genuine trade secret, or avoid a concrete security risk, and record the reason in the manifest.

Packages must be encrypted at rest and delivered through short-lived, single-use or tightly rate-limited authorized downloads with strict content disposition and an auditable creation and access record.

## Automated actions

### Access and portability

- Automatically assemble the comprehensive package after fresh authentication for signed-in users.
- Route identity conflicts, third-party data, or exceptional redactions to a human reviewer.
- If a narrower portability package is legally or technically appropriate, label it separately rather than presenting it as the full access package.

### Correction

- Do not create editable local profile fields for Twitch-sourced data.
- Explain which fields come from Twitch, link the user to correct them at Twitch, and provide a “refresh from Twitch” action.
- Route corrections of Clipify-owned records to staff or a purpose-built action.

### Deletion

- Generate a preflight showing what will be deleted or disconnected, what downstream systems are involved, and any data proposed for retention with its reason.
- Require fresh authentication and an explicit confirmation.
- Queue destructive work so it is observable, retryable, and cancellable before execution starts.
- Automate only known-safe deletion adapters; route legal holds, billing retention, disputed ownership, shared resources, and partial refusals to staff.
- Report per-system completion on the case page without exposing internal secrets.

### Other rights

- Provide direct consent-withdrawal actions when the existing consent system can apply them safely.
- Treat restriction, objection, disputed identity, and legal exceptions as human-reviewed workflows supported by the same case page and Chatwoot conversation.

## Retention after resolution

Thirty days after a case is resolved:

- revoke all case sessions and access links;
- delete generated packages and temporary verification material;
- delete the dedicated Chatwoot conversation, its attachments, and the contact if it is not shared with another support purpose;
- delete the Clipify case-to-Chatwoot mapping and requester-visible timeline; and
- make the case page inaccessible.

Keep only a separately protected minimal audit record when a documented legal, security, or dispute-retention need applies. It should contain no conversation content, package contents, attachments, or reusable access material. The portal must explain this narrow exception instead of promising that every trace is erased.

## Suggested implementation slices

1. Case schema, state machine, authorization policy, and purge jobs.
2. Intake form, signed-in access, non-account magic-link access, and fresh-auth gates.
3. Staff review queue and the case page shell.
4. Chatwoot contact, inbox, conversation, message, attachment, and signed-webhook integration.
5. Versioned export-adapter contract, manifest, package generator, and secure delivery.
6. Twitch refresh and consent-withdrawal actions.
7. Deletion preflight and queued per-system deletion orchestration.
8. Abuse tests, authorization tests, retention verification, operational monitoring, and compliance review.

## Acceptance criteria

- A case reference alone never grants access.
- A signed-in requester can use the portal without moving the conversation to email.
- A requester without an account can recover secure access through email while all substantive content remains on the case page.
- Each case maps to one dedicated Chatwoot conversation, and Clipify does not maintain a duplicate chat history.
- Requesters can never see Chatwoot private notes.
- The package manifest shows every checked adapter, including adapters with no matching data and every redaction or omission.
- Token metadata is exported without any credential value, ciphertext, or cryptographic material.
- Stored and derived personal data are both represented.
- Twitch-owned profile corrections direct the requester to Twitch and allow a refresh afterward.
- Package downloads require current authorization and expire quickly.
- Deletion shows a preflight, requires fresh authentication, and reports per-system progress.
- Thirty days after resolution, the case page, Chatwoot conversation, attachments, packages, and access material are unavailable, leaving only any justified minimal audit record.
