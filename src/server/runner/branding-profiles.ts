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

export async function saveRunnerBrandingProfileForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = saveInput.safeParse(rawInput);
	if (!parsed.success) return failure("INVALID_INPUT");
	const input = parsed.data;
	const detachedAssetIds: string[] = [];
	const result = await withOwnedRunner(principal, input, "runner:update", client, async (tx, authority) => {
		const runnerPro = deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx)).runnerPro;
		if ((input.proShowAttribution !== undefined || input.standbyBackgroundColor !== undefined || input.backgroundAssetId !== undefined || input.logoAssetId !== undefined || input.message !== undefined || input.showNextBroadcastTime !== undefined) && !runnerPro) return failure("FEATURE_RESTRICTED");
		const current = await tx.query.runnerBrandingProfilesTable.findFirst({ where: and(eq(runnerBrandingProfilesTable.ownerId, input.ownerId), eq(runnerBrandingProfilesTable.runnerId, input.runnerId)) });
		if (input.expectedRevision !== (current?.revision ?? 0)) return failure("CONFLICT");
		if (input.backgroundAssetId) {
			const asset = await tx.query.runnerBrandingAssetsTable.findFirst({ where: and(eq(runnerBrandingAssetsTable.id, input.backgroundAssetId), eq(runnerBrandingAssetsTable.ownerId, input.ownerId), eq(runnerBrandingAssetsTable.kind, "background")), columns: { id: true } });
			if (!asset) return failure("RESOURCE_UNAVAILABLE");
		}
		if (input.logoAssetId) {
			const asset = await tx.query.runnerBrandingAssetsTable.findFirst({ where: and(eq(runnerBrandingAssetsTable.id, input.logoAssetId), eq(runnerBrandingAssetsTable.ownerId, input.ownerId), eq(runnerBrandingAssetsTable.kind, "logo")), columns: { id: true } });
			if (!asset) return failure("RESOURCE_UNAVAILABLE");
		}
		if (current?.backgroundAssetId && input.backgroundAssetId !== undefined && input.backgroundAssetId !== current.backgroundAssetId) detachedAssetIds.push(current.backgroundAssetId);
		if (current?.logoAssetId && input.logoAssetId !== undefined && input.logoAssetId !== current.logoAssetId) detachedAssetIds.push(current.logoAssetId);

		const [row] = current
			? await tx
					.update(runnerBrandingProfilesTable)
					.set({
						watermarkCorner: input.watermarkCorner,
						...(input.proShowAttribution !== undefined ? { proShowAttribution: input.proShowAttribution } : {}),
						...(input.standbyBackgroundColor !== undefined ? { standbyBackgroundColor: input.standbyBackgroundColor } : {}),
						...(input.backgroundAssetId !== undefined ? { backgroundAssetId: input.backgroundAssetId } : {}),
						...(input.logoAssetId !== undefined ? { logoAssetId: input.logoAssetId } : {}),
						...(input.message !== undefined ? { message: input.message } : {}),
						...(input.showNextBroadcastTime !== undefined ? { showNextBroadcastTime: input.showNextBroadcastTime } : {}),
						revision: current.revision + 1,
						updatedAt: new Date(),
					})
					.where(and(eq(runnerBrandingProfilesTable.id, current.id), eq(runnerBrandingProfilesTable.revision, input.expectedRevision)))
					.returning()
			: await tx
					.insert(runnerBrandingProfilesTable)
					.values({ ownerId: input.ownerId, runnerId: input.runnerId, watermarkCorner: input.watermarkCorner, proShowAttribution: input.proShowAttribution ?? false, standbyBackgroundColor: input.standbyBackgroundColor ?? "#000000", backgroundAssetId: input.backgroundAssetId ?? null, logoAssetId: input.logoAssetId ?? null, message: input.message ?? "", showNextBroadcastTime: input.showNextBroadcastTime ?? false })
					.returning();
		if (!row) return failure("CONFLICT");
		authority.assertAuthorityCurrent();
		return { success: true as const, profile: { id: row.id, watermarkCorner: row.watermarkCorner, proShowAttribution: row.proShowAttribution, standbyBackgroundColor: row.standbyBackgroundColor, backgroundAssetId: row.backgroundAssetId, logoAssetId: row.logoAssetId, message: row.message, showNextBroadcastTime: row.showNextBroadcastTime, revision: row.revision } };
	});
	if (result.success)
		for (const detachedAssetId of new Set(detachedAssetIds)) {
			try {
				await client.delete(runnerBrandingAssetsTable).where(and(eq(runnerBrandingAssetsTable.id, detachedAssetId), eq(runnerBrandingAssetsTable.ownerId, input.ownerId), sql`NOT EXISTS (SELECT 1 FROM runner_branding_profiles p WHERE p.background_asset_id = ${runnerBrandingAssetsTable.id} OR p.logo_asset_id = ${runnerBrandingAssetsTable.id})`));
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
