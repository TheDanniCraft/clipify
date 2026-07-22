import { previewPrIdFromHost } from "../runnerArtifacts";

describe("preview Runner host parsing", () => {
	it("accepts only the canonical beta PR host", () => {
		expect(previewPrIdFromHost("beta-326.clipify.cloud.thedannicraft.de")).toBe(326);
		expect(previewPrIdFromHost("BETA-326.CLIPIFY.CLOUD.THEDANNICRAFT.DE.")).toBe(326);
	});

	it("rejects manipulated and invalid hosts", () => {
		expect(previewPrIdFromHost("beta-0.clipify.cloud.thedannicraft.de")).toBeUndefined();
		expect(previewPrIdFromHost("beta-326.clipify.cloud.thedannicraft.de.evil.example")).toBeUndefined();
		expect(previewPrIdFromHost("evil.example")).toBeUndefined();
		expect(previewPrIdFromHost("beta--1.clipify.cloud.thedannicraft.de")).toBeUndefined();
	});
});
