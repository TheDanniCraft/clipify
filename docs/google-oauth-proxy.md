# Google OAuth preview proxy

Production must register the Google provider because Better Auth exchanges the
provider's authorization code there before forwarding the protected result to
preview. Set `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` in Infisical for both
environments, using the same Google web client and existing `OAUTH_PROXY_SECRET`.
Register `https://clipify.us/api/auth/callback/google` in that client.

Deploy this configuration to production, then redeploy preview to load its secrets.
Google is omitted when either credential is absent or blank. Google new-account
sign-up is disabled; this does not add a Google login button, change account-linking
policy, or release Runner features. No database migration is required.

Test the real consent and return to preview before recording the verification
video. Keep the unverified YouTube permissions on the preview connection flow
until Google verification is complete.
