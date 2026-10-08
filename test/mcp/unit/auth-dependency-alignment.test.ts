/** @jest-environment node */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
const nativeRequire = createRequire(resolve("package.json"));
const readPackage = (resolver: NodeJS.Require, name: string) => JSON.parse(readFileSync(resolve(dirname(resolver.resolve(name)), "../package.json"), "utf8"));
describe("TDD-DEPENDENCY-007 effective auth provider peer alignment", () => {
	const mcpRequire = createRequire(nativeRequire.resolve("@better-auth/mcp"));
	const effective = readPackage(mcpRequire, "@better-auth/oauth-provider");
	const root = readPackage(nativeRequire, "@better-auth/oauth-provider");
	test("MCP uses the explicitly pinned provider instead of a newer transitive copy", () => {
		expect(effective.version).toBe(root.version);
		expect(root.version).toBe("1.7.7");
	});
	test("effective provider requires peers compatible with the pinned auth/core stack", () => {
		expect(readPackage(nativeRequire, "better-auth").version).toBe("1.7.7");
		expect(readPackage(nativeRequire, "@better-auth/core").version).toBe("1.7.7");
		expect(effective.peerDependencies["better-auth"]).toBe("^1.7.7");
		expect(effective.peerDependencies["@better-auth/core"]).toBe("^1.7.7");
	});
});
