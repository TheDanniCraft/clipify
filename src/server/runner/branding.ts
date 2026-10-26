export type RunnerPresentationSurface = "generated_playback" | "generated_fallback" | "generated_standby" | "live" | "ordinary_overlay";

/** Only Clipify-generated work carries the admitted owner's attribution policy. */
export function resolveRunnerPresentationPolicy(authority: { runnerPro: boolean; validUntil?: unknown }, surface: RunnerPresentationSurface, appearance?: { proShowAttribution?: boolean }) {
	const deadline = authority.validUntil;
	const runnerPro = authority.runnerPro && (deadline == null || (typeof deadline === "string" && Date.parse(deadline) > Date.now()));
	return { attributionRequired: surface.startsWith("generated_") && (!runnerPro || appearance?.proShowAttribution === true) };
}

export { resolveRunnerBrandingPlacement, isRunnerAttributionContrastReadable, resolveRunnerAttributionStyle, expandRunnerOccupiedRect } from "@/app/lib/runnerBrandingLayout";

export async function saveRunnerBrandingProfileForPrincipal(...input: Parameters<typeof import("./branding-profiles").saveRunnerBrandingProfileForPrincipal>) {
	return (await import("./branding-profiles")).saveRunnerBrandingProfileForPrincipal(...input);
}

export async function getRunnerBrandingProfileForPrincipal(...input: Parameters<typeof import("./branding-profiles").getRunnerBrandingProfileForPrincipal>) {
	return (await import("./branding-profiles")).getRunnerBrandingProfileForPrincipal(...input);
}

export async function storeRunnerBrandingAssetForPrincipal(...input: Parameters<typeof import("./branding-assets").storeRunnerBrandingAssetForPrincipal>) {
	return (await import("./branding-assets")).storeRunnerBrandingAssetForPrincipal(...input);
}

export async function readRunnerNextBroadcastInternal(...args: Parameters<typeof import("./branding-profiles").readRunnerNextBroadcastInternal>) {
	return (await import("./branding-profiles")).readRunnerNextBroadcastInternal(...args);
}
