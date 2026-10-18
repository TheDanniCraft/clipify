import { randomUUID } from "node:crypto";
import { Plan } from "@types";
import { runRunnerFreeProProbe } from "./runner-free-pro-probe";

async function seedCommercialState(input: Parameters<typeof runRunnerFreeProProbe>[0], state: string) {
	await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
	let billingEnd: Date | null = null;
	if (state.startsWith("billing_")) {
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
		const subscriptionId = randomUUID();
		billingEnd = state === "billing_unbounded" ? null : new Date(Date.now() + (state === "billing_expired" ? -86400000 : 86400000));
		const status = state === "billing_trialing" ? "trialing" : state === "billing_past_due" ? "past_due" : state === "billing_canceled" ? "canceled" : "active";
		await input.fixture.pool.query("INSERT INTO billing_subscriptions(id,user_id,stripe_customer_id,status,current_period_end,cancel_at_period_end) VALUES($1,'fixture-creator','isolated-metadata-customer',$2,$3,true)", [subscriptionId, status, billingEnd]);
		await input.fixture.pool.query("INSERT INTO billing_subscription_items(id,subscription_id,product_key,stripe_product_id,stripe_price_id,currency,billing_interval) VALUES($1,$2,'pro','isolated-pro','isolated-price','usd','month')", [randomUUID(), subscriptionId]);
	} else if (state === "pro") {
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	} else if (state === "trial" || state === "pro_grant") {
		await input.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES('fixture-creator','pro_access',$1,now()-interval '1 hour',now()+interval '1 day')", [state === "trial" ? "reverse_trial" : "partner"]);
	} else if (state.startsWith("agency_")) {
		await (await import("./seed-pro-allocation")).seedCreatorProAllocation(input.fixture.pool, "fixture-creator", "creator-org", input.actorId);
		if (state === "agency_ended") await input.fixture.pool.query("UPDATE agency_license_allocations SET product='runner',status='removal_scheduled',effective_at=now()-interval '3 days',removal_requested_at=now()-interval '2 days',ends_at=now()-interval '1 day' WHERE creator_id='fixture-creator'");
		else if (state === "agency_ended_status") await input.fixture.pool.query("UPDATE agency_license_allocations SET product='runner',status='ended',ends_at=now()+interval '1 day' WHERE creator_id='fixture-creator'");
		else if (state !== "agency_creator") await input.fixture.pool.query("UPDATE agency_license_allocations SET product='runner',ends_at=now()+interval '1 day' WHERE creator_id='fixture-creator'");
	} else {
		await input.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at,revoked_at) VALUES('fixture-creator','runner_access','partner',now()-interval '1 hour',CASE WHEN $1 IN ('active','revoked') THEN now()+interval '1 day' WHEN $1='expired' THEN now()-interval '1 day' ELSE NULL END,CASE WHEN $1='revoked' THEN now()-interval '1 minute' ELSE NULL END)", [state]);
	}
	return billingEnd;
}

