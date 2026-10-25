/** @jest-environment node */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
const nativeRequire = createRequire(resolve("package.json"));
const readPackage = (resolver: NodeJS.Require, name: string) => JSON.parse(readFileSync(resolve(dirname(resolver.resolve(name)), "../package.json"), "utf8"));
const declaredDependencies = JSON.parse(readFileSync(resolve("package.json"), "utf8")).dependencies as Record<string, string>;
describe("TDD-DEPENDENCY-007 effective auth provider peer alignment", () => {
	const mcpRequire = createRequire(nativeRequire.resolve("@better-auth/mcp"));
	const effective = readPackage(mcpRequire, "@better-auth/oauth-provider");
	const root = readPackage(nativeRequire, "@better-auth/oauth-provider");
	test("MCP uses the explicitly pinned provider instead of a newer transitive copy", () => {
		expect(effective.version).toBe(root.version);
		expect(declaredDependencies["@better-auth/oauth-provider"]).toMatch(/^\d+\.\d+\.\d+$/);
		expect(root.version).toBe(declaredDependencies["@better-auth/oauth-provider"]);
	});
	test("effective provider requires peers compatible with the pinned auth/core stack", () => {
		const pinnedVersion = declaredDependencies["better-auth"];
		expect(readPackage(nativeRequire, "better-auth").version).toBe(pinnedVersion);
		expect(readPackage(nativeRequire, "@better-auth/core").version).toBe(pinnedVersion);
		expect(declaredDependencies["@better-auth/oauth-provider"]).toBe(pinnedVersion);
		expect(effective.peerDependencies["better-auth"]).toBe(`^${pinnedVersion}`);
		expect(effective.peerDependencies["@better-auth/core"]).toBe(`^${pinnedVersion}`);
	});
});
