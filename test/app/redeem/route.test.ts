/** @jest-environment node */
export {};

const cookiesMock = jest.fn();

jest.mock("next/headers", () => ({
	cookies: (...args: unknown[]) => cookiesMock(...args),
}));

describe("app/redeem/route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		cookiesMock.mockResolvedValue({
			set: jest.fn(),
		});
	});

	it("sets offer cookie and campaign utm when code is present", async () => {
		const cookieStore = { set: jest.fn() };
		cookiesMock.mockResolvedValue(cookieStore);
		const request = {
			nextUrl: new URL("https://clipify.us/redeem?code=EARLYCLIPPY&redirect=/login&campaign=launch_offer"),
		};
		const { GET } = await import("@/app/redeem/route");

		const response = await GET(request as never);

		expect(cookieStore.set).toHaveBeenCalledWith(
			"offer",
			"EARLYCLIPPY",
			expect.objectContaining({
				httpOnly: true,
				sameSite: "lax",
			}),
		);
		expect(response.headers.get("location")).toContain("utm_campaign=launch_offer");
		expect(response.headers.get("location")).toContain("utm_source=offer_redeem");
	});

	it("falls back to offer code for utm_campaign when campaign is missing", async () => {
		const request = {
			nextUrl: new URL("https://clipify.us/redeem?code=SPRING2026&redirect=/login"),
		};
		const { GET } = await import("@/app/redeem/route");

		const response = await GET(request as never);
		expect(response.headers.get("location")).toContain("utm_campaign=SPRING2026");
	});
});
