import { formatRunnerVersion, getRunnerPlatformFromOs, getRunnerVersionState } from "@/app/lib/runnerInstallation";
const manifest = { windows: "windows-hash", linux: "linux-hash", linuxArm: "arm-hash", macos: "intel-hash", macosArm: "apple-hash" };
test.each([
	["Windows 11 x64", "windows", "windows-hash"],
	["Linux x86_64", "linux", "linux-hash"],
	["Linux aarch64", "linux-arm64", "arm-hash"],
	["Darwin arm64", "macos-arm64", "apple-hash"],
	["macOS x64", "macos", "intel-hash"],
])("detects matching platform and latest build for %s", (os, platform, hash) => {
	expect(getRunnerPlatformFromOs(os)).toBe(platform);
	expect(getRunnerVersionState({ osInfo: os, version: hash }, manifest)).toBe("latest");
	expect(getRunnerVersionState({ osInfo: os, version: "older-build" }, manifest)).toBe("outdated");
});
test("an unavailable platform build or unknown installed version does not become a false update warning", () => {
	expect(getRunnerVersionState({ osInfo: "Linux arm64", version: "old" }, { linux: "old" })).toBe("unknown");
	expect(getRunnerVersionState({ osInfo: "Linux x64", version: "unknown" }, manifest)).toBe("unknown");
	expect(getRunnerVersionState({ osInfo: "Linux x64", version: "old" }, null)).toBe("unknown");
});
test("ambiguous macOS offers no guessed architecture while accepting a matching macOS hash", () => {
	expect(getRunnerPlatformFromOs("macOS")).toBeNull();
	expect(getRunnerVersionState({ osInfo: "macOS", version: "apple-hash" }, manifest)).toBe("latest");
	expect(formatRunnerVersion("vABCDEF123456")).toBe("abcdef12");
});
