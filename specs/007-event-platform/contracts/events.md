# Event Contracts

All management operations receive a verified session/MCP principal and explicit creator ID; use the shared creator authority transaction boundary. Event permissions: read, create, update, review, publish, presenter-secret rotate. MCP and actions call the same service functions.

Creator operations: list/get/create/update event, category/deck configuration, connect storage, search/resolve source, review/list/group/nominate, set manual result, rotate presenter secret, publish event/results. Expected errors are typed local results: INVALID_INPUT, ACCESS_DENIED, NOT_FOUND, CONFLICT, PHASE_CLOSED, LIMIT_REACHED, STORAGE_REQUIRED, PROVIDER_UNAVAILABLE, RECONNECT_REQUIRED.

Public operations: published event DTO + own submissions/votes, source search/resolve constrained by event rules, submit/withdraw, replace own vote selection. Public discovery returns partner-owned listed published events only. No result totals/data categories before publication. Presenter secret grants event-specific presentation DTO and explicit publication only; rotate invalidates previous secrets.

Provider requests use fixed allowlisted public API hosts and bounded timeouts. S3 endpoints require SSRF-safe endpoint validation including resolved-address validation. Uploads enforce configured media classes, bounded size and object ownership; no caller-selected playback proxy URL.
