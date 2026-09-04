/** @jest-environment node */

import fs from "fs/promises";
import path from "path";
import { GET } from "@/app/llms-full.txt/route";

jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
}));

describe("app/llms-full.txt route", () => {
	it("returns the rendered plain-text reference", async () => {
		(fs.readFile as jest.Mock).mockResolvedValue("Badges\n{{BADGE_CATALOG}}\nPlans\n{{PLAN_COMPARISON}}");

		const response = await GET();
		const text = await response.text();

		expect(fs.readFile).toHaveBeenCalledWith(path.join(process.cwd(), "src", "app", "llms-full.txt", "llms-full.txt"), "utf-8");
		expect(response.headers.get("Content-Type")).toBe("text/plain");
		expect(text).toContain("**Founder**");
		expect(text).toContain("### Clips and playback");
		expect(text).not.toContain("{{BADGE_CATALOG}}");
		expect(text).not.toContain("{{PLAN_COMPARISON}}");
	});

	it("surfaces read errors", async () => {
		(fs.readFile as jest.Mock).mockRejectedValue(new Error("disk failure"));
		await expect(GET()).rejects.toThrow("disk failure");
	});
});
