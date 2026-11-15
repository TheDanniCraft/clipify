# Connection contract

Resource /api/connected-apps. Token POST /api/auth/oauth2/token with Basic client authentication, grant_type=client_credentials, scope=creator:read, resource=<origin>/api/connected-apps. Machine tokens have clipify_application=true and sub/client_id identifying the registered app, never a creator.

POST gateway body {operation:"search_clips",input:{creatorId,filters:{title?},limit?,cursor?}}. SDK may pass supported existing discovery filters; invalid/unknown keys rejected. Result {ok:true,data:{creatorId,items,complete,sortScope,scanned,timezone,window,nextCursor}} with existing public clip projection. Error {ok:false,error:{code}}. 400 invalid input; 401 credentials/token; 403 grant/creator access; 429 rate limit plus Retry-After; 503 unavailable. No internal exception or credentials returned.

POST admin route uses actual authenticated own-identity platform admin. Action provision accepts name,creatorId,expiresAt and enables only search_clips. Action revoke accepts grantId. Provision returns clientId/clientSecret/grantId once; operator CLI writes mode-0600 credentials file exclusively. No success credentials in logs. Route must refuse cross-origin state changes.
