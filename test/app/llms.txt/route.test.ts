/** @jest-environment node */

import fs from "fs/promises";
import path from "path";
import { GET } from "@/app/llms.txt/route";

jest.mock("fs/promises", () => ({
	readFile: jest.fn(),
}));

describe("app/llms.txt route", () => {
	it("returns plain-text response content", async () => {
		(fs.readFile as jest.Mock).mockResolvedValue("model instructions");

		const res = await GET();
		const text = await res.text();

		expect(fs.readFile).toHaveBeenCalledWith(path.join(process.cwd(), "src", "app", "llms.txt", "llms.txt"), "utf-8");
		expect(res.headers.get("Content-Type")).toBe("text/plain");
		expect(text).toBe("model instructions");
	});

	it("surfaces read errors", async () => {
		(fs.readFile as jest.Mock).mockRejectedValue(new Error("disk failure"));
		await expect(GET()).rejects.toThrow("disk failure");
	});
});
