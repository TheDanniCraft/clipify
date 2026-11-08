import { z } from "zod";
export const exportPresetSchema = z.discriminatedUnion("id", [z.object({ id: z.enum(["general", "youtube", "tiktok", "instagram", "reddit"]) }), z.object({ id: z.literal("discord"), tier: z.enum(["free", "basic", "nitro"]).optional() }), z.object({ id: z.literal("custom"), maxSizeMB: z.number().finite().min(1).max(32) })]);
export type ExportPreset = z.infer<typeof exportPresetSchema>;
export const exportPresets = [
	{ id: "general", label: "General", description: "Balanced quality for sharing" },
	{ id: "discord", label: "Discord", description: "Up to 20 MB per video" },
	{ id: "youtube", label: "YouTube", description: "Higher-quality H.264 video" },
	{ id: "tiktok", label: "TikTok", description: "H.264 video for your Mobile layout" },
	{ id: "instagram", label: "Instagram Reels", description: "H.264 video for your Mobile layout" },
	{ id: "reddit", label: "Reddit", description: "Balanced H.264 video for sharing" },
	{ id: "custom", label: "Custom size", description: "Choose a maximum file size" },
] as const;
export function exportEncoding(preset: ExportPreset, duration: number, sourceAudioBitrate?: number) {
	const selected = exportPresetSchema.parse(preset);
	if (!Number.isFinite(duration) || duration <= 0) throw new Error("invalid_media");
	const maxBytes = selected.id === "custom" ? Math.floor(selected.maxSizeMB * 1_000_000) : selected.id === "discord" && (!selected.tier || selected.tier === "free") ? 20_000_000 : 32 * 1024 * 1024 - 1;
	const audioBitrate = sourceAudioBitrate ?? (selected.id === "youtube" ? 192000 : 128000);
	if (!Number.isFinite(audioBitrate) || audioBitrate < 0) throw new Error("invalid_media");
	const ceiling = ["youtube", "tiktok", "instagram"].includes(selected.id) ? 5000000 : 4000000;
	// Leave room for muxing overhead and encoder variation; verify actual bytes afterwards.
	const videoBitrate = Math.floor(Math.min(ceiling, ((maxBytes * 0.94 - 65536) * 8) / duration - audioBitrate));
	if (videoBitrate < 100000) throw new Error("preset_size_limit");
	return { videoBitrate, audioBitrate, maxBytes, frameRate: 30 };
}
export type ExportEncoding = ReturnType<typeof exportEncoding>;
export async function encodeForPreset(preset: ExportPreset, duration: number, signal: AbortSignal, render: (encoding: ExportEncoding) => Promise<Uint8Array<ArrayBuffer>>, sourceAudioBitrate?: number) {
	let encoding = exportEncoding(preset, duration, sourceAudioBitrate);
	for (let attempt = 0; attempt < 3; attempt++) {
		signal.throwIfAborted();
		let size: number;
		try {
			const bytes = await render(encoding);
			signal.throwIfAborted();
			if (bytes.byteLength <= encoding.maxBytes) return bytes;
			size = bytes.byteLength;
		} catch (error) {
			signal.throwIfAborted();
			if (!(error instanceof Error) || error.message !== "file_size_limit") throw error;
			size = encoding.maxBytes * 1.5;
		}
		encoding = { ...encoding, videoBitrate: Math.floor(encoding.videoBitrate * Math.min(0.8, (encoding.maxBytes / size) * 0.9)) };
		if (encoding.videoBitrate < 100000) break;
	}
	throw new Error("preset_size_limit");
}