/** Isolated commercial fixtures never create grants through email-producing actions. */
export async function runRunnerCommercialProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	const previousFetch = globalThis.fetch;
	globalThis.fetch = ((value: RequestInfo | URL, init?: RequestInit) => {
		const request = value instanceof Request ? value : new Request(value, init);
		if (new URL(request.url).origin !== input.origin) throw new Error("RUNNER_FIXTURE_EXTERNAL_IO_FORBIDDEN");
		return input.auth.handler(request);
	}) as typeof fetch;
	try {
		process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
		const state = input.variant.replace(/^commercial_(workflow|service|metadata)_/, "");
		if (!["lifetime", "active", "expired", "revoked", "agency_active", "agency_ended", "agency_ended_status", "pro", "trial", "pro_grant", "agency_creator", "billing_active", "billing_trialing", "billing_past_due", "billing_expired", "billing_canceled", "billing_unbounded"].includes(state)) throw new Error("Unknown commercial fixture");
		const billingEnd = await seedCommercialState(input, state);
		const entitlements = await import("@/app/lib/entitlements");
		const { deriveRunnerCapabilities } = await import("@/server/runner/capabilities");
		const storedOwner = (await input.fixture.pool.query("SELECT id,plan FROM users WHERE id='fixture-creator'")).rows[0];
		const owner = { id: storedOwner.id as string, plan: storedOwner.plan as Plan };
		if (input.variant.startsWith("commercial_metadata_")) {
			const capabilities = await import("@/server/runner/capabilities");
			const individualResolver = Reflect.get(capabilities, "resolveRunnerBenefits");
			const batchResolver = Reflect.get(capabilities, "resolveRunnerBenefitsForUsers");
			// The established module loads; absence is the new product contract.
			if (typeof individualResolver !== "function" || typeof batchResolver !== "function") return { available: false };
			const now = new Date();
			const before = await entitlements.resolveUserEntitlements(owner, input.fixture.db);
			const individual = await individualResolver(owner, input.fixture.db, now);
			const batch = await batchResolver([owner, { id: "ungranted-commercial-owner", plan: Plan.Free }], undefined, now);
			const batchOwner = batch.get(owner.id),
				otherOwner = batch.get("ungranted-commercial-owner");
			if (!batchOwner || !otherOwner) return { available: true, ownerResultsPresent: false, individual, batch: batchOwner };
			const after = await entitlements.resolveUserEntitlements(owner, input.fixture.db);
			const grantEnd = (await input.fixture.pool.query("SELECT ends_at FROM entitlement_grants WHERE user_id=$1 AND entitlement='runner_access'", [owner.id])).rows[0]?.ends_at;
			const agencyEnd = (await input.fixture.pool.query("SELECT ends_at FROM agency_license_allocations WHERE creator_id=$1", [owner.id])).rows[0]?.ends_at;
			const scopedEndByState: Record<string, unknown> = { active: grantEnd, trial: before.trialEndsAt, pro_grant: before.trialEndsAt, agency_active: agencyEnd, agency_creator: agencyEnd };
			const expectedEnd = state.startsWith("billing_") ? (["billing_expired", "billing_canceled"].includes(state) ? null : billingEnd) : (scopedEndByState[state] ?? null);
			const defaults = await (await import("@/server/runner/benefits")).resolveRunnerBenefits(owner);
			const explicitBatch = await (await import("@/server/runner/benefits")).resolveRunnerBenefitsForUsers([owner], input.fixture.db);
			const emptyBatch = await batchResolver([], input.fixture.db, now);
			return {
				available: true,
				ownerResultsPresent: true,
				defaultPolicy: deriveRunnerCapabilities(defaults, now),
				explicitBatchPolicy: deriveRunnerCapabilities(explicitBatch.get(owner.id)!, now),
				emptyBatchSize: emptyBatch.size,
				individual,
				batch: batchOwner,
				individualPolicy: deriveRunnerCapabilities(individual, now),
				batchPolicy: deriveRunnerCapabilities(batchOwner, now),
				otherPolicy: deriveRunnerCapabilities(otherOwner, now),
				raw: after,
				historyUnchanged: JSON.stringify(before) === JSON.stringify(after),
				expectedEnd: expectedEnd ?? null,
			};
		}
		if (input.variant.startsWith("commercial_service_")) {
			const individual = await entitlements.resolveUserEntitlements(owner, input.fixture.db);
			const batch = await entitlements.resolveUserEntitlementsForUsers([owner, { id: "ungranted-commercial-owner", plan: Plan.Free }]);
			const agencyLifetime = (await input.fixture.pool.query("SELECT status,effective_at,ends_at FROM agency_license_allocations WHERE creator_id='fixture-creator' AND product='runner'")).rows;
			return { agencyLifetime, individual, batch: batch.get(owner.id), ungranted: batch.get("ungranted-commercial-owner"), capabilities: deriveRunnerCapabilities(individual), grantLifetime: (await input.fixture.pool.query("SELECT ends_at,revoked_at FROM entitlement_grants WHERE user_id='fixture-creator' AND entitlement='runner_access'")).rows };
		}
		const runnerId = randomUUID(),
			overlayId = randomUUID();
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'fixture-creator','Commercial fixture',$2)", [runnerId, randomUUID()]);
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator','private-commercial-source','Commercial source','active','Featured')", [overlayId]);
		const { call } = await runRunnerFreeProProbe(input);
		const configured = await call("configure_stream_session", { runnerId, overlayId, mode: "24/7", controlMode: "scheduled", destination: "twitch", retryKey: "commercial-scoped-scheduling" });
		const capability = await call("get_capabilities", {});
		const unrelated = await call("pause_overlay", { overlayId });
		const rows = (await input.fixture.pool.query("SELECT control_mode,desired_state,actual_state FROM stream_sessions WHERE owner_id='fixture-creator' AND runner_id=$1", [runnerId])).rows;
		return { configured, capability, unrelated, rows, safe: !JSON.stringify([configured, unrelated]).includes("private-commercial-source") };
	} finally {
		globalThis.fetch = previousFetch;
	}
}
