import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

const source = resolve(import.meta.dirname, "..");
const reportDirectory = join(source, "test-results/connected-apps");
mkdirSync(reportDirectory, { recursive: true });
const startedAt = new Date().toISOString();
function report(result) {
	writeFileSync(join(reportDirectory, "report.json"), JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), topology: "two-compose-projects-with-distinct-private-databases-and-shared-internal-http-network", adapter: "native-bun-handlers-with-server-only-marker-preload", ...result }, null, 2) + "\n");
}
report({ ok: false, status: "incomplete" });
const directory = mkdtempSync(join(tmpdir(), "clipify-connected-apps-"));
chmodSync(directory, 0o700);
const project = `clipify-apps-${randomUUID().slice(0, 8)}`;
const httpNetwork = `${project}-http`;
const environment = { ...process.env, CLIPIFY_APPS_HTTP_NETWORK: httpNetwork, CLIPIFY_APPS_SOURCE: source, CLIPIFY_APPS_TEST_DIRECTORY: directory, CLIPIFY_APPS_UID: String(process.getuid()), CLIPIFY_APPS_GID: String(process.getgid()) };
function stack(which, args, options = {}) {
	return execFileSync("docker", ["compose", "--project-name", `${project}-${which}`, "--file", join(source, `test/support/connected-apps/${which}.compose.json`), ...args], { cwd: source, env: environment, encoding: "utf8", timeout: 240000, ...options });
}
const docker = (args, options = {}) => stack("clipify", args, options);
const awardsDocker = (args, options = {}) => stack("awards", args, options);
const json = (output) => JSON.parse(output.trim().split("\n").at(-1));
function awards(extra = [], args = ["search", "--title", "Minecraft", "--limit", "25"]) {
	return awardsDocker(["run", "--rm", "--no-deps", ...extra, "awards", ...args]);
}
function database(service) {
	const which = service === "awards-db" ? "awards" : "clipify";
	const id = stack(which, ["ps", "--quiet", service]).trim();
	assert.ok(id, `missing ${service}`);
	const [details] = JSON.parse(execFileSync("docker", ["inspect", id], { encoding: "utf8" }));
	assert.equal(details.Config.Labels["com.docker.compose.project"], `${project}-${which}`);
	assert.ok(!details.HostConfig.PortBindings || Object.keys(details.HostConfig.PortBindings).length === 0, `${service} published a host port`);
	assert.ok(
		Object.values(details.NetworkSettings.Ports ?? {}).every((bindings) => bindings === null),
		`${service} has an external database binding`,
	);
	assert.equal(Object.keys(details.NetworkSettings.Networks).length, 1);
	return Object.values(details.NetworkSettings.Networks)[0].IPAddress;
}
const deniedSocket = `import net from 'node:net'; const socket=net.createConnection({host:process.argv[1],port:5432}); const finish=()=>{socket.destroy();process.stdout.write('isolated\\n');};socket.once('connect',()=>{socket.destroy();process.exitCode=1;console.error('unexpected database connection');});socket.once('error',finish);socket.setTimeout(1000,finish);`;
try {
	for (const [name, value] of Object.entries({ client_id: "pending", client_secret: "pending", awards_password: "awards_fixture_password" })) writeFileSync(join(directory, name), value, { mode: name === "awards_password" ? 0o444 : 0o600 });
	execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", join(directory, "ca.key"), "-out", join(directory, "ca.crt"), "-days", "1", "-subj", "/CN=clipify", "-addext", "subjectAltName=DNS:clipify,IP:127.0.0.1"], { stdio: "ignore" });
	execFileSync("bun", ["packages/sdk/prepare-awards.mjs"], { cwd: source, env: environment, stdio: "inherit", timeout: 120000 });
	execFileSync("docker", ["network", "create", "--internal", httpNetwork], { stdio: "ignore" });
	awardsDocker(["build", "awards"], { stdio: "inherit" });
	docker(["up", "--detach", "--wait", "--wait-timeout", "120", "clipify"], { stdio: "inherit" });
	awardsDocker(["up", "--detach", "--wait", "--wait-timeout", "120", "awards-db"], { stdio: "inherit" });
	const clipifyIp = database("clipify-db");
	const awardsIp = database("awards-db");
	assert.notEqual(clipifyIp, awardsIp);
	const security = json(docker(["exec", "--no-TTY", "clipify", "bun", "--preload", "./test/support/connected-apps/preload.mjs", "test/support/connected-apps/security.ts"]));
	assert.equal(security.ok, true);
	assert.equal(json(awards()).items.length, 2);
	const empty = json(awards([], ["search", "--title", "definitely absent"]));
	assert.deepEqual(empty.items, []);
	let foreign;
	try {
		awards(["--env", "CLIPIFY_CREATOR_ID=999999999"]);
	} catch (error) {
		foreign = error;
	}
	assert.ok(foreign, "foreign creator unexpectedly allowed");
	assert.equal(json(foreign.stderr).error.code, "ACCESS_DENIED");
	awardsDocker(["run", "--rm", "--no-deps", "--entrypoint", "node", "awards", "--input-type=module", "-e", deniedSocket, clipifyIp]);
	docker(["exec", "--no-TTY", "clipify", "bun", "-e", deniedSocket, awardsIp]);
	const firstSecret = readFileSync(join(directory, "client_secret"), "utf8");
	assert.ok(firstSecret.length > 20);
	const revoke = json(docker(["exec", "--no-TTY", "clipify", "bun", "--preload", "./test/support/connected-apps/preload.mjs", "test/support/connected-apps/security.ts", "revoke"]));
	assert.equal(revoke.ok, true);
	let revoked;
	try {
		awards();
	} catch (error) {
		revoked = error;
	}
	assert.ok(revoked, "revoked application unexpectedly allowed");
	assert.ok(["ACCESS_DENIED", "AUTHENTICATION_REQUIRED"].includes(json(revoked.stderr).error.code));
	const result = { ok: true, composeProjects: 2, privateDatabases: 2, authorisedSearch: true, emptySearch: true, foreignCreatorDenied: true, crossDatabaseConnectionsDenied: true, revokedApplicationDenied: true, security: security.checks };
	report(result);
	console.log(JSON.stringify(result));
} catch (error) {
	report({ ok: false, status: "failed", category: error instanceof assert.AssertionError ? "acceptance-assertion" : "fixture-command" });
	try {
		process.stderr.write(docker(["logs", "--no-color", "--tail", "70", "clipify"]));
	} catch {
		/* Startup may have failed before containers existed. */
	}
	throw error;
} finally {
	try {
		for (const which of ["awards", "clipify"]) {
			try {
				stack(which, ["down", "--volumes", "--remove-orphans"], { stdio: "inherit" });
			} catch {
				process.exitCode = 1;
			}
		}
		try {
			execFileSync("docker", ["network", "rm", httpNetwork], { stdio: "ignore" });
		} catch {
			process.exitCode = 1;
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}
