import { RateLimitError } from "@types";

describe("RateLimitError", () => {
	it("should set the correct name and message", () => {
		const error = new RateLimitError();
		expect(error.name).toBe("RateLimitError");
		expect(error.message).toBe("Rate limit exceeded");
		expect(error).toBeInstanceOf(Error);
	});
});
