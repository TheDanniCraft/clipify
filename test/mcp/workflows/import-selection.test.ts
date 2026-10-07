/** @jest-environment node */
let selections: any;
try {
	selections = require("@/server/resources/import-selection");
} catch {}
const principal = { kind: "oauth", authUserId: "actor", grantId: "grant", generation: 1, clientId: "client" };
const selection = { creatorId: "creator", playlistId: "00000000-0000-4000-8000-000000000001", expectedRevision: 1, clipIds: ["ClipOne", "ClipTwo"], requiresPro: false };
const options = { secret: "isolated-preview-signing-secret-32chars", now: 1000 };
describe("TDD-US2-SELECTION exact authenticated import preview", () => {
	test("retains the exact set/revision and expires after ten minutes", () => {
		expect(selections?.encodeImportSelection).toEqual(expect.any(Function));
		const token = selections.encodeImportSelection(selection, principal, options);
		expect(selections.decodeImportSelection(token, principal, selection, { ...options, now: 2000 })).toMatchObject(selection);
		expect(() => selections.decodeImportSelection(token, principal, selection, { ...options, now: 601000 })).toThrow("INVALID_INPUT");
	});
	test.each(["authUserId", "grantId", "generation", "clientId"])("does not accept a different %s", (field) => {
		expect(selections?.encodeImportSelection).toEqual(expect.any(Function));
		const token = selections.encodeImportSelection(selection, principal, options);
		expect(() => selections.decodeImportSelection(token, { ...principal, [field]: field === "generation" ? 2 : "other" }, selection, options)).toThrow("INVALID_INPUT");
	});
	test("rejects tampering, foreign targets and duplicate selection IDs", () => {
		expect(selections?.encodeImportSelection).toEqual(expect.any(Function));
		const token = selections.encodeImportSelection(selection, principal, options);
		expect(() => selections.decodeImportSelection(token + "x", principal, selection, options)).toThrow("INVALID_INPUT");
		expect(() => selections.decodeImportSelection(token, principal, { ...selection, creatorId: "other" }, options)).toThrow("INVALID_INPUT");
		expect(() => selections.encodeImportSelection({ ...selection, clipIds: ["One", "One"] }, principal, options)).toThrow("INVALID_INPUT");
	});
});

export {};

test("preview selection rejects another playlist and malformed token envelopes", () => {
	const token = selections.encodeImportSelection(selection, principal, options);
	expect(() => selections.decodeImportSelection(token, principal, { ...selection, playlistId: "11111111-1111-4111-8111-111111111111" }, options)).toThrow("INVALID_INPUT");
	for (const invalid of ["not-a-token", "a.a", `${token}.extra`, "x".repeat(100001)]) expect(() => selections.decodeImportSelection(invalid, principal, selection, options)).toThrow("INVALID_INPUT");
});
test.each([{ kind: "session" }, { grantId: undefined }, { clientId: undefined }, { generation: 0 }])("preview signing requires a complete OAuth binding %j", (change) => {
	expect(() => selections.encodeImportSelection(selection, { ...principal, ...change }, options)).toThrow("INVALID_INPUT");
});
test("preview signing requires a sufficiently strong configured secret", () => {
	expect(() => selections.encodeImportSelection(selection, principal, { ...options, secret: "short" })).toThrow("SERVICE_UNAVAILABLE");
	expect(() => selections.decodeImportSelection("a.a", principal, selection, { ...options, secret: "short" })).toThrow("SERVICE_UNAVAILABLE");
});
test("large selections remain subject to the encoded token size bound", () => {
	const clipIds = Array.from({ length: 500 }, (_, n) => `Clip${n}`.padEnd(200, "x"));
	expect(() => selections.encodeImportSelection({ ...selection, clipIds }, principal, options)).toThrow("INVALID_INPUT");
});
