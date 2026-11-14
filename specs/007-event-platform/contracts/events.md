# Event Contracts

All management operations receive a verified session/MCP principal and explicit creator ID; use the shared creator authority transaction boundary. Event permissions: read, create, update, review, publish, presenter-secret rotate. MCP and actions call the same service functions.

Creator operations: list/get/create/update event, category/deck configuration, connect storage, search/resolve source, review/list/group/nominate, set manual result, rotate presenter secret, publish event/results. Expected errors are typed local results: INVALID_INPUT, ACCESS_DENIED, NOT_FOUND, CONFLICT, PHASE_CLOSED, LIMIT_REACHED, STORAGE_REQUIRED, PROVIDER_UNAVAILABLE, RECONNECT_REQUIRED.

Public operations: published event DTO + own submissions/votes, source search/resolve constrained by event rules, submit/withdraw, replace own vote selection. Public discovery returns partner-owned listed published events only. No result totals/data categories before publication. Presenter secret grants event-specific presentation DTO and explicit publication only; rotate invalidates previous secrets.

Provider requests use fixed allowlisted public API hosts and bounded timeouts. S3 endpoints require SSRF-safe endpoint validation including resolved-address validation. Uploads enforce configured media classes, bounded size and object ownership; no caller-selected playback proxy URL.

Presenter URLs carry their random capability in the URL fragment, not a query parameter. Presenter pages exclude optional site scripts. Capability publication uses the same locked cutoff, complete frozen-result and resolved-tie checks as dashboard publication. Standard MCP reads and creation omit presenter credentials; rotation is a separate explicitly scoped operation.

Public submission/vote/upload contexts lock the enabled creator lifecycle before the event. Source lookup uses that same guard. Disabled creators cannot keep receiving stale-page writes. Google consent and file upload setup remain browser interactions; MCP exposes event configuration, review, manual results, tie decisions and publication through the shared services.
