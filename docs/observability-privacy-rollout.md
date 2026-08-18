# Observability and privacy rollout

## Data ownership

- Plausible: aggregate acquisition and conversion events.
- Grafana Faro: operational browser errors, Web Vitals, and navigation/resource performance. The configured SDK disables session tracking, console capture, tracing, geolocation, replay, and user metadata.
- Microsoft Clarity: consented session recordings, heatmaps, and qualitative funnel events. Advertising storage is always denied.
- Sentry/Bugsink: retained during the Grafana parity period. Remove only after production Faro and structured-log alerts have been verified.

## Required environment

- `NEXT_PUBLIC_FARO_COLLECTOR_URL=<Grafana Frontend Observability collector URL>`
- `NEXT_PUBLIC_CLARITY_PROJECT_ID=<Clarity project ID>`
- `NEXT_PUBLIC_ADOPT_ANALYTICS_TAG_ID=<GoAdopt Analytics tag UUID>`
- Release and environment metadata are embedded automatically by the build; no runtime variables are required.

Missing collector/project values leave the corresponding integration disabled.

## GoAdopt configuration

1. Add Microsoft Clarity as an Analytics vendor and use its tag UUID as `NEXT_PUBLIC_ADOPT_ANALYTICS_TAG_ID`.
2. Do not classify Clarity as Required. Map only Analytics consent to Clarity `analytics_Storage`; `ad_Storage` remains denied.
3. List Grafana Cloud Frontend Observability as operational monitoring. This implementation creates no Faro cookie or web-storage session identifier.
4. Rescan after deployment and verify `_clck` and `_clsk` appear only after Analytics consent.

## Privacy-policy update checklist

The hosted policy must be updated before Clarity is enabled. The final language requires legal review and should:

- Remove the current statement that accessing the service itself constitutes consent.
- Describe browser/device metadata, performance timings, navigation/resource measurements, frontend errors, and—only with consent—DOM reconstructions, clicks, scrolling, and interaction events.
- Separate purposes and legal bases: minimized reliability monitoring and aggregate measurement under Article 6(1)(f) GDPR; Clarity behavior analytics under Article 6(1)(a) GDPR and section 25(1) TDDDG.
- Explain Clipify's legitimate interests, safeguards, Article 21 objection right, and a contact path for objections.
- Name Grafana Labs and Microsoft Ireland, their roles, processing regions, subprocessors, DPAs, and applicable international-transfer safeguards.
- Disclose configured retention: Grafana logs/traces 30 days, Grafana metrics up to 13 months, Clarity playback 30 days, Clarity click/heatmap and labeled/favorited records 9 months, and Plausible aggregates 24 months.
- Explain consent withdrawal and data-subject requests, and reconcile the inconsistent `contact@clipify.us` / `mail@thedannicraft.de` contact addresses.

The hosted Cookie Policy must add `_clck` and `_clsk`, their purposes and durations, while documenting that the configured Faro profile uses neither cookies nor session storage.

## Production acceptance

- Reject/no choice: no request to Clarity and no Clarity cookies.
- Accept Analytics: recordings and heatmaps operate only on eligible public/dashboard routes; advertising storage remains denied.
- Withdraw Analytics: cookies are cleared and the document reloads to unload the recorder.
- Faro: no cookie/localStorage/sessionStorage identifier and no sensitive URL/query/form data in sampled payloads.
- Shared product events contain only the central low-cardinality allowlist.
- Grafana receives searchable browser errors and structured server errors before Sentry is removed.
