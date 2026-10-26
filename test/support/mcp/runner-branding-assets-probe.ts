import type { runRunnerFreeProProbe } from "./runner-free-pro-probe";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
export async function runRunnerBrandingAssetsProbe(input: Parameters<typeof runRunnerFreeProProbe>[0] & { runnerId: string; principal: TrustedCreatorPrincipal }) {
	const { storeRunnerBrandingAssetForPrincipal: store } = await import("@/server/runner/branding-assets");
	const { saveRunnerBrandingProfileForPrincipal: save } = await import("@/server/runner/branding-profiles");
	const { runnerBrandingAssetsTable, runnerBrandingProfilesTable } = await import("@/db/schema");
	const { eq } = await import("drizzle-orm");
	const sharp = (await import("sharp")).default;
	await input.fixture.pool.query("UPDATE users SET plan='pro' WHERE id='fixture-creator'");
	const image = async (red: number) =>
		sharp({ create: { width: 16, height: 16, channels: 3, background: { r: red, g: 100, b: 200 } } })
			.png()
			.toBuffer();
	const oldAsset = await store(input.principal, { ownerId: "fixture-creator", runnerId: input.runnerId, kind: "background", bytes: await image(20) });
	if (!oldAsset.success) return { initialized: false, result: oldAsset };
	const initial = await save(input.principal, { ownerId: "fixture-creator", runnerId: input.runnerId, expectedRevision: 1, watermarkCorner: "top_left", backgroundAssetId: oldAsset.asset.id });
	if (!initial.success) return { initialized: false, result: initial };
	const snapshot = async () => (await input.fixture.pool.query("SELECT to_jsonb(p) AS profile FROM runner_branding_profiles p WHERE runner_id=$1", [input.runnerId])).rows[0].profile;
	const before = await snapshot();
	if (["branding_asset_cleanup_after_commit", "branding_asset_cleanup_failure"].includes(input.variant)) {
		const replacement = await store(input.principal, { ownerId: "fixture-creator", runnerId: input.runnerId, kind: "background", bytes: await image(220) });
		if (!replacement.success) return { initialized: false, result: replacement };
		let transactionCommitted = false,
			cleanupAfterCommit = false,
			oldAssetPresentBeforeCommit = false,
			visibleProfileOldBeforeCommit = false,
			newProfileStagedBeforeCommit = false;
		const observingClient = new Proxy(input.fixture.db, {
			get(target, property) {
				if (property === "transaction")
					return async (callback: Parameters<typeof input.fixture.db.transaction>[0]) => {
						const result = await target.transaction(async (tx) => {
							const value = await callback(tx);
							const oldAssetRow = await tx.query.runnerBrandingAssetsTable.findFirst({ where: eq(runnerBrandingAssetsTable.id, oldAsset.asset.id) });
							const stagedProfile = await tx.query.runnerBrandingProfilesTable.findFirst({ where: eq(runnerBrandingProfilesTable.runnerId, input.runnerId) });
							oldAssetPresentBeforeCommit = Boolean(oldAssetRow);
							newProfileStagedBeforeCommit = stagedProfile?.backgroundAssetId === replacement.asset.id;
							visibleProfileOldBeforeCommit = (await snapshot()).background_asset_id === oldAsset.asset.id;
							return value;
						});
						transactionCommitted = true;
						return result;
					};
				if (property === "delete")
					return (...args: unknown[]) => {
						cleanupAfterCommit = transactionCommitted;
						if (input.variant === "branding_asset_cleanup_failure") throw new Error("CONTROLLED_ASSET_CLEANUP_FAILURE");
						return Reflect.apply(target.delete, target, args);
					};
				const value = Reflect.get(target, property, target);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
		let updated: Awaited<ReturnType<typeof save>> | null = null;
		let cleanupThrew = false;
		try {
			updated = await save(input.principal, { ownerId: "fixture-creator", runnerId: input.runnerId, expectedRevision: 2, watermarkCorner: "top_left", backgroundAssetId: replacement.asset.id }, observingClient);
		} catch (cause) {
			if (!(cause instanceof Error) || cause.message !== "CONTROLLED_ASSET_CLEANUP_FAILURE") throw cause;
			cleanupThrew = true;
		}

		const after = await snapshot();
		const assets = (await input.fixture.pool.query("SELECT id FROM runner_branding_assets WHERE owner_id='fixture-creator'")).rows;
		return { initialized: true, updated, cleanupThrew, cleanupAfterCommit, oldAssetPresentBeforeCommit, visibleProfileOldBeforeCommit, newProfileStagedBeforeCommit, revision: after.revision, newAssetId: replacement.asset.id, backgroundAssetId: after.background_asset_id, assets };
	}
	let stagedAssetCount = 0;
	let attemptFailed = false;
	const failingClient = new Proxy(input.fixture.db, {
		get(target, property) {
			if (property === "transaction")
				return async (callback: Parameters<typeof input.fixture.db.transaction>[0]) =>
					target.transaction(async (tx) => {
						await callback(tx);
						stagedAssetCount = (await tx.select({ id: runnerBrandingAssetsTable.id }).from(runnerBrandingAssetsTable).where(eq(runnerBrandingAssetsTable.ownerId, "fixture-creator"))).length;
						throw new Error("CONTROLLED_ASSET_COMMIT_FAILURE");
					});
			const value = Reflect.get(target, property, target);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
	try {
		await store(input.principal, { ownerId: "fixture-creator", runnerId: input.runnerId, kind: "background", bytes: await image(220) }, failingClient);
	} catch (cause) {
		attemptFailed = cause instanceof Error && cause.message === "CONTROLLED_ASSET_COMMIT_FAILURE";
	}
	const after = await snapshot();
	const assets = (await input.fixture.pool.query("SELECT id FROM runner_branding_assets WHERE owner_id='fixture-creator'")).rows;
	return { initialized: true, attemptFailed, stagedAssetCount, profileUnchanged: JSON.stringify(before) === JSON.stringify(after), revision: after.revision, oldAssetId: oldAsset.asset.id, backgroundAssetId: after.background_asset_id, assets };
}
