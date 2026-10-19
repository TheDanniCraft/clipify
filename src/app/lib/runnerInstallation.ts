export type RunnerPlatform = "windows" | "linux" | "linux-arm64" | "macos" | "macos-arm64";
type Manifest = Partial<Record<"windows" | "linux" | "linuxArm" | "macos" | "macosArm", string | null>> | null;
export function normalizeRunnerVersion(version: string | null | undefined) {
	return (version ?? "").trim().replace(/^v/i, "").toLowerCase();
}
export function formatRunnerVersion(version: string | null | undefined) {
	return version ? normalizeRunnerVersion(version).slice(0, 8) : "Unknown";
}
export function getRunnerPlatformFromOs(osInfo: string | null | undefined): RunnerPlatform | null {
	const os = (osInfo ?? "").toLowerCase();
	if (os.includes("windows")) return "windows";
	if (os.includes("linux")) return os.includes("arm64") || os.includes("aarch64") ? "linux-arm64" : "linux";
	if (os.includes("darwin") || os.includes("mac")) {
		if (os.includes("arm64") || os.includes("aarch64")) return "macos-arm64";
		if (os.includes("x64") || os.includes("x86_64")) return "macos";
	}
	return null;
}
export function getRunnerVersionState(runner: { version?: string | null; osInfo?: string | null }, manifest: Manifest): "latest" | "outdated" | "unknown" {
	const version = normalizeRunnerVersion(runner.version);
	if (!version || version === "unknown" || !manifest) return "unknown";
	const platform = getRunnerPlatformFromOs(runner.osInfo);
	const keys: Record<RunnerPlatform, keyof NonNullable<Manifest>> = { windows: "windows", linux: "linux", "linux-arm64": "linuxArm", macos: "macos", "macos-arm64": "macosArm" };
	const mac = /darwin|mac/i.test(runner.osInfo ?? "");
	const candidates = (platform ? [manifest[keys[platform]]] : mac ? [manifest.macos, manifest.macosArm] : Object.values(manifest)).filter((hash): hash is string => Boolean(hash));
	if (!candidates.length) return "unknown";
	return candidates.some((hash) => normalizeRunnerVersion(hash) === version) ? "latest" : "outdated";
}
