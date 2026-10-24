jest.mock("fs", () => ({ existsSync: jest.fn(() => true), readFileSync: jest.fn(() => "fixture-sha"), chmodSync: jest.fn() }));
jest.mock("child_process", () => ({
	execSync: jest.fn(() => {
		throw new Error("not installed");
	}),
}));
jest.mock("@puppeteer/browsers", () => ({ Browser: { CHROME: "chrome" }, resolveBuildId: jest.fn(), computeExecutablePath: jest.fn(() => "/fixture/chrome"), install: jest.fn() }));

beforeEach(() => {
	jest.resetModules();
	jest.clearAllMocks();
});

test("startup preparation and simultaneous broadcast starts share one download and reuse the ready binaries", async () => {
	let finish!: (build: string) => void;
	const network = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response("fixture-sha  ffmpeg-master-latest-linux64-gpl.tar.xz\nfixture-sha  ffmpeg-master-latest-win64-gpl.zip"));
	try {
		const { ensureDependencies } = await import("../downloader");
		// Use this module instance's mocks after resetting the module registry.
		const browsers = await import("@puppeteer/browsers");
		jest.mocked(browsers.resolveBuildId).mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		const preparation = ensureDependencies();
		expect(ensureDependencies()).toBe(preparation);
		finish("fixture-build");
		await expect(preparation).resolves.toMatchObject({ chromePath: "/fixture/chrome" });
		expect(ensureDependencies()).toBe(preparation);
		expect(browsers.resolveBuildId).toHaveBeenCalledTimes(1);
	} finally {
		network.mockRestore();
	}
});

test("failed preparation can retry instead of caching a rejected download", async () => {
	const { ensureDependencies } = await import("../downloader");
	const browsers = await import("@puppeteer/browsers");
	jest.mocked(browsers.resolveBuildId).mockRejectedValueOnce(new Error("offline")).mockResolvedValue("fixture-build");
	const network = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(""));
	try {
		await expect(ensureDependencies()).rejects.toThrow("offline");
		await expect(ensureDependencies()).resolves.toMatchObject({ chromePath: "/fixture/chrome" });
		expect(browsers.resolveBuildId).toHaveBeenCalledTimes(2);
	} finally {
		network.mockRestore();
	}
});

test("a missing FFmpeg binary after an unsuccessful download is not cached as ready", async () => {
	const { ensureDependencies } = await import("../downloader");
	const browsers = await import("@puppeteer/browsers");
	const files = await import("fs");
	jest.mocked(browsers.resolveBuildId).mockResolvedValue("fixture-build");
	jest.mocked(files.existsSync).mockImplementation((file) => !String(file).includes("ffmpeg"));
	const network = jest.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(""));
	try {
		await expect(ensureDependencies()).rejects.toThrow("Runner dependencies are not ready");
		jest.mocked(files.existsSync).mockReturnValue(true);
		await expect(ensureDependencies()).resolves.toMatchObject({ chromePath: "/fixture/chrome" });
		expect(browsers.resolveBuildId).toHaveBeenCalledTimes(2);
	} finally {
		network.mockRestore();
	}
});
