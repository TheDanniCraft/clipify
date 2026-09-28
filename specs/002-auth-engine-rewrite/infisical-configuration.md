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

| Name                          | Development shape          | Requirement                                                                                 |
| ----------------------------- | -------------------------- | ------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`          | Infisical-generated secret | At least 32 random characters; distinct per environment.                                    |
| `BETTER_AUTH_URL`             | `http://localhost:3000`    | Canonical Better Auth origin.                                                               |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `http://localhost:3000`    | Explicit comma-separated trusted origins; production includes only reviewed HTTPS origins.  |
| `RATE_LIMIT_HASH_SECRET`      | Infisical-generated secret | HMAC key for stored identity/network limiter signals; distinct per environment.             |
| `AUTH_CUTOVER_RUNTIME`        | `legacy`                   | Switch to `better-auth` only after invariant validation; controls the sole token authority. |

## Twitch OpenID Connect / OAuth 2.0

| Name                       | Development shape                                | Requirement                                                                                                             |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `TWITCH_CLIENT_ID`         | Infisical secret                                 | Twitch application client ID.                                                                                           |
| `TWITCH_CLIENT_SECRET`     | Infisical secret                                 | Twitch application client secret.                                                                                       |
| `TWITCH_AUTH_CALLBACK_URL` | `http://localhost:3000/api/auth/callback/twitch` | Must exactly match the Twitch developer-console redirect. Production is `https://clipify.dev/api/auth/callback/twitch`. |

## WebAuthn / passkeys

| Name               | Development shape       | Requirement                                                |
| ------------------ | ----------------------- | ---------------------------------------------------------- |
| `WEBAUTHN_RP_ID`   | `localhost`             | Hostname only; production uses the reviewed Clipify RP ID. |
| `WEBAUTHN_RP_NAME` | `Clipify`               | Human-readable relying-party name.                         |
| `WEBAUTHN_ORIGIN`  | `http://localhost:3000` | Exact origin including scheme; production requires HTTPS.  |

## UseSend transactional mail

| Name                             | Development shape                | Requirement                          |
| -------------------------------- | -------------------------------- | ------------------------------------ |
| `USESEND_API_KEY`                | Infisical secret                 | Environment-specific API credential. |
| `USESEND_BASE_URL`               | `https://app.usesend.com`        | Reviewed provider base URL.          |
| `USESEND_TRANSACTIONAL_FROM`     | `Clipify <no-reply@clipify.dev>` | Verified sender identity.            |
| `USESEND_TRANSACTIONAL_REPLY_TO` | `support@clipify.dev`            | Monitored reply address.             |

Existing newsletter contact-book configuration remains separate from these
transactional-mail settings.
