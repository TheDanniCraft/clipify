/** @jest-environment node */
jest.mock("@better-auth/oauth-provider", () => ({ verifyOAuthQueryParams: jest.fn(async () => true) }));
jest.mock("@/app/auth/mcp/consent/ConsentForm", () => ({ ConsentForm: jest.fn(() => null) }));
jest.mock("server-only", () => ({}));
jest.mock("next/headers", () => ({ headers: jest.fn(async () => new Headers({ origin: "http://localhost:3000" })) }));
jest.mock("next/navigation", () => ({
	redirect: jest.fn((url) => {
		throw new Error(`REDIRECT:${url}`);
	}),
}));
jest.mock("@/auth/config", () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock("@/auth/authorize-operation", () => ({ listAuthorizedCreatorOperations: jest.fn() }));
jest.mock("@/server/mcp/grants", () => ({ approveMcpConsent: jest.fn() }));
jest.mock("@/db/client", () => ({ db: { select: jest.fn() } }));
jest.mock("@/db/auth-schema", () => ({ oauthClient: { clientId: "id", name: "name" } }));
import { auth } from "@/auth/config";
import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import { listAuthorizedCreatorOperations } from "@/auth/authorize-operation";
import { db } from "@/db/client";
import { approveMcpConsent } from "@/server/mcp/grants";
let Page: any;
try {
	Page = require("@/app/auth/mcp/consent/page").default;
} catch {}
const query = { client_id: "client", scope: "creator:read overlay:delete", sig: "signed", redirect_uri: "https://client.example/callback" };
describe("TDD-US1-027 consent route", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(verifyOAuthQueryParams as jest.Mock).mockResolvedValue(true);
		process.env.BETTER_AUTH_SECRET = "isolated-consent-page-secret-32chars";
		(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: "actor" }, session: { activeOrganizationId: null } });
		(listAuthorizedCreatorOperations as jest.Mock).mockResolvedValue([{ creator: { id: "creator", username: "Creator" }, accessPath: "owner" }]);
		(db.select as jest.Mock).mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ name: "My AI" }] }) }) });
	});
	test("renders only currently authorized creators and actual requested permissions", async () => {
		expect(Page).toEqual(expect.any(Function));
		const result = await Page({ searchParams: Promise.resolve(query) });
		expect(result.props).toMatchObject({ clientName: "My AI", requestedScopes: ["creator:read", "overlay:delete"], creators: [{ creatorId: "creator", name: "Creator", agencyOrganizationId: null }] });
		expect(new URLSearchParams(result.props.oauthQuery).get("sig")).toBe("signed");
	});
	test("requires a login and preserves the signed authorization return path", async () => {
		expect(Page).toEqual(expect.any(Function));
		(auth.api.getSession as unknown as jest.Mock).mockResolvedValue(null);
		await expect(Page({ searchParams: Promise.resolve(query) })).rejects.toThrow("REDIRECT:/login?returnUrl=");
	});
	test("malformed state cannot reach the consent form", async () => {
		expect(Page).toEqual(expect.any(Function));
		const result = await Page({ searchParams: Promise.resolve({ client_id: "client" }) });
		expect(result.props.role).toBe("alert");
	});
});

