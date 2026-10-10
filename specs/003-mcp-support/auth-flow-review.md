# Better Auth flow review — 2026-10-10

The production MCP incident exposed two application integration mistakes: explicitly storing large OAuth state in a browser cookie, and manually resuming MCP login through a nested consent return URL. Use the installed Better Auth 1.7.7 state storage and OAuth provider continuation instead.

## Reviewed boundaries

| Boundary                         | Result                                                                                                                                                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Twitch sign-in and state         | Use native provider, database state, signed browser binding, expiry and one-time consumption. No custom state serialization.                                                                                                                                                                                               |
| MCP login                        | Configure `/login`, install `oauthProviderClient()`, and leave the provider-signed query on the login page. The provider stores server context and resumes authorization after session creation.                                                                                                                           |
| Existing sessions / login prompt | A provider login request must reach sign-in even if an old session exists; the ordinary dashboard redirect must not override reauthentication.                                                                                                                                                                             |
| MCP consent                      | Keep `/auth/mcp/consent` for creator selection and permissions. Verify the signed query with the provider utility and submit approval through its native consent endpoint. Clipify grant records bind tokens to creator authority; they are application policy, not alternate OAuth processing.                            |
| Ordinary login / checkout        | Keep native social sign-in with a local callback destination. Validate local return paths using URL parsing, including browser normalization of backslashes and control characters. Checkout intent remains separate from identity/session state.                                                                          |
| Legacy bot entrypoint            | Native social sign-in returns JSON plus Location; translate successful GET navigation into an HTTP redirect while retaining all native cookie headers. Preserve failure responses.                                                                                                                                         |
| Logout / sessions                | Use native sign-out, forward cookie deletion headers and obtain sessions through native getSession. Clipify resolves creator/account status after identity validation. Application-purpose JWTs are not dashboard sessions.                                                                                                |
| Invitations                      | Persisted production invitations, emailed magic links and copied-link email-code sign-in use native organization, magic-link and email-OTP APIs. Clipify role and agency activation checks remain application policy.                                                                                                      |
| Email change                     | Remove manual code retrieval. Hashed OTPs cannot be read back as plaintext. Native sendVerificationOTP and requestEmailChangeEmailOTP invoke the delivery callback with the generated code; native changeEmail verifies and consumes it.                                                                                   |
| Passkeys / linking               | Enrollment and removal use the native client plugin. The native provider owns linking; intentional restrictions reject implicit same-email linking and unlinking the final provider. No replacement WebAuthn or account-linking implementation.                                                                            |
| Preview proxy                    | Use the official OAuth proxy with explicit public currentURL, stable production callback, dedicated shared secret and native state restoration. Production skips proxying. The plugin carries encrypted data across preview/production; this review does not claim an actual long OpenAI login was completed on a preview. |
| Onboarding / refresh             | Retain transaction-backed creator provisioning and bounded refresh handling: these maintain Clipify records and observe Twitch revocation, while Better Auth owns account/session/token persistence.                                                                                                                       |
| Resource startup race            | Retain the narrow adapter compatibility wrapper so the provider can recognize Drizzle's wrapped duplicate-resource error and execute its own race recovery. Other errors still propagate; this is not replacement OAuth logic.                                                                                             |

## Evidence and limits

- Installed-provider tests complete signed MCP authorization, simulated Twitch exchange, consent approval and PKCE token exchange with a 1,200-character client relay state. Cancellation/retry, tampering and expiration are covered.
- Installed email-OTP tests complete both email-change phases with hashed storage and demonstrate that reading the hash as plaintext fails.
- Configuration, route and component regressions cover login/checkout precedence, existing-session prompts, creator consent, bot redirect cookies, invitation UI, refresh bounds and resource error handling.
- HTTP handler tests simulate Twitch's token response and user profile. They do not constitute a successful OpenAI dashboard connection or an actual Twitch account login.
- Better Auth's normal delivery callback logs delivery failures through its built-in background/await handler. The removed manual email-change sender must not be described as continuing to propagate mail-provider failures synchronously to the UI.
- PR/master CI and the post-deployment OpenAI connection are separate checkpoints. Green automated tests do not imply a successful live client connection.

## References

- https://better-auth.com/docs/reference/options#storestatestrategy
- https://better-auth.com/docs/plugins/oauth-provider
- https://better-auth.com/docs/plugins/oauth-proxy
- https://better-auth.com/docs/integrations/next
- https://better-auth.com/docs/plugins/email-otp
- https://better-auth.com/docs/plugins/organization
- https://better-auth.com/docs/plugins/magic-link
- https://better-auth.com/docs/plugins/passkey
