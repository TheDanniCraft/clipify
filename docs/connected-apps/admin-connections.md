# Administrator-managed application connections

Administrators use **Admin → Connections** to approve a companion app.
Choose the creator, the required clip-read permissions, and a 7-, 30-, or 90-day
clip-access period. Sign-in is optional and uses a separate OAuth client with PKCE and
an exact HTTPS callback. Its sign-in client remains enabled until the connection is
revoked; the chosen expiry limits creator clip access. Sign-in does not grant the
app access to other creators.

The creation dialog displays credentials once. Copy them into the companion
app's private runtime environment; never put them in browser code or commit them.
The list endpoint selects only public connection fields and never retrieves secrets.
Creation and revocation failures open focused feedback without shifting the editor
or discarding its draft. Closing the credentials dialog discards its local state. Lost credentials require
revoking the old connection and creating a new one.

The generic configuration includes `CLIPIFY_CREATOR_ID` and, for sign-in,
`CLIPIFY_CREATOR_SUBJECT`. Babbler Awards maps those values to its existing
`AWARDS_CREATOR_ID` and `AWARDS_OWNER_CLIPIFY_SUBJECT` variables. Its
`CLIPIFY_CLIENT_ID`, `CLIPIFY_CLIENT_SECRET`, `CLIPIFY_IDENTITY_CLIENT_ID`,
`CLIPIFY_IDENTITY_CLIENT_SECRET`, and `CLIPIFY_BASE_URL` use the shown values.

Revocation disables the machine and linked sign-in clients in the same transaction
as the grant revocation and audit entry. Already-issued machine tokens lose gateway
access immediately. Existing sessions inside a companion app remain that app's
responsibility. Creator disablement, grant expiry, and operation restrictions are
also enforced on every gateway call.

No schema change, manual SQL, deployment seed, or automatic production provisioning
is part of this screen. Provisioning happens only when an authenticated administrator
submits the form on the intended Clipify instance.

## Interaction references

[Tailscale key management](https://mobbin.com/screens/c297c1a1-5541-444d-98f2-0df39369d55f)
informed the compact list with expiry, status and revocation. [Wix key creation](https://mobbin.com/screens/a1f6f40a-b17d-45fe-b6f6-14899fa14ffd)
informed the separate one-time credential dialog. The implementation uses Clipify's
HeroUI table, creator combobox, field controls, modal, toast and confirmation patterns.

## Validation

Focused endpoint tests cover administrator and same-origin checks, field validation,
explicit operations, enabled creators, PKCE callback registration, compensation on
partial failure, secret redaction, public listing and bounded pagination.

The acceptance journey uses real installed controls and disposable PostgreSQL. It
covers first creation, preserved drafts after denial, one-time credentials, real
client-credentials token issuance, operation denial, revocation confirmation and
immediate denial of an already-issued token. Desktop dark and mobile light cases
capture screenshots for inspection. Non-administrator access is checked separately.
