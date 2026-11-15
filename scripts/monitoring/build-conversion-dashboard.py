"""Extend the reviewed v6 resource without changing its panels or dashboard identity."""
import copy
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
dashboard = json.loads((root / 'grafana/clipify-vm01-overview-v6.json').read_text())
dashboard['spec']['title'] = 'Clipify VM01 Overview v7'
base = 'from(bucket: "clipify_monitor")\n  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)\n  |> filter(fn: (r) => r._measurement == "clipify_vm01")\n'
panels = []
def panel(id, title, fields, description, counter=False):
    item = copy.deepcopy(dashboard['spec']['elements']['panel-204'])
    spec = item['spec']
    spec.update(id=id, title=title, description=description)
    query = base + '  |> filter(fn: (r) => ' + ' or '.join(f'r._field == "{field}"' for field in fields) + ')\n'
    if counter:
        # Preserve source series through reset normalization; do not merge replicas first.
        query += '  |> increase()\n  |> aggregateWindow(every: v.windowPeriod, fn: last, createEmpty: false)\n'
    else:
        query += '  |> aggregateWindow(every: v.windowPeriod, fn: last, createEmpty: false)\n'
    spec['data']['spec']['queries'][0]['spec']['query']['spec']['query'] = query
    spec['vizConfig']['spec']['fieldConfig']['overrides'] = [
        {'matcher': {'id': 'byRegexp', 'options': f'^(?:_value )?{field}(?: \\{{.*\\}})?$'},
         'properties': [{'id': 'displayName', 'value': label}]} for field, label in fields.items()]
    dashboard['spec']['elements'][f'panel-{id}'] = item
    index = len(panels)
    panels.append({'kind': 'GridLayoutItem', 'spec': {'x': (index % 2)*12, 'y': (index//2)*8, 'width': 12, 'height': 8, 'element': {'kind': 'ElementReference', 'name': f'panel-{id}'}}})

panel(600, 'New creator outcomes (rolling 30 days)', {'conversion_signups30d':'New creators', 'conversion_activated30d':'Recorded playback', 'conversion_checkoutCreators30d':'Checkout created', 'conversion_paidCreators30d':'Verified payment'}, 'Distinct creators from committed production ledger records. Rolling gauges, not an ordered visitor funnel. Account deletion can change totals. Never sum database gauges across replicas.')
panel(601, 'First-week activation (mature creators)', {'conversion_mature7dCreators':'Creators at least 7 days old', 'conversion_activatedWithin7d':'Playback within first 7 days'}, 'Creators who joined within the last 30 days and have a complete 7-day observation window. Compare numerator with denominator; young accounts are excluded. Playback does not establish OBS broadcast reception.')
panel(602, 'Umami delivery (observed counter increase)', {f'analyticsCache_delivery{k}':v for k,v in [('Attempts','Attempts'),('Succeeded','Accepted'),('Failed','Failed'),('Retries','Explicit rejection retries')]}, 'Process counter increases, normalized per source before combining. First samples are baselines; missing scrapes remain gaps. Accepted does not prove exactly-once ingestion. Zero attempts does not establish complete collection.', True)
panel(603, 'Checkout service operations (observed increase)', {f'conversion_operations_checkout{k}':v for k,v in [('Requested','Requested'),('Created','Redirect URL returned'),('Unavailable','Unavailable'),('AlreadyOwned','Already owned')]}, 'Authenticated public checkout continuation operations. Includes retries, not unique buyers. Does not count dashboard checkout callers. No-attempt periods are not a service failure.', True)
panel(604, 'Subscription state', {'billing_payingSubscriptions':'Active positive-priced subscriptions','billing_trialSubscriptions':'Stripe trial subscriptions','billing_paymentProblemSubscriptions':'Past due or unpaid','billing_cancelingSubscriptions':'Cancel at period end'}, 'Current distinct subscriptions from the billing mirror. Positive-priced active subscriptions are not recognized revenue or proof of latest payment. Reverse trials and complimentary grants are separate entitlement metrics.')
panel(605, 'Measurement exclusions and service processing', {'conversion_operations_analyticsConsentExcluded':'Analytics consent not allowed','conversion_operations_authSessionCreated':'Auth sessions created','conversion_operations_webhookReceived':'Verified webhook requests','conversion_operations_webhookProcessed':'Webhook handlers completed','conversion_operations_webhookFailed':'Webhook handler failures'}, 'Fixed aggregate operation counters. Consent exclusions are expected, not errors. Auth includes returning users. Webhook retries can increase requests. No user IDs, browser behavior or payloads are exported.', True)
panel(606, 'Webhook processing backlog', {'conversion_webhooks_failed':'Failed events awaiting recovery', 'conversion_webhooks_staleProcessing':'Processing beyond 5-minute lease'}, 'Current durable webhook states. Recovered events leave the failed count. Stale means the processing lease elapsed; it is not a count of failed customer payments. No event payloads or IDs are exported.')
dashboard['spec']['layout']['spec']['rows'].append({'kind':'RowsLayoutRow','spec':{'title':'Conversion and measurement health','collapse':False,'layout':{'kind':'GridLayout','spec':{'items':panels}}}})
(root / 'grafana/clipify-vm01-overview-v7.json').write_text(json.dumps(dashboard, indent='\t')+'\n')
