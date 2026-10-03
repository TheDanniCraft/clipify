# Infisical configuration contract

Clipify loads runtime configuration through Infisical. Do not create local
`.env` files for this feature, commit secret values, or pass secrets on command
lines. Provision the following names in the appropriate Infisical environment
and inject them into the application process.

## Application and database

| Name                   | Development shape       | Requirement                                                                                            |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`         | `postgresql://…`        | Environment-specific PostgreSQL URL; migration rehearsals must use a disposable non-production target. |
| `NEXT_PUBLIC_BASE_URL` | `http://localhost:3000` | Public application origin.                                                                             |

## Better Auth

| Name                     | Development shape          | Requirement                                                                     |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`     | Infisical-generated secret | At least 32 random characters; distinct per environment.                        |
| `RATE_LIMIT_HASH_SECRET` | Infisical-generated secret | HMAC key for stored identity/network limiter signals; distinct per environment. |

There is no persistent auth-runtime feature flag. Better Auth account storage
is the only production Twitch credential authority. Cutover approvals and run
identifiers are one-shot operator inputs supplied only to the migration process;
they are not application configuration stored in Infisical.

Better Auth's base URL is resolved through the shared `resolveBaseUrl()`
policy: the first `COOLIFY_URL` in an actual Coolify container, the configured
`NEXT_PUBLIC_BASE_URL` outside Coolify, localhost when no explicit URL exists
during local development, and `https://clipify.us` as the final fallback.
Legacy `PREVIEW_CALLBACK_URL` values and the n8n callback relay are retired.
Localhost sign-in uses its registered callback directly. Better Auth's OAuth
Proxy sends trusted remote preview sign-ins through the stable production
callback and returns an encrypted, short-lived identity package to the
originating deployment. `OAUTH_PROXY_SECRET` is optional at application startup
so local development is never gated on the proxy deployment. When remote
previews are enabled, set it to one dedicated high-entropy value shared by
production and those trusted previews; otherwise the plugin falls back to each
environment's Better Auth secret, which works only when those secrets match.
Never expose either secret to untrusted preview code. Separate `BETTER_AUTH_URL` and
`BETTER_AUTH_TRUSTED_ORIGINS` secrets are not required; the reviewed application
origin policy and trusted Clipify origins are configured in code.

## Twitch OpenID Connect / OAuth 2.0

| Name                   | Development shape | Requirement                   |
| ---------------------- | ----------------- | ----------------------------- |
| `TWITCH_CLIENT_ID`     | Infisical secret  | Twitch application client ID. |
| `TWITCH_CLIENT_SECRET` | Infisical secret  | Twitch application secret.    |

Register these redirect URLs in the Twitch developer console:

- `http://localhost:3000/api/auth/callback/twitch`
- `https://clipify.us/api/auth/callback/twitch`

Local development and production use their respective callbacks directly.
Trusted remote previews use the production callback through Better Auth's OAuth
Proxy, which then completes the session on the preview origin. No n8n workflow
is required.

## WebAuthn / passkeys

Passkey configuration uses the same shared `resolveBaseUrl()` result as Better
Auth. The RP ID is the resolved hostname, the origin is the resolved origin,
and the human-readable RP name is always `Clipify`. Separate `WEBAUTHN_*`
settings are not required. Passkeys remain isolated by hostname as required by
WebAuthn, so credentials registered on localhost, a preview hostname, and
`clipify.us` are intentionally distinct.

## UseSend transactional mail

| Name                             | Development shape               | Requirement                          |
| -------------------------------- | ------------------------------- | ------------------------------------ |
| `USESEND_API_KEY`                | Infisical secret                | Environment-specific API credential. |
| `USESEND_BASE_URL`               | `https://app.usesend.com`       | Reviewed provider base URL.          |
| `USESEND_TRANSACTIONAL_FROM`     | `Clipify <no-reply@clipify.us>` | Verified sender identity.            |
| `USESEND_TRANSACTIONAL_REPLY_TO` | `contact@clipify.us`            | Monitored reply address.             |

Existing newsletter contact-book configuration remains separate from these
transactional-mail settings.
