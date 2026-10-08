/** @jest-environment node */
import { availableGroups, groupLevel, groupScopes, presetScopes, callbackCommand } from "@/server/mcp/consent-permissions";
const requested = ["creator:read", "overlay:read", "overlay:update", "overlay:delete", "feedback:create"];
test("Read excludes all writes, including feedback submissions", () => {
	expect(presetScopes("read", requested)).toEqual(["creator:read", "overlay:read"]);
});
test("Write includes only requested operations and preserves readonly information", () => {
	expect(presetScopes("write", requested)).toEqual(requested);
	expect(groupLevel(availableGroups(requested)[0], presetScopes("write", requested))).toBe("read");
});
test("custom levels cannot introduce a scope the client did not request", () => {
	const overlay = availableGroups(requested).find((group) => group.id === "overlays")!;
	expect(groupScopes(overlay, "write", ["overlay:read"])).toEqual(["overlay:read"]);
	expect(groupScopes(overlay, "none", requested)).toEqual([]);
});
test("callback commands quote shell metacharacters instead of executing them", () => {
	const url = "http://localhost:1234/callback?code=a'b&state=$(touch /tmp/unsafe)";
	expect(callbackCommand(url, "curl")).toBe("curl --globoff -- 'http://localhost:1234/callback?code=a'\\''b&state=$(touch /tmp/unsafe)'");
	expect(callbackCommand(url, "wget")).toMatch(/^wget -O \/dev\/null -- '/);
});
