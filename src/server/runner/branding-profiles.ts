import "server-only";
import * as Sentry from "@sentry/nextjs";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, type DatabaseClient, type QueryClient, type TransactionClient } from "@/db/client";
import { runnerBrandingProfilesTable, runnerBrandingAssetsTable, runnersTable, runnerWatermarkCornerEnum } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { resourceFailure } from "@/server/resources/errors";
import { authorizeLockedMutation } from "@/server/resources/mutation";
import { deriveRunnerCapabilities, resolveRunnerBenefits } from "./capabilities";

const saveInput = z
	.object({
		ownerId: z
			.string()
			.min(1)
			.max(255)
			.regex(/^[A-Za-z0-9_-]+$/),
		runnerId: z.uuid(),
		expectedRevision: z.number().int().min(0).max(2_147_483_646),
		watermarkCorner: z.enum(runnerWatermarkCornerEnum.enumValues),
		proShowAttribution: z.boolean().optional(),
		backgroundAssetId: z.uuid().nullable().optional(),
		logoAssetId: z.uuid().nullable().optional(),
		message: z.string().max(160).optional(),
		showNextBroadcastTime: z.boolean().optional(),
		standbyBackgroundColor: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/)
			.transform((value) => value.toLowerCase())
			.optional(),
	})
	.strict();

function failure(code: Parameters<typeof resourceFailure>[0]) {
	const { error } = resourceFailure(code);
	return { success: false as const, error: error.message, code: error.code };
}

type BrandingIdentity = Pick<z.infer<typeof saveInput>, "ownerId" | "runnerId">;

export async function withOwnedRunner<T>(principal: TrustedCreatorPrincipal, input: BrandingIdentity, permission: "runner:read" | "runner:update", client: DatabaseClient, run: (tx: TransactionClient, authority: Awaited<ReturnType<typeof authorizeLockedMutation>>) => Promise<T>) {
	try {
		return await client.transaction(async (tx) => {
			const authority = await authorizeLockedMutation(principal, input.ownerId, permission, tx);
			const [runner] = await tx
				.select({ id: runnersTable.id })
				.from(runnersTable)
				.where(and(eq(runnersTable.id, input.runnerId), eq(runnersTable.ownerId, input.ownerId)))
				.limit(1);
			if (!runner) return failure("RESOURCE_UNAVAILABLE");
			return run(tx, authority);
		});
	} catch (cause) {
		if (cause instanceof Error && ["ACCESS_DENIED", "AUTHENTICATION_REQUIRED"].includes(cause.message)) return failure("ACCESS_DENIED");
		throw cause;
	}
}

type BrandingInput = z.infer<typeof saveInput>;
type BrandingProfile = typeof runnerBrandingProfilesTable.$inferSelect;
const proBrandingFields = ["proShowAttribution", "standbyBackgroundColor", "backgroundAssetId", "logoAssetId", "message", "showNextBroadcastTime"] as const;
function changesProBranding(input: BrandingInput) {
	return proBrandingFields.some((field) => input[field] !== undefined);
}
async function brandingAssetAvailable(tx: TransactionClient, ownerId: string, assetId: string | null | undefined, kind: "background" | "logo") {
	if (!assetId) return true;
	const asset = await tx.query.runnerBrandingAssetsTable.findFirst({ where: and(eq(runnerBrandingAssetsTable.id, assetId), eq(runnerBrandingAssetsTable.ownerId, ownerId), eq(runnerBrandingAssetsTable.kind, kind)), columns: { id: true } });
	return !!asset;
}
function detachedBrandingAssets(current: BrandingProfile | undefined, input: BrandingInput) {
	const detached: string[] = [];
	for (const field of ["backgroundAssetId", "logoAssetId"] as const) {
		const previous = current?.[field];
		if (previous && input[field] !== undefined && input[field] !== previous) detached.push(previous);
	}
	return detached;
}
function brandingChanges(input: BrandingInput) {
	const fields = ["watermarkCorner", ...proBrandingFields] as const;
	return Object.fromEntries(fields.filter((field) => input[field] !== undefined).map((field) => [field, input[field]])) as Pick<BrandingInput, (typeof fields)[number]>;
}
function initialBrandingValues(input: BrandingInput) {
	return { ownerId: input.ownerId, runnerId: input.runnerId, watermarkCorner: input.watermarkCorner, proShowAttribution: input.proShowAttribution ?? false, standbyBackgroundColor: input.standbyBackgroundColor ?? "#000000", backgroundAssetId: input.backgroundAssetId ?? null, logoAssetId: input.logoAssetId ?? null, message: input.message ?? "", showNextBroadcastTime: input.showNextBroadcastTime ?? false };
}

export async function saveRunnerBrandingProfileForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = saveInput.safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	const input = parsed.data;
	const detachedAssetIds: string[] = [];
	const result = await withOwnedRunner(principal, input, "runner:update", client, async (tx, authority) => {
		const runnerPro = deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx)).runnerPro;
		if (changesProBranding(input) && !runnerPro) return failure("FEATURE_RESTRICTED");
		const current = await tx.query.runnerBrandingProfilesTable.findFirst({ where: and(eq(runnerBrandingProfilesTable.ownerId, input.ownerId), eq(runnerBrandingProfilesTable.runnerId, input.runnerId)) });
		if (input.expectedRevision !== (current?.revision ?? 0)) return failure("CONFLICT");
		if (!(await brandingAssetAvailable(tx, input.ownerId, input.backgroundAssetId, "background"))) return failure("RESOURCE_UNAVAILABLE");
		if (!(await brandingAssetAvailable(tx, input.ownerId, input.logoAssetId, "logo"))) return failure("RESOURCE_UNAVAILABLE");
		detachedAssetIds.push(...detachedBrandingAssets(current, input));

		const [row] = current
			? await tx
					.update(runnerBrandingProfilesTable)
					.set({ ...brandingChanges(input), revision: current.revision + 1, updatedAt: new Date() })
					.where(and(eq(runnerBrandingProfilesTable.id, current.id), eq(runnerBrandingProfilesTable.revision, input.expectedRevision)))
					.returning()
			: await tx.insert(runnerBrandingProfilesTable).values(initialBrandingValues(input)).returning();
		if (!row) return failure("CONFLICT");
		authority.assertAuthorityCurrent();
		return { success: true as const, profile: { id: row.id, watermarkCorner: row.watermarkCorner, proShowAttribution: row.proShowAttribution, standbyBackgroundColor: row.standbyBackgroundColor, backgroundAssetId: row.backgroundAssetId, logoAssetId: row.logoAssetId, message: row.message, showNextBroadcastTime: row.showNextBroadcastTime, revision: row.revision } };
	});
	if (result.success)
		for (const detachedAssetId of new Set(detachedAssetIds)) {
			try {
				await client
					.delete(runnerBrandingAssetsTable)
					.where(
						and(
							eq(runnerBrandingAssetsTable.id, detachedAssetId),
							eq(runnerBrandingAssetsTable.ownerId, input.ownerId),
							sql`NOT EXISTS (SELECT 1 FROM runner_branding_profiles p WHERE p.background_asset_id = ${runnerBrandingAssetsTable.id} OR p.logo_asset_id = ${runnerBrandingAssetsTable.id})`,
							sql`NOT EXISTS (SELECT 1 FROM runner_schedule_events e WHERE e.owner_id = ${input.ownerId} AND e.stream_details @> jsonb_build_array(jsonb_build_object('thumbnailAssetId', ${runnerBrandingAssetsTable.id}::text)))`,
							sql`NOT EXISTS (SELECT 1 FROM runner_broadcast_admissions a WHERE a.owner_id = ${input.ownerId} AND a.benefits_at_start->'streamDetailsAtStart' @> jsonb_build_array(jsonb_build_object('thumbnailAssetId', ${runnerBrandingAssetsTable.id}::text)))`,
						),
					);
			} catch {
				Sentry.captureException(new Error("Runner branding asset cleanup failed"), { tags: { operation: "runner_branding_asset_cleanup" } });
			}
		}

	return result;
}

export async function getRunnerBrandingProfileForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = saveInput.pick({ ownerId: true, runnerId: true }).safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	const input = parsed.data;
	return withOwnedRunner(principal, input, "runner:read", client, async (tx, authority) => {
		const profile = await readRunnerBrandingProfileInternal(input, tx);
		const capabilities = deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx));
		authority.assertAuthorityCurrent();
		return { success: true as const, profile, runnerPro: capabilities.runnerPro, ...(capabilities.validUntil ? { validUntil: capabilities.validUntil } : {}) };
	});
}

/** Call only after authorizing this exact owner and Runner; never expose as a public action. */
export async function readRunnerBrandingProfileInternal(input: BrandingIdentity, client: QueryClient = db) {
	const current = await client.query.runnerBrandingProfilesTable.findFirst({ where: and(eq(runnerBrandingProfilesTable.ownerId, input.ownerId), eq(runnerBrandingProfilesTable.runnerId, input.runnerId)) });
	return current
		? { id: current.id, watermarkCorner: current.watermarkCorner, proShowAttribution: current.proShowAttribution, standbyBackgroundColor: current.standbyBackgroundColor, backgroundAssetId: current.backgroundAssetId, logoAssetId: current.logoAssetId, message: current.message, showNextBroadcastTime: current.showNextBroadcastTime, revision: current.revision }
		: { id: null, watermarkCorner: "bottom_right" as const, proShowAttribution: false, standbyBackgroundColor: "#000000", backgroundAssetId: null, logoAssetId: null, message: "", showNextBroadcastTime: false, revision: 0 };
}

/** Internal appearance read; caller must authorize this exact owner and Runner first. */
export async function readRunnerNextBroadcastInternal(...args: Parameters<typeof import("./standby-next-broadcast").readRunnerNextBroadcastInternal>) {
	return (await import("./standby-next-broadcast")).readRunnerNextBroadcastInternal(...args);
}
