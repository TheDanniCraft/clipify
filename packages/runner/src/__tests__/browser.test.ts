import { openBrowser } from "../browser";
import { spawn } from "child_process";

jest.mock("child_process", () => ({
	spawn: jest.fn(() => ({ on: jest.fn(), unref: jest.fn() })),
	spawnSync: jest.fn(() => ({ status: 0 })),
}));

describe("openBrowser", () => {
	const originalPlatform = process.platform;

	afterEach(() => {
		Object.defineProperty(process, "platform", { value: originalPlatform });
		jest.clearAllMocks();
	});

	it("rejects non-web protocols", () => {
		openBrowser("javascript:alert(1)");
		expect(spawn).not.toHaveBeenCalled();
	});

	it("opens web URLs through the Windows default handler without a visible shell", () => {
		Object.defineProperty(process, "platform", { value: "win32" });
		const url = "https://clipify.us/runner/enroll?code=%26whoami";

		openBrowser(url);

		expect(spawn).toHaveBeenCalledWith("cmd.exe", ["/d", "/s", "/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
	});
});
