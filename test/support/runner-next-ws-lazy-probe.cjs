(async () => {
	const { EventEmitter } = await import("node:events");
	const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { default: lazyModule } = await import("next/dist/server/lib/lazy-module.js");
	const { LazyModule } = lazyModule;
	const { default: adapter } = await import("next-ws/server");
	const variant = process.argv[2];
	const directory = mkdtempSync(join(tmpdir(), "clipify-nextws-lazy-"));
	let resolveLoad,
		rejectLoad,
		ensureCalls = 0,
		upgraded = 0,
		ended = 0;
	const load = new Promise((resolve, reject) => {
		resolveLoad = resolve;
		rejectLoad = reject;
	});
	const lazy = new LazyModule(
		() => load,
		() => {},
	);
	const userland = { UPGRADE() {} };
	globalThis.__clipifyNextWsFixture =
		variant === "legacy"
			? { userland }
			: {
					get userland() {
						return lazy.assertLoaded();
					},
					async ensureUserland() {
						ensureCalls++;
						await lazy.waitUntilLoaded();
					},
				};
	const filename = join(directory, "route.cjs");
	writeFileSync(filename, "module.exports={routeModule:globalThis.__clipifyNextWsFixture};");
	const server = new EventEmitter();
	adapter.setHttpServer(server);
	adapter.setWebSocketServer({
		handleUpgrade() {
			upgraded++;
		},
		emit() {},
	});
	adapter.setupWebSocketServer({
		serverOptions: { httpServer: server, conf: {} },
		getAppPathRoutes() {
			return { "/ws": ["/ws/route"] };
		},
		async ensurePage() {},
		getPagePath() {
			return filename;
		},
	});
	const message = Object.assign(new EventEmitter(), { headers: { host: "localhost" }, socket: {}, url: "/ws", method: "GET" });
	const callback = server.listeners("upgrade")[0];
	let error = null;
	const outcome = Promise.resolve(
		callback(
			message,
			{
				end() {
					ended++;
				},
			},
			Buffer.alloc(0),
		),
	).catch((cause) => {
		error = cause.message;
	});
	await new Promise((resolve) => setImmediate(resolve));
	const openedBeforeReady = upgraded;
	if (variant === "failure") rejectLoad(new Error("CLIPIFY_EXPECTED_ROUTE_LOAD_FAILURE"));
	else resolveLoad(userland);
	// Legacy modules never use the deferred fixture promise.
	if (variant === "legacy") load.catch(() => {});
	await outcome;
	rmSync(directory, { recursive: true, force: true });
	console.log(JSON.stringify({ variant, error, ensureCalls, openedBeforeReady, upgraded, ended }));
})().catch((cause) => {
	console.error(cause);
	process.exitCode = 1;
});
