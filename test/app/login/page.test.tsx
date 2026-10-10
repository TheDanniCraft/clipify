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

	it.each(["//example.com", "/\\example.com", "/\t/example.com"])("rejects an external return URL %p", async (returnUrl) => {
		const LoginPage = (await import("@/app/login/page")).default;

		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl }) })).rejects.toThrow("NEXT_REDIRECT");

		expect(redirect).toHaveBeenCalledWith("/dashboard");
	});
});

const oauthParameters = { client_id: "https://chatgpt.com/oauth/client.json", state: "relay-state", sig: "signed", ba_param: ["client_id", "state", "ba_param"], prompt: "login" };
describe("native MCP login continuation", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		readCheckoutIntent.mockResolvedValue({ products: [{ product: "pro", billingCycle: "monthly" }] });
		redirect.mockImplementation(() => {
			throw new Error("NEXT_REDIRECT");
		});
	});
	it.each([null, { session: { id: "session-1" } }])("lets Better Auth resume authorization after login even with session %p", async (session) => {
		getAuthSession.mockResolvedValue(session);
		validateAuth.mockResolvedValue(session ? { id: "creator-1" } : null);
		const LoginPage = (await import("@/app/login/page")).default;
		renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(oauthParameters) }));
		expect(loginClient).toHaveBeenCalledWith({ returnUrl: "", oauthAuthorization: true });
		expect(redirect).not.toHaveBeenCalled();
	});
	it.each([undefined, "/dashboard", "//external.example"])("retains checkout priority for ordinary destination %s", async (returnUrl) => {
		getAuthSession.mockResolvedValue({ session: { id: "session-1" } });
		validateAuth.mockResolvedValue({ id: "creator-1" });
		const LoginPage = (await import("@/app/login/page")).default;
		await expect(LoginPage({ searchParams: Promise.resolve({ returnUrl }) })).rejects.toThrow("NEXT_REDIRECT");
		expect(redirect).toHaveBeenCalledWith("/checkout/continue");
	});
});
