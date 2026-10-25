// Each guide browser case owns this server and a disposable loopback database.
import { createServer } from "node:http";
import next from "next";
if (process.env.E2E_TEST_MODE !== "true" || process.env.APP_ENV !== "test") throw new Error("Test server requires E2E mode");
const hostname = "127.0.0.1";
let handle;
const server = createServer(async (request, response) => {
	if (request.method === "POST" && request.url === "/__tour_shutdown__" && request.headers.authorization === "Bearer tour-test-shutdown") {
		response.writeHead(204).end();
		server.closeAllConnections();
		server.close();
		await app.close();
		process.exit(0);
	}
	if (!handle) {
		response.writeHead(503).end();
		return;
	}
	await handle(request, response);
});
await new Promise((resolve) => server.listen(0, hostname, resolve));
const port = server.address().port;
process.env.NEXT_PUBLIC_BASE_URL = `http://${hostname}:${port}`;
Reflect.set(globalThis, Symbol.for("next-ws.http-server"), server);
const app = next({ dev: false, dir: process.cwd(), hostname, port, httpServer: server, webpack: true });
await app.prepare();
handle = app.getRequestHandler();
console.log(`TOUR_SERVER_URL=http://${hostname}:${port}`);
