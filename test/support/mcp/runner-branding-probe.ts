import { randomUUID } from "node:crypto";
import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";

/** Inner persistence/authority boundary, using the existing disposable PostgreSQL fixture. */
export async function runRunnerBrandingProbe(input: Parameters<typeof runRunnerFreeProProbe>[0]) {
	process.env.ENTITLEMENTS_HYBRID_ENABLED = "true";
	await input.fixture.pool.query("UPDATE users SET plan='free' WHERE id='fixture-creator'");
	const runnerId = randomUUID();
	const privateRunnerToken = randomUUID();
	await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,'fixture-creator','Appearance fixture',$2)", [runnerId, privateRunnerToken]);
	const branding = await import("@/server/runner/branding");
	const save = Reflect.get(branding, "saveRunnerBrandingProfileForPrincipal");
	if (typeof save !== "function") return { available: false };
	const principal = { kind: "session" as const, authUserId: input.actorId, sessionId: "fixture-controlled-session", authenticatedAt: new Date(), organizationId: "creator-org" };
	const result = ["branding_create_race", "branding_read_default"].includes(input.variant) ? null : await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 0, watermarkCorner: "top_left" });
	const original = result;
	if (["branding_asset_transaction_rollback", "branding_asset_cleanup_after_commit", "branding_asset_cleanup_failure"].includes(input.variant)) return (await import("./runner-branding-assets-probe")).runRunnerBrandingAssetsProbe({ ...input, runnerId, principal });
	let updated: Awaited<ReturnType<typeof branding.saveRunnerBrandingProfileForPrincipal>> | Awaited<ReturnType<typeof branding.getRunnerBrandingProfileForPrincipal>> | null = result;
	let updateThrew = false;
	let foreignRunnerId: string | undefined;
	if (input.variant === "branding_foreign_runner") {
		const foreignOwnerId = randomUUID();
		foreignRunnerId = randomUUID();
		await input.fixture.pool.query("INSERT INTO users(id,email,username,avatar,role,plan) VALUES($1,$2,'Foreign appearance','','user','free')", [foreignOwnerId, foreignOwnerId + "@example.invalid"]);
		await input.fixture.pool.query("INSERT INTO runners(id,owner_id,name,token) VALUES($1,$2,'Foreign appearance Runner',$3)", [foreignRunnerId, foreignOwnerId, randomUUID()]);
	}
	if (["branding_foreign_save", "branding_standby_permission", "branding_read_foreign"].includes(input.variant)) await input.fixture.pool.query("DELETE FROM auth.member WHERE organization_id='creator-org' AND user_id=$1", [input.actorId]);
	let uncommittedPreference: { watermarkCorner: string; revision: number } | undefined;
	const saveClient =
		input.variant === "branding_storage_failure"
			? new Proxy(input.fixture.db, {
					get(target, property) {
						if (property === "transaction")
							return async (callback: Parameters<typeof input.fixture.db.transaction>[0]) =>
								target.transaction(async (tx) => {
									await callback(tx);
									const staged = await tx.query.runnerBrandingProfilesTable.findFirst({ where: (table, { eq }) => eq(table.runnerId, runnerId) });
									if (staged) uncommittedPreference = { watermarkCorner: staged.watermarkCorner, revision: staged.revision };
									throw new Error("RUNNER_FIXTURE_EXPECTED_COMMIT_FAILURE");
								});
						const value = Reflect.get(target, property, target);
						return typeof value === "function" ? value.bind(target) : value;
					},
				})
			: input.fixture.db;
	async function applyCornerUpdate() {
		if (["branding_save_update", "branding_stale_revision", "branding_standby_permission", "branding_foreign_save", "branding_foreign_runner", "branding_invalid_corner", "branding_storage_failure"].includes(input.variant)) {
			try {
				updated = await save(principal, { ownerId: "fixture-creator", runnerId: foreignRunnerId ?? runnerId, expectedRevision: input.variant === "branding_stale_revision" || foreignRunnerId ? 0 : 1, watermarkCorner: input.variant === "branding_invalid_corner" ? "center" : "bottom_right" }, saveClient);
			} catch {
				updateThrew = true;
			}
		}
	}
	await applyCornerUpdate();
	let concurrent: { threw: boolean; value: any }[] = [];
	let observedLocks = 0;
	let settledBeforeRelease = 0;
	async function exerciseBrandingRevisionRace() {
		const blocker = await input.fixture.pool.connect();
		const pending: Promise<{ threw: boolean; value: any }>[] = [];
		let released = false;
		let settled = 0;
		try {
			await blocker.query("BEGIN");
			await blocker.query("LOCK TABLE runner_branding_profiles IN SHARE MODE");
			for (const watermarkCorner of ["top_right", "bottom_right"]) {
				pending.push(
					Promise.resolve(save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: input.variant === "branding_create_race" ? 0 : 1, watermarkCorner }, input.fixture.db))
						.then(
							(value) => ({ threw: false, value }),
							() => ({ threw: true, value: null }),
						)
						.finally(() => {
							settled++;
						}),
				);
			}
			const deadline = Date.now() + 3000;
			while (Date.now() < deadline) {
				observedLocks = Number((await input.fixture.pool.query("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows[0].count);
				if (observedLocks >= 2) break;
				await new Promise((resolve) => setTimeout(resolve, 10));
			}
			settledBeforeRelease = settled;
			await blocker.query("ROLLBACK");
			released = true;
			concurrent = await Promise.all(pending);
		} finally {
			if (!released) await blocker.query("ROLLBACK");
			blocker.release();
			await Promise.allSettled(pending);
		}
	}
	if (["branding_revision_race", "branding_create_race"].includes(input.variant)) await exerciseBrandingRevisionRace();
	let knownAppearanceEnd: string | undefined;
	async function readSavedBranding() {
		if (input.variant === "branding_read_known_expiry") {
			knownAppearanceEnd = new Date(Date.now() + 60000).toISOString();
			await input.fixture.pool.query("INSERT INTO entitlement_grants(user_id,entitlement,source,starts_at,ends_at) VALUES('fixture-creator','pro_access','reverse_trial',now()-interval '1 hour',$1)", [knownAppearanceEnd]);
		}
		if (["branding_read_default", "branding_read_saved", "branding_read_foreign", "branding_read_invalid", "branding_read_known_expiry"].includes(input.variant)) {
			const read = Reflect.get(branding, "getRunnerBrandingProfileForPrincipal");
			if (typeof read !== "function") return { available: false };
			updated = await read(principal, { ownerId: "fixture-creator", runnerId: input.variant === "branding_read_invalid" ? "invalid" : runnerId });
		}
	}
	const readFailure = await readSavedBranding();
	if (readFailure) return readFailure;
	let storedProAttribution: unknown;
	async function applyStandbyPreferences() {
		if (["branding_standby_color", "branding_standby_color_free", "branding_standby_color_invalid", "branding_standby_color_omit"].includes(input.variant)) {
			if (input.variant !== "branding_standby_color_free") await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
			updated = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "top_left", standbyBackgroundColor: input.variant === "branding_standby_color_invalid" ? "url(https://example.invalid/image)" : "#16324f" });
			if (input.variant === "branding_standby_color_omit") updated = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 2, watermarkCorner: "bottom_right" });
		}
		if (input.variant === "branding_pro_hide") {
			await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
			updated = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "top_left", proShowAttribution: false });
			storedProAttribution = (await input.fixture.pool.query("SELECT to_jsonb(p)->'pro_show_attribution' AS choice FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0]?.choice;
		}
		if (["branding_free_choice_true", "branding_free_choice_false"].includes(input.variant)) {
			updated = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "bottom_right", proShowAttribution: input.variant === "branding_free_choice_true" });
			storedProAttribution = (await input.fixture.pool.query("SELECT to_jsonb(p)->'pro_show_attribution' AS choice FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0]?.choice;
		}
	}
	await applyStandbyPreferences();
	async function observeMessageBoundary() {
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
		const length = Number(input.variant.split("_").at(-1));
		const before = (await input.fixture.pool.query("SELECT to_jsonb(p) AS profile FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0].profile;
		const saved = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "top_left", message: "x".repeat(length) });
		const after = (await input.fixture.pool.query("SELECT to_jsonb(p) AS profile FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0].profile;
		return { saved, before, after, unchanged: JSON.stringify(before) === JSON.stringify(after) };
	}
	if (/^branding_message_boundary_(159|160|161)$/.test(input.variant)) return await observeMessageBoundary();
	async function observeCompoundStandby() {
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
		const { storeRunnerBrandingAssetForPrincipal: store } = await import("@/server/runner/branding-assets");
		const sharp = (await import("sharp")).default;
		const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 20, g: 100, b: 200 } } })
			.png()
			.toBuffer();
		const logo = await store(principal, { ownerId: "fixture-creator", runnerId, kind: "logo", bytes });
		const background = await store(principal, { ownerId: "fixture-creator", runnerId, kind: "background", bytes });
		if (!logo.success || !background.success) return { initialized: false };
		const appearance = { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "top_right", proShowAttribution: true, standbyBackgroundColor: "#16324f", logoAssetId: logo.asset.id, backgroundAssetId: background.asset.id, message: "Back soon <3", showNextBroadcastTime: true };
		const before = structuredClone(appearance);
		const saved = await save(principal, appearance);
		const read = await branding.getRunnerBrandingProfileForPrincipal(principal, { ownerId: "fixture-creator", runnerId });
		const runner = (await input.fixture.pool.query("SELECT configuration_revision FROM runners WHERE id=$1", [runnerId])).rows[0];
		const admissions = Number((await input.fixture.pool.query("SELECT count(*) FROM runner_broadcast_admissions WHERE owner_id='fixture-creator'")).rows[0].count);
		const authority = { runnerPro: true };
		return { initialized: true, saved, read, appearance, inputUnchanged: JSON.stringify(before) === JSON.stringify(appearance), configurationRevision: runner.configuration_revision, admissions, ordinary: branding.resolveRunnerPresentationPolicy(authority, "ordinary_overlay", appearance), live: branding.resolveRunnerPresentationPolicy(authority, "live", appearance), generated: branding.resolveRunnerPresentationPolicy(authority, "generated_standby", appearance) };
	}
	if (input.variant === "branding_standby_compound") return await observeCompoundStandby();
	async function observeNextBroadcastTime() {
		await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
		updated = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "top_left", showNextBroadcastTime: true });
		const overlayId = randomUUID(),
			sessionId = randomUUID(),
			eventId = randomUUID(),
			targetId = randomUUID();
		const { encryptString } = await import("@/app/lib/encryption");
		await input.fixture.pool.query("INSERT INTO overlays(id,owner_id,secret,name,status,type) VALUES($1,'fixture-creator',$2,'Next broadcast source','active','Featured')", [overlayId, randomUUID()]);
		await input.fixture.pool.query("INSERT INTO stream_sessions(id,owner_id,runner_id,overlay_id,mode,control_mode,rtmp_url) VALUES($1,'fixture-creator',$2,$3,'24/7','scheduled','rtmp://127.0.0.1:1949/live')", [sessionId, runnerId, overlayId]);
		await input.fixture.pool.query("INSERT INTO runner_destinations(id,owner_id,runner_id,name,provider,rtmp_url,encrypted_stream_key) VALUES($1,'fixture-creator',$2,'Next loopback','custom','rtmp://127.0.0.1:1949/live',$3)", [targetId, runnerId, encryptString("disposable-next-time-key")]);
		await input.fixture.pool.query("INSERT INTO runner_schedule_events(id,owner_id,runner_id,session_id,overlay_id,title,timezone,recurrence,recurrence_anchor,local_start_date,local_end_date,local_start_time,local_end_time) VALUES($1,'fixture-creator',$2,$3,$4,'Future Berlin broadcast','Europe/Berlin','once','2028-01-15','2028-01-15','2028-01-15','14:00','16:00')", [eventId, runnerId, sessionId, overlayId]);
		await input.fixture.pool.query("INSERT INTO runner_schedule_event_destinations(owner_id,event_id,destination_id,position) VALUES('fixture-creator',$1,$2,0)", [eventId, targetId]);
		const readNext = Reflect.get(branding, "readRunnerNextBroadcastInternal");
		const next = typeof readNext === "function" ? await readNext({ ownerId: "fixture-creator", runnerId }, new Date("2027-01-01T00:00:00Z"), input.fixture.db) : null;
		const stored = (await input.fixture.pool.query("SELECT to_jsonb(p)->'show_next_broadcast_time' AS enabled FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0]?.enabled;
		return { available: typeof readNext === "function", result: updated, stored, next };
	}
	if (input.variant === "branding_standby_next_time") return await observeNextBroadcastTime();
	let storedMessage: unknown;
	async function applyStandbyMessage() {
		if (input.variant === "branding_standby_message") {
			await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
			updated = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "top_left", message: "Back soon <3 — thanks for watching!" });
			storedMessage = (await input.fixture.pool.query("SELECT to_jsonb(p)->'message' AS value FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0]?.value;
		}
	}
	await applyStandbyMessage();
	let storedBackground: unknown;
	let storedLogo: unknown;
	async function applyStandbyAssets() {
		if (["branding_standby_background", "branding_standby_logo"].includes(input.variant)) {
			const kind = input.variant === "branding_standby_logo" ? "logo" : "background";
			await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
			const store = Reflect.get(branding, "storeRunnerBrandingAssetForPrincipal");
			if (typeof store !== "function") return { available: false, missing: "standby asset upload service", original };
			const sharp = (await import("sharp")).default;
			const bytes = await sharp({ create: { width: 16, height: 16, channels: 3, background: { r: 40, g: 120, b: 200 } } })
				.png()
				.toBuffer();
			const asset = await store(principal, { ownerId: "fixture-creator", runnerId, kind, bytes }, input.fixture.db);
			if (!asset.success) return { available: true, asset, result: asset };
			updated = await save(principal, { ownerId: "fixture-creator", runnerId, expectedRevision: 1, watermarkCorner: "top_left", [kind === "logo" ? "logoAssetId" : "backgroundAssetId"]: asset.asset.id });
			storedBackground = (await input.fixture.pool.query("SELECT to_jsonb(p)->'background_asset_id' AS id FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0]?.id;
			storedLogo = (await input.fixture.pool.query("SELECT to_jsonb(p)->'logo_asset_id' AS id FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0]?.id;
		}
	}
	const assetFailure = await applyStandbyAssets();
	if (assetFailure) return assetFailure;
	const rows = (await input.fixture.pool.query('SELECT id,owner_id AS "ownerId",runner_id AS "runnerId",watermark_corner AS "watermarkCorner",revision FROM runner_branding_profiles WHERE runner_id=$1', [runnerId])).rows;
	const foreignProfileCount = foreignRunnerId ? Number((await input.fixture.pool.query("SELECT count(*) FROM runner_branding_profiles WHERE runner_id=$1", [foreignRunnerId])).rows[0].count) : undefined;
	const standbyColor = (await input.fixture.pool.query("SELECT to_jsonb(p)->'standby_background_color' AS color FROM runner_branding_profiles p WHERE runner_id=$1", [runnerId])).rows[0]?.color;
	return { available: true, storedMessage, storedLogo, storedBackground, standbyColor, knownAppearanceEnd, storedProAttribution, result: updated, original, updateThrew, uncommittedPreference, foreignProfileCount, concurrent, observedLocks, settledBeforeRelease, rows, runnerId, privateRunnerToken };
}
