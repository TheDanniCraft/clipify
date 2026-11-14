/** @jest-environment node */
const validateAuth = jest.fn(),
	generateCheckout = jest.fn(),
	readCheckoutIntent = jest.fn(),
	clearCheckoutIntent = jest.fn();
jest.mock("@actions/auth", () => ({ validateAuth: () => validateAuth() }));
jest.mock("@actions/subscription", () => ({ generateCheckout: (...args: unknown[]) => generateCheckout(...args) }));
jest.mock("@actions/utils", () => ({ getBaseUrl: async () => "https://clipify.us" }));
jest.mock("@/server/checkoutIntent", () => ({ readCheckoutIntent: () => readCheckoutIntent(), clearCheckoutIntent: () => clearCheckoutIntent() }));
jest.mock("@lib/sentryServer", () => ({ captureUnexpectedError: jest.fn() }));
import { GET } from "@/app/checkout/continue/route";
const intent = { products: [{ product: "pro", billingCycle: "monthly" }], source: "pricing_page", nonce: "retry-nonce" };
beforeEach(() => {
	jest.clearAllMocks();
	validateAuth.mockResolvedValue({ id: "creator" });
	readCheckoutIntent.mockResolvedValue(intent);
});
test("keeps the same selection and idempotency key after a transient failure", async () => {
	generateCheckout.mockRejectedValueOnce(new Error("provider unavailable")).mockResolvedValue("https://checkout.stripe.com/example");
	expect((await GET()).headers.get("location")).toBe("https://clipify.us/pricing?checkout=unavailable");
	expect(clearCheckoutIntent).not.toHaveBeenCalled();
	expect((await GET()).headers.get("location")).toBe("https://checkout.stripe.com/example");
	expect(generateCheckout.mock.calls[0]).toEqual(generateCheckout.mock.calls[1]);
	expect(generateCheckout).toHaveBeenCalledWith(intent.products, "yearly", undefined, undefined, "pricing_page", expect.objectContaining({ idempotencyKey: "checkout-intent:creator:retry-nonce" }));
});
test("handles typed unavailability and an already-owned plan locally", async () => {
	generateCheckout.mockResolvedValueOnce({ success: false, code: "INVALID_PRODUCT" });
	expect((await GET()).headers.get("location")).toContain("checkout=unavailable");
	expect(clearCheckoutIntent).not.toHaveBeenCalled();
	generateCheckout.mockRejectedValueOnce(new Error("You already own every selected product"));
	expect((await GET()).headers.get("location")).toContain("billing=already-owned");
	expect(clearCheckoutIntent).toHaveBeenCalledTimes(1);
});
test("requires authentication before reading or creating checkout", async () => {
	validateAuth.mockResolvedValue(null);
	expect((await GET()).headers.get("location")).toBe("https://clipify.us/login");
	expect(readCheckoutIntent).not.toHaveBeenCalled();
	expect(generateCheckout).not.toHaveBeenCalled();
});

test("returns an expired session to login without discarding its selection", async () => {
	generateCheckout.mockRejectedValue(new Error("Unauthorized"));
	expect((await GET()).headers.get("location")).toBe("https://clipify.us/login");
	expect(clearCheckoutIntent).not.toHaveBeenCalled();
});

test("clears an invalid selection without attempting payment", async () => {
	readCheckoutIntent.mockResolvedValue(null);
	expect((await GET()).headers.get("location")).toBe("https://clipify.us/pricing?checkout=unavailable");
	expect(clearCheckoutIntent).toHaveBeenCalledTimes(1);
	expect(generateCheckout).not.toHaveBeenCalled();
});
