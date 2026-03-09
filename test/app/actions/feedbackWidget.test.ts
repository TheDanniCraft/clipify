/** @jest-environment node */
export {};

const validateAuth = jest.fn();
const tryRateLimit = jest.fn();
const axiosPost = jest.fn();
const axiosIsAxiosError = jest.fn();

jest.mock("@actions/auth", () => ({
	validateAuth: (...args: unknown[]) => validateAuth(...args),
}));

jest.mock("@actions/rateLimit", () => ({
	tryRateLimit: (...args: unknown[]) => tryRateLimit(...args),
}));

jest.mock("axios", () => ({
	__esModule: true,
	default: {
		post: (...args: unknown[]) => axiosPost(...args),
		isAxiosError: (...args: unknown[]) => axiosIsAxiosError(...args),
	},
}));

async function loadFeedbackWidget() {
	jest.resetModules();
	return import("@/app/actions/feedbackWidget");
}

describe("actions/feedbackWidget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.FIDER_BASE_URL = "https://feedback.clipify.us";
		process.env.FIDER_API_KEY = "fider-key";
		validateAuth.mockResolvedValue({
			id: "user-1",
			username: "alice",
			email: "alice@example.com",
		});
		tryRateLimit.mockResolvedValue({ success: true });
		axiosIsAxiosError.mockReturnValue(false);
	});

	it("rejects submissions when required env vars are missing", async () => {
		delete process.env.FIDER_BASE_URL;
		const { submitFeedback } = await loadFeedbackWidget();
		await expect(
			submitFeedback({
				type: "bug",
				feedback: { title: "Broken flow" },
			}),
		).rejects.toThrow("FIDER_BASE_URL not set");
	});

	it("rejects unauthenticated and rate-limited submissions", async () => {
		validateAuth.mockResolvedValueOnce(false);
		const { submitFeedback } = await loadFeedbackWidget();
		await expect(
			submitFeedback({
				type: "feature",
				feedback: { title: "Need dark mode" },
			}),
		).rejects.toThrow("Unauthenticated");

		validateAuth.mockResolvedValueOnce({
			id: "user-1",
			username: "alice",
			email: "alice@example.com",
		});
		tryRateLimit.mockResolvedValueOnce({ success: false });
		await expect(
			submitFeedback({
				type: "feature",
				feedback: { title: "Need dark mode" },
			}),
		).rejects.toEqual(expect.objectContaining({ name: "RateLimitError" }));
	});

	it("creates feedback posts and applies both feedback + rating tags", async () => {
		axiosPost
			.mockResolvedValueOnce({
				data: {
					id: 9,
					name: "alice",
					email: "alice@example.com",
					externalId: "user-1",
				},
			})
			.mockResolvedValueOnce({
				data: {
					id: 42,
					number: 123,
					title: "UI polish",
					slug: "ui-polish",
					html_url: "",
				},
			})
			.mockResolvedValueOnce({ data: {} })
			.mockResolvedValueOnce({ data: {} });

		const { submitFeedback } = await loadFeedbackWidget();
		const result = await submitFeedback({
			type: "feedback",
			feedback: {
				title: "UI polish",
				comment: "Great update",
				rating: "excellent" as never,
			},
		});

		expect(result).toEqual(
			expect.objectContaining({
				id: 42,
				slug: "ui-polish",
				html_url: "https://feedback.clipify.us/posts/42/ui-polish",
			}),
		);
		expect(axiosPost).toHaveBeenCalledWith(
			"https://feedback.clipify.us/api/v1/posts/42/tags/feedback",
			{},
			expect.any(Object),
		);
		expect(axiosPost).toHaveBeenCalledWith(
			"https://feedback.clipify.us/api/v1/posts/42/tags/excellent",
			{},
			expect.any(Object),
		);
	});

	it("maps feedback service errors to stable error messages", async () => {
		axiosPost.mockRejectedValueOnce(new Error("upstream failed"));
		const { submitFeedback } = await loadFeedbackWidget();
		await expect(
			submitFeedback({
				type: "bug",
				feedback: { title: "Crash on save", comment: "boom" },
			}),
		).rejects.toThrow("Failed to create user");
	});
});
