import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import sharp, { type OutputInfo } from "sharp";
import { db, type DatabaseClient, type QueryClient } from "@/db/client";
import { runnerBrandingAssetsTable } from "@/db/schema";
import type { TrustedCreatorPrincipal } from "@/auth/authorize-operation";
import { deriveRunnerCapabilities, resolveRunnerBenefits } from "./capabilities";
import { withOwnedRunner } from "./branding-profiles";
export const MAX_RUNNER_ASSET_BYTES = 2097152;
const identity = z
	.object({
		ownerId: z
			.string()
			.min(1)
			.max(255)
			.regex(/^[A-Za-z0-9_-]+$/),
		runnerId: z.uuid(),
		kind: z.enum(["background", "logo"]),
		bytes: z.instanceof(Uint8Array),
	})
	.strict();
const invalid = (error: string) => ({ success: false as const, code: "INVALID_INPUT" as const, error });
export async function storeRunnerBrandingAssetForPrincipal(principal: TrustedCreatorPrincipal, rawInput: unknown, client: DatabaseClient = db) {
	const parsed = identity.safeParse(rawInput);
	if (!parsed.success) return invalid("Choose a valid Runner image.");
	const input = parsed.data;
	if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_RUNNER_ASSET_BYTES) return invalid("Images must be no larger than 2 MiB.");
	return withOwnedRunner(principal, input, "runner:update", client, async (tx, authority) => {
		if (!deriveRunnerCapabilities(await resolveRunnerBenefits(authority.creator, tx)).runnerPro) return { success: false as const, code: "FEATURE_RESTRICTED" as const, error: "Custom standby images require Pro." };
		const bytes = Buffer.from(input.bytes);
		const magicFormat = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png" : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? "jpeg" : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" ? "webp" : null;
		if (!magicFormat) return invalid("Use a PNG, JPEG, or WebP image.");
		let image: { data: Buffer; info: OutputInfo };
		try {
			const raster = sharp(bytes, { limitInputPixels: 16000000, animated: false });
			const metadata = await raster.metadata();
			if (metadata.format !== magicFormat) return invalid("Use a PNG, JPEG, or WebP image.");
			if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || metadata.width * metadata.height > 16000000) return invalid("Images must fit 4096 pixels per side and 16 million pixels total.");
			const normalized = raster.rotate();
			image = await (metadata.format === "jpeg" ? normalized.jpeg({ quality: 90 }) : metadata.format === "webp" ? normalized.webp({ quality: 90 }) : normalized.png({ compressionLevel: 9 })).toBuffer({ resolveWithObject: true });
			if (image.data.byteLength > MAX_RUNNER_ASSET_BYTES) return invalid("The normalized image must fit within 2 MiB. Choose a smaller image.");
		} catch {
			return invalid("This image could not be read. Choose a different PNG, JPEG, or WebP file.");
		}
		authority.assertAuthorityCurrent();
		const [asset] = await tx
			.insert(runnerBrandingAssetsTable)
			.values({ ownerId: input.ownerId, kind: input.kind, normalizedMime: `image/${image.info.format}`, sizeBytes: image.data.byteLength, width: image.info.width, height: image.info.height, checksum: createHash("sha256").update(image.data).digest("hex"), bytes: image.data })
			.returning({ id: runnerBrandingAssetsTable.id });
		authority.assertAuthorityCurrent();
		return { success: true as const, asset: { id: asset.id, kind: input.kind } };
	});
}
export async function readOwnedRunnerBrandingAsset(ownerId: string, assetId: string, kind: "logo" | "background", client: QueryClient = db) {
	if (!z.uuid().safeParse(assetId).success) return null;
	return (await client.query.runnerBrandingAssetsTable.findFirst({ where: and(eq(runnerBrandingAssetsTable.ownerId, ownerId), eq(runnerBrandingAssetsTable.id, assetId), eq(runnerBrandingAssetsTable.kind, kind)) })) ?? null;
}
export function runnerAssetResponse(asset: NonNullable<Awaited<ReturnType<typeof readOwnedRunnerBrandingAsset>>>) {
	return new Response(new Uint8Array(asset.bytes), { headers: { "Content-Type": asset.normalizedMime, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=600", Vary: "Cookie" } });
}
