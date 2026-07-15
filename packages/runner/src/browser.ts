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
	const command = platform === "win32" ? "explorer.exe" : platform === "darwin" ? "open" : "xdg-open";
	if (platform === "linux") {
		const hasGraphicalSession = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
		const hasXdgOpen = spawnSync("which", ["xdg-open"], { stdio: "ignore" }).status === 0;
		if (!hasGraphicalSession || !hasXdgOpen) return;
	}

	try {
		const child = spawn(command, [url], { detached: true, stdio: "ignore" });
		child.on("error", () => {});
		child.unref();
	} catch {
		// Browser auto-open is best effort; the URL and code are printed separately.
	}
}
