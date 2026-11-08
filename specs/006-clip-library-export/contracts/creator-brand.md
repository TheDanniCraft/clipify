# Creator brand and composed-export attribution

`getCreatorBrand(creatorId)` requires creator:read and returns the selected creator's nullable brand, optimistic revision and resolved watermark-removal capability. `getBrandOverlaySources(creatorId)` requires overlay:read and exposes only names/IDs and style fields for import, never overlay secrets. `saveCreatorBrand(creatorId, brand, expectedRevision)` requires creator:update, bounded schema-valid fields, an available font and current Pro entitlement for removal. Typed validation, conflict, permission, font and service failures preserve the client draft.

`GET /api/brand-font?family=...&weight=400|700` serves only the fixed DejaVu font allowlist as public font assets. Paths and arbitrary families are rejected. Missing installed assets return503.

`POST /api/clips/widget-preview` and equivalent GET with bounded encoded data require creator:read for the requested creator. They accept bounded contextual metadata, a validated brand and dimensions totaling at most one million pixels; they return a private no-store PNG. Existing account rate limiting and two concurrent raster jobs bound work. Font errors return a recoverable typed502. Channel avatars are derived from the authorized creator, not the payload.

The export renderer receives account appearance and an effective watermark flag from the server. Untrusted layout fields cannot remove attribution. Free always renders the mark after user layers; Pro can disable it through saved account settings. Original downloads bypass composition and retain their source bytes. Existing export response/progress validation recognizes font_unavailable and offers retry without changing selection or layout.
