import { spawn, spawnSync } from "child_process";

export function openBrowser(url: string): void {
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(url);
	} catch {
		return;
	}
	if (!["http:", "https:"].includes(parsedUrl.protocol)) return;

	const platform = process.platform;
	const command = platform === "win32" ? "cmd.exe" : platform === "darwin" ? "open" : "xdg-open";
	const args = platform === "win32" ? ["/d", "/s", "/c", "start", "", parsedUrl.href] : [parsedUrl.href];
	if (platform === "linux") {
		const hasGraphicalSession = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
		const hasXdgOpen = spawnSync("which", ["xdg-open"], { stdio: "ignore" }).status === 0;
		if (!hasGraphicalSession || !hasXdgOpen) return;
	}

	try {
		const child = spawn(command, args, { detached: true, stdio: "ignore", ...(platform === "win32" ? { windowsHide: true } : {}) });
		child.on("error", () => {});
		child.unref();
	} catch {
		// Browser auto-open is best effort; the URL and code are printed separately.
	}
}
