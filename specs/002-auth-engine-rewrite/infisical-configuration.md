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

| Name                     | Development shape          | Requirement                                                                                 |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`     | Infisical-generated secret | At least 32 random characters; distinct per environment.                                    |
| `RATE_LIMIT_HASH_SECRET` | Infisical-generated secret | HMAC key for stored identity/network limiter signals; distinct per environment.             |
| `AUTH_CUTOVER_RUNTIME`   | `legacy`                   | Switch to `better-auth` only after invariant validation; controls the sole token authority. |

Better Auth's base URL is resolved through the shared `resolveBaseUrl()`
policy: the first `COOLIFY_URL` in a Coolify container, localhost during local
development, and `https://clipify.us` as the non-development fallback. Better
Auth automatically trusts that resolved base origin, so separate
`BETTER_AUTH_URL` and `BETTER_AUTH_TRUSTED_ORIGINS` secrets are not required.

## Twitch OpenID Connect / OAuth 2.0

| Name                   | Development shape | Requirement                   |
| ---------------------- | ----------------- | ----------------------------- |
| `TWITCH_CLIENT_ID`     | Infisical secret  | Twitch application client ID. |
| `TWITCH_CLIENT_SECRET` | Infisical secret  | Twitch application secret.    |

The callback is derived from the shared resolved base URL; there is no separate
callback environment variable. Register these exact redirect URLs in the
Twitch developer console:

- Development: `http://localhost:3000/api/auth/callback/twitch`
- Production: `https://clipify.us/api/auth/callback/twitch`

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
