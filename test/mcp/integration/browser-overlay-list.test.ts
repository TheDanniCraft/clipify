/** @jest-environment node */
import { runMcpProbe } from "../../support/mcp/probe";

describe("browser overlay list uses current backend read authority", () => {
	test("owner retains the existing browser record and secret contract", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-list-owner"]);
		expect(result.listObservation).toEqual({ available: true, count: 1, ownerIds: ["creator"], ownerSecretPresent: true });
	});
	test.each(["removed", "read-denied", "read-only"])("%s authority cannot list overlay contents with a retained session", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [`overlay-list-${mode}`]);
		expect(result.listObservation).toEqual({ available: false, count: 0, ownerIds: [], ownerSecretPresent: false });
	});
});

describe("browser overlay lookup preserves current secret-read authority", () => {
	test("owner lookup keeps existing browser secret and revision", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-get-owner"]);
		expect(result.listObservation).toEqual({ available: true, count: 1, ownerIds: ["creator"], ownerSecretPresent: true });
	});
	test.each(["removed", "read-denied", "read-only"])("%s lookup never returns owner secrets", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [`overlay-get-${mode}`]);
		expect(result.listObservation).toEqual({ available: false, count: 0, ownerIds: [], ownerSecretPresent: false });
	});
});

describe("delegated browser lists respect the existing secret-read boundary", () => {
	test("operations editor keeps allowed creator records", () => {
		const result = runMcpProbe("browser-playlist-delete-probe", ["overlay-editor-allowed"]);
		expect(result.listObservation).toEqual({ available: true, count: 1, ownerIds: ["creator"], ownerSecretPresent: true });
	});
	test.each(["removed", "read-only"])("%s editor receives no saved credentials", (mode) => {
		const result = runMcpProbe("browser-playlist-delete-probe", [`overlay-editor-${mode}`]);
		expect(result.listObservation).toEqual({ available: true, count: 0, ownerIds: [], ownerSecretPresent: false });
	});
});
