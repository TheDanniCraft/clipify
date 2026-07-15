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

	it("opens web URLs with explorer.exe on Windows without a shell", () => {
		Object.defineProperty(process, "platform", { value: "win32" });
		const url = "https://clipify.us/runner/enroll?code=%26whoami";

		openBrowser(url);

		expect(spawn).toHaveBeenCalledWith("explorer.exe", [url], { detached: true, stdio: "ignore" });
	});
});
