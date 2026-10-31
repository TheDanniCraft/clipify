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


-- Activation cohorts. D7 means a return 7–13 days after first playback; D30 means
-- 30–36 days after. Only fully observed windows enter each denominator.
-- UTC days in the basic report above are NOT this retention definition.
WITH events AS (
 SELECT target_id AS creator_id, action, occurred_at
 FROM audit_events WHERE action LIKE 'product:%'
 AND metadata->>'deployment' = 'https://clipify.us'
), starts AS (
 SELECT creator_id, min(occurred_at) AS created_at
 FROM events WHERE action = 'product:creator_created' GROUP BY creator_id
), activations AS (
 SELECT s.creator_id, s.created_at, min(e.occurred_at) AS activated_at
 FROM starts s JOIN events e ON e.creator_id = s.creator_id
 AND e.action = 'product:first_playback' AND e.occurred_at >= s.created_at
 GROUP BY s.creator_id, s.created_at
), returns AS (
 SELECT a.*,
 EXISTS (SELECT 1 FROM events e WHERE e.creator_id=a.creator_id
 AND e.action='product:playback_day' AND e.occurred_at >= a.activated_at + interval '7 days'
 AND e.occurred_at < a.activated_at + interval '14 days') AS d7,
 EXISTS (SELECT 1 FROM events e WHERE e.creator_id=a.creator_id
 AND e.action='product:playback_day' AND e.occurred_at >= a.activated_at + interval '30 days'
 AND e.occurred_at < a.activated_at + interval '37 days') AS d30
 FROM activations a
)
SELECT count(*) AS activated_creators,
 percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM activated_at-created_at)) AS median_seconds_to_first_playback,
 count(*) FILTER (WHERE activated_at <= now()-interval '14 days') AS d7_mature_creators,
 count(*) FILTER (WHERE activated_at <= now()-interval '14 days' AND d7) AS d7_returned_creators,
 count(*) FILTER (WHERE activated_at <= now()-interval '37 days') AS d30_mature_creators,
 count(*) FILTER (WHERE activated_at <= now()-interval '37 days' AND d30) AS d30_returned_creators
FROM returns;

-- Current subscription state, not event counts or inferred cancellation intent.
-- These are current creator billing guardrails, including pre-instrumentation accounts.
SELECT count(DISTINCT user_id) FILTER (WHERE cancel_at_period_end AND status IN ('active','trialing')) AS creators_canceling_at_period_end,
 count(DISTINCT user_id) FILTER (WHERE status IN ('past_due','unpaid')) AS creators_with_payment_issues,
 count(DISTINCT user_id) FILTER (WHERE status='canceled') AS creators_with_canceled_subscriptions
FROM billing_subscriptions;

-- Successful creator refunds and failed invoice attempts remain separate from
-- gross Pro receipts: they can concern older payments or other creator charges.
-- Do not subtract these totals and call the result net revenue.
SELECT action, metadata->>'currency' AS currency, count(*) AS recorded_events,
 count(DISTINCT target_id) AS affected_creators,
 sum((metadata->>'amountMinor')::bigint) AS refunded_minor_units
FROM audit_events
WHERE action IN ('product:refund_succeeded','product:payment_failed')
 AND metadata->>'deployment' = 'https://clipify.us'
 AND occurred_at >= now()-interval '30 days'
GROUP BY action, metadata->>'currency';
