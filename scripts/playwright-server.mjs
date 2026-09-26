import { createServer } from "node:http";
import next from "next";

const hostname = "127.0.0.1";
const port = 3107;
const shutdownPath = "/__playwright_shutdown__";
const shutdownToken = "clipify-playwright-local-shutdown";

if (process.env.E2E_TEST_MODE !== "true") {
	throw new Error("The Playwright server may only run with E2E_TEST_MODE=true.");
}

let shuttingDown = false;
let handle;
const server = createServer(async (request, response) => {
	if (request.method === "POST" && request.url === shutdownPath) {
		if (request.headers.authorization !== `Bearer ${shutdownToken}`) {
			response.writeHead(401).end("Unauthorized");
			return;
		}

		response.writeHead(204).end();
		void shutdown();
		return;
	}

	if (!handle) {
		response.writeHead(503).end("Playwright server is starting");
		return;
	}

	await handle(request, response);
});

// next-ws resolves the custom server through its documented process-global
// bridge when Next's wrapper has not yet exposed serverOptions.httpServer.
Reflect.set(globalThis, Symbol.for("next-ws.http-server"), server);
const app = next({ dev: true, dir: process.cwd(), hostname, port, httpServer: server, webpack: true });
await app.prepare();
handle = app.getRequestHandler();

server.listen(port, hostname, () => {
	console.log(`Playwright Next.js server ready at http://${hostname}:${port}`);
});

async function shutdown() {
	if (shuttingDown) return;
	shuttingDown = true;

	server.closeAllConnections();
	await new Promise((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
	});
	await app.close();
	process.exit(0);
}
