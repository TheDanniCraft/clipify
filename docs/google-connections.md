# Google feature connections

Better Auth owns authorization, state, PKCE, provider callbacks, encrypted tokens,
linking and refresh. Its Generic OAuth plugin registers two additional Google OIDC
providers alongside the existing built-in Google provider. Provider IDs give the
same Google identity independent account rows rather than replacing its existing
Runner tokens.

| Provider ID             | Feature permission requested when connected |
| ----------------------- | ------------------------------------------- |
| `google`                | Runner: `youtube.force-ssl`                 |
| `google-drive`          | Event storage: `drive.file`                 |
| `google-events-youtube` | Event video selection: `youtube.readonly`   |

The additional providers initially request only OpenID identity scopes. Registering
them does not automatically request Drive or Event YouTube permissions from existing
users. Feature connections request their permission explicitly. Grant merging is
disabled so a previous Drive grant is not automatically added to a YouTube request.
Normal Google reauthentication preserves an existing Runner credential, as normal
Twitch reauthentication already does.

## Stable callbacks and deployment order

Keep the existing Google OAuth client and callback:

`https://clipify.us/api/auth/callback/google`

Add these authorized redirect URIs to that client:

- `https://clipify.us/api/auth/callback/google-drive`
- `https://clipify.us/api/auth/callback/google-events-youtube`

These are Better Auth's standard callback routes. Do not add PR-specific Google
redirect URIs or bypass the OAuth proxy. Better Auth sends Google to the stable
production callback, where it resolves the provider, exchanges the code and forwards
the encrypted result to the preview's `/api/auth/callback/:id/oauth-proxy` route.

Production must register both provider IDs before a preview starts using them.
Otherwise the production proxy cannot resolve the provider and returns
`oauth_provider_not_found`. This prerequisite intentionally does not deploy Event
pages or turn on new permissions for the existing Runner flow.

The new sensitive `youtube.readonly` permission still needs its own Google approval;
the existing `youtube.force-ssl` approval does not cover it. `drive.file` remains the
non-sensitive per-file storage permission. Separate account rows do not change
Google's project-wide token revocation behavior.

## Validation

`test/server/runner/google-provider-registration.test.ts` executes actual Better Auth
production-to-preview proxy round trips for both providers using disposable local
PostgreSQL. It verifies stable redirect URIs, isolated requested permissions, OIDC
verification configuration, distinct account rows for one Google subject and the
unchanged application session. Only external provider replies are fixtures.

`test/server/runner/provider-auth-link.test.ts` owns the existing production/preview
Twitch and Google Runner flows, including basic reauthentication and token refresh.
The Google reauthentication regression failed with `login-only-access` replacing
`linked-access` before the existing preservation hook was extended to Google.

Live Google consent and Google Console registration remain operator checks. These
tests do not establish Google's review approval or replace the complete CI gate.
