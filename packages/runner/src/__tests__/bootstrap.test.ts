import { extractBakedConfig } from "../bootstrap";
import fs from "fs";

jest.mock("fs");

describe("Bootstrap Config Extraction", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should extract baked config from executable when present", () => {
		const mockConfig = {
			apiBase: "https://demo.clipify.us",
			bootstrapToken: "1234-abcd",
			runnerId: "runner-999",
		};
		const configBlock = `\n\n\n___CLIPIFY_CONFIG_START____${JSON.stringify(mockConfig)}___CLIPIFY_CONFIG_END____\n\n\n`;

		const fakeBinary = Buffer.from("FAKE_BINARY_DATA" + configBlock, "utf-8");

		(fs.openSync as jest.Mock).mockReturnValue(1);
		(fs.fstatSync as jest.Mock).mockReturnValue({ size: fakeBinary.length });
		(fs.readSync as jest.Mock).mockImplementation((fd, buffer, offset, length, position) => {
			fakeBinary.copy(buffer, 0, position, position + length);
			return length;
		});

		const result = extractBakedConfig("dummy.exe");
		expect(result).toEqual(mockConfig);
	});

	it("should return null if no config is baked", () => {
		const fakeBinary = Buffer.from("JUST_A_NORMAL_BINARY_WITHOUT_CONFIG", "utf-8");

		(fs.openSync as jest.Mock).mockReturnValue(1);
		(fs.fstatSync as jest.Mock).mockReturnValue({ size: fakeBinary.length });
		(fs.readSync as jest.Mock).mockImplementation((fd, buffer, offset, length, position) => {
			fakeBinary.copy(buffer, 0, position, position + length);
			return length;
		});

		const result = extractBakedConfig("dummy.exe");
		expect(result).toBeNull();
	});
});
