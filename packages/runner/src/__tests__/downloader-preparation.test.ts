const fixtureBinary = Buffer.from("fixture-binary");
const fixtureBinarySha = "74dd6752f5b83360c8fb780f06d74e5edb2712ea55a59b02a263584b091993a4";
const fixtureArchiveSha = "a".repeat(64);
jest.mock("fs", () => ({
	existsSync: jest.fn(() => true),
	readFileSync: jest.fn(() => `verified:${fixtureArchiveSha}:${fixtureBinarySha}`),
	createReadStream: jest.fn(() => ({
		async *[Symbol.asyncIterator]() {
			yield fixtureBinary;
		},
	})),
	chmodSync: jest.fn(),
}));
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
	const network = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`${fixtureArchiveSha}  ffmpeg-master-latest-linux64-gpl.tar.xz\n${fixtureArchiveSha}  ffmpeg-master-latest-win64-gpl.zip`));
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
	const network = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`${fixtureArchiveSha}  ffmpeg-master-latest-linux64-gpl.tar.xz`));
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
		await expect(ensureDependencies()).rejects.toThrow("Missing binary and no checksums available");
		jest.mocked(files.existsSync).mockReturnValue(true);
		jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(`${fixtureArchiveSha}  ffmpeg-master-latest-linux64-gpl.tar.xz`));
		await expect(ensureDependencies()).resolves.toMatchObject({ chromePath: "/fixture/chrome" });
		expect(browsers.resolveBuildId).toHaveBeenCalledTimes(2);
	} finally {
		network.mockRestore();
	}
});