describe("consent server action forwards only validated choices", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(verifyOAuthQueryParams as jest.Mock).mockResolvedValue(true);
		process.env.BETTER_AUTH_SECRET = "isolated-consent-page-secret-32chars";
		(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: "actor" }, session: { activeOrganizationId: "agency-context" } });
		(listAuthorizedCreatorOperations as jest.Mock).mockResolvedValue([{ creator: { id: "creator", username: "Creator" }, accessPath: "agency" }]);
		(db.select as jest.Mock).mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [] }) }) });
		(approveMcpConsent as jest.Mock).mockResolvedValue(Response.json({ url: "https://client.example/callback?code=fixture" }));
	});
	test("unavailable client name falls back while preserving active agency context", async () => {
		const page = await Page({ searchParams: Promise.resolve({ ...query, unused: undefined }) });
		expect(page.props).toMatchObject({ clientName: "this app", creators: [{ creatorId: "creator", name: "Creator", agencyOrganizationId: "agency-context" }] });
	});
	test.each(["not-json", JSON.stringify({ creatorId: "creator", agencyOrganizationId: null, forged: true })])("malformed selection %s never reaches consent storage", async (choice) => {
		const page = await Page({ searchParams: Promise.resolve(query) });
		const data = new FormData();
		data.set("accept", "true");
		data.append("creators", choice);
		await expect(page.props.action(data)).resolves.toEqual({ error: "Choose valid creators and try again." });
		expect(approveMcpConsent).not.toHaveBeenCalled();
	});
	test("approved choices and scopes reach the provider with current headers", async () => {
		const page = await Page({ searchParams: Promise.resolve(query) });
		const data = new FormData();
		data.set("accept", "true");
		data.append("creators", JSON.stringify({ creatorId: "creator", agencyOrganizationId: "agency-context", scopes: ["creator:read"] }));
		data.append("scopes", "creator:read");
		await expect(page.props.action(data)).resolves.toMatchObject({ callbackUrl: "https://client.example/callback?code=fixture", authorized: data.get("accept") === "true" });
		expect(approveMcpConsent).toHaveBeenCalledWith(expect.objectContaining({ accept: true, scopes: ["creator:read"], creators: [{ creatorId: "creator", agencyOrganizationId: "agency-context", scopes: ["creator:read"] }] }));
		expect((approveMcpConsent as jest.Mock).mock.calls[0][0].headers.get("content-type")).toBe("application/json");
	});
	test("denial ignores malformed creator selections and delegates provider callback validation", async () => {
		const page = await Page({ searchParams: Promise.resolve(query) });
		const data = new FormData();
		data.append("creators", "malformed-choice");
		await expect(page.props.action(data)).resolves.toMatchObject({ callbackUrl: "https://client.example/callback?code=fixture", authorized: data.get("accept") === "true" });
		expect(approveMcpConsent).toHaveBeenCalledWith(expect.objectContaining({ accept: false, creators: [] }));
	});
	test.each([() => Response.json({ url: "https://client.example/callback" }, { status: 400 }), () => Response.json({}), () => new Response("not-json")])("failed approval yields safe feedback without redirect", async (response) => {
		(approveMcpConsent as jest.Mock).mockResolvedValue(response());
		const page = await Page({ searchParams: Promise.resolve(query) });
		await expect(page.props.action(new FormData())).resolves.toEqual({ error: "The connection could not be approved. Restart the connection from your app." });
	});
});

describe("TDD-US1-032 provider signed query compatibility", () => {
	beforeEach(() => {
		(auth.api.getSession as unknown as jest.Mock).mockResolvedValue({ user: { id: "actor" }, session: { activeOrganizationId: null } });
		(listAuthorizedCreatorOperations as jest.Mock).mockResolvedValue([{ creator: { id: "creator", username: "Creator" }, accessPath: "owner" }]);
		(db.select as jest.Mock).mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ name: "My AI" }] }) }) });
	});
	test("preserves repeated provider ba_param state and renders consent", async () => {
		const result = await Page({ searchParams: Promise.resolve({ ...query, ba_param: ["client_id", "scope", "ba_param"], ba_iat: "123", ba_pl: "provider-proof" }) });
		expect(result.props.clientName).toBe("My AI");
		expect(new URLSearchParams(result.props.oauthQuery).getAll("ba_param")).toEqual(["client_id", "scope", "ba_param"]);
	});
	test.each(["client_id", "scope", "sig", "redirect_uri"])("continues rejecting duplicate %s", async (key) => {
		const result = await Page({ searchParams: Promise.resolve({ ...query, [key]: [query[key as keyof typeof query], "other"] }) });
		expect(result.props.role).toBe("alert");
	});
});

describe("TDD-CONSENT-NATIVE-QUERY-001 native query verification before consent rendering", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.BETTER_AUTH_SECRET = "isolated-consent-page-secret-32chars";
		(verifyOAuthQueryParams as jest.Mock).mockResolvedValue(false);
	});
	test("invalid native signature cannot reach session or creator lookup", async () => {
		const result = await Page({ searchParams: Promise.resolve(query) });
		expect(result.props.role).toBe("alert");
		expect(verifyOAuthQueryParams).toHaveBeenCalledWith(new URLSearchParams(query).toString(), process.env.BETTER_AUTH_SECRET);
		expect(auth.api.getSession).not.toHaveBeenCalled();
		expect(listAuthorizedCreatorOperations).not.toHaveBeenCalled();
		expect(db.select).not.toHaveBeenCalled();
	});
	test("missing server secret cannot render consent", async () => {
		delete process.env.BETTER_AUTH_SECRET;
		const result = await Page({ searchParams: Promise.resolve(query) });
		expect(result.props.role).toBe("alert");
		expect(auth.api.getSession).not.toHaveBeenCalled();
	});
});
