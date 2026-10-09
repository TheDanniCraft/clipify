import { renderToStaticMarkup } from "react-dom/server";
const redirect = jest.fn();
const validateAuth = jest.fn();
const getAuthSession = jest.fn();
const readCheckoutIntent = jest.fn();
const loginClient = jest.fn((_props: unknown) => null);

jest.mock("next/navigation", () => ({ redirect: (...args: unknown[]) => redirect(...args) }));
jest.mock("@actions/auth", () => ({ validateAuth: (...args: unknown[]) => validateAuth(...args) }));
jest.mock("@/auth/session", () => ({ getAuthSession: (...args: unknown[]) => getAuthSession(...args) }));
jest.mock("@/server/checkoutIntent", () => ({ readCheckoutIntent: (...args: unknown[]) => readCheckoutIntent(...args) }));
jest.mock("@/app/login/LoginClient", () => ({ __esModule: true, default: (props: unknown) => loginClient(props) }));

describe("app/login/page", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		redirect.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});
		readCheckoutIntent.mockResolvedValue(null);
		validateAuth.mockResolvedValue({ id: "creator-1" });
		getAuthSession.mockResolvedValue({ session: { id: "session-1" } });
	});

	it("honors a safe return URL for an already authenticated user", async () => {
		const LoginPage = (await import("@/app/login/page")).default;

		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl: "/dashboard/agency" }) })).rejects.toThrow("NEXT_REDIRECT");

		expect(redirect).toHaveBeenCalledWith("/dashboard/agency");
	});

	it("rejects a protocol-relative return URL", async () => {
		const LoginPage = (await import("@/app/login/page")).default;

		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl: "//example.com" }) })).rejects.toThrow("NEXT_REDIRECT");

		expect(redirect).toHaveBeenCalledWith("/dashboard");
	});
});

const mcpReturnUrl = "/auth/mcp/consent?client_id=client&scope=creator%3Aread+overlay%3Awrite&state=state&sig=signed&ba_param=one&ba_param=two";
describe("MCP login with an existing checkout intent", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		readCheckoutIntent.mockResolvedValue({ products: [{ product: "pro", billingCycle: "monthly" }] });
		redirect.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});
	});
	it("returns an authenticated user to the complete MCP request instead of checkout", async () => {
		getAuthSession.mockResolvedValue({ session: { id: "session-1" } });
		validateAuth.mockResolvedValue({ id: "creator-1" });
		const LoginPage = (await import("@/app/login/page")).default;
		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl: mcpReturnUrl }) })).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith(mcpReturnUrl);
	});
	it("preserves the MCP destination when a new user needs Twitch sign-in", async () => {
		getAuthSession.mockResolvedValue(null);
		validateAuth.mockResolvedValue(null);
		const LoginPage = (await import("@/app/login/page")).default;
		renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({ returnUrl: mcpReturnUrl }) }));
		expect(loginClient).toHaveBeenCalledWith({ returnUrl: mcpReturnUrl });
		expect(redirect).not.toHaveBeenCalled();
	});
	it.each([undefined, "/dashboard", "//external.example", "/auth/mcp/consent-unrelated"])("retains checkout priority for non-MCP destination %s", async (returnUrl) => {
		getAuthSession.mockResolvedValue({ session: { id: "session-1" } });
		validateAuth.mockResolvedValue({ id: "creator-1" });
		const LoginPage = (await import("@/app/login/page")).default;
		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl }) })).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/checkout/continue");
	});
});
