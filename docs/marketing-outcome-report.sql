-- Read-only report. Run against the intended environment; never use production as a test fixture.
-- These are creator cohorts, not anonymous visitor-to-paid conversion rates.
WITH events AS (
  SELECT target_id AS creator_id, action, occurred_at, metadata
  FROM audit_events
  WHERE action LIKE 'product:%'
    AND metadata->>'deployment' = 'https://clipify.us'
), creators AS (
  SELECT creator_id, min(occurred_at) AS created_at
  FROM events WHERE action = 'product:creator_created'
  GROUP BY creator_id
), cohort AS (
  SELECT c.creator_id,
    bool_or(e.action = 'product:first_playback') AS activated,
    count(DISTINCT (e.occurred_at AT TIME ZONE 'UTC')::date)
      FILTER (WHERE e.action = 'product:playback_day') AS playback_days,
    bool_or(e.action = 'product:checkout_created') AS checkout_created,
    bool_or(e.action = 'product:payment_verified') AS paid
  FROM creators c LEFT JOIN events e
    ON e.creator_id = c.creator_id AND e.occurred_at >= c.created_at
  WHERE c.created_at >= now() - interval '30 days'
  GROUP BY c.creator_id
)
SELECT count(*) AS new_creators,
  count(*) FILTER (WHERE activated) AS first_playback,
  count(*) FILTER (WHERE playback_days >= 2) AS playback_on_multiple_utc_days,
  count(*) FILTER (WHERE checkout_created) AS checkout_sessions_created,
  count(*) FILTER (WHERE paid) AS creators_with_verified_payment
FROM cohort;

-- Keep currencies separate. Includes positive paid invoices, including renewals.
SELECT metadata->>'currency' AS currency,
  count(*) AS paid_invoices,
  sum((metadata->>'amountMinor')::bigint) AS amount_received_minor_units
FROM audit_events
WHERE action = 'product:payment_verified'
  AND metadata->>'deployment' = 'https://clipify.us'
  AND occurred_at >= now() - interval '30 days'
GROUP BY metadata->>'currency';
