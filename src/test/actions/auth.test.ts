import * as auth from "@actions/auth";
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { Plan, Role } from "@types";

const mockCookies = jest.requireMock("next/headers").cookies;
const mockGetBaseUrl = jest.requireMock("@actions/utils").getBaseUrl;
const mockGetUser = jest.requireMock("@actions/database").getUser;
const mockVerifyToken = jest.requireMock("@actions/twitch").verifyToken;

jest.mock("next/headers", () => ({
	cookies: jest.fn(),
}));
jest.mock("@actions/utils", () => ({
	getBaseUrl: jest.fn(),
}));
jest.mock("jsonwebtoken");
jest.mock("@actions/database", () => ({
	getUser: jest.fn(),
}));
jest.mock("@actions/twitch", () => ({
	verifyToken: jest.fn(),
}));

describe("auth.ts", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.JWT_SECRET = "testsecret";
	});

	describe("getCookie", () => {
		it("returns cookie value if present", async () => {
			mockCookies.mockResolvedValue({
				get: (name: string) => (name === "token" ? { value: "cookieval" } : undefined),
			});
			const value = await auth.getCookie("token");
			expect(value).toBe("cookieval");
		});

		it("returns null if cookie not present", async () => {
			mockCookies.mockResolvedValue({
				get: () => undefined,
			});
			const value = await auth.getCookie("token");
			expect(value).toBeNull();
		});
	});

	describe("getUserFromCookie", () => {
		it("returns decoded user if jwt valid", async () => {
			(jwt.verify as jest.Mock).mockImplementation(() => ({ id: "user1", name: "Test" }));
			const user = await auth.getUserFromCookie("validtoken");
			expect(user).toEqual({ id: "user1", name: "Test" });
		});

		it("returns undefined if jwt invalid", async () => {
			(jwt.verify as jest.Mock).mockImplementation(() => {
				throw new Error("bad token");
			});
			const user = await auth.getUserFromCookie("badtoken");
			expect(user).toBeUndefined();
		});
	});

	describe("authUser", () => {
		it("redirects to /login with no error", async () => {
			mockGetBaseUrl.mockResolvedValue(new URL("http://localhost:3000/"));
			const resp = await auth.authUser();
			expect(resp).toEqual(NextResponse.redirect(new URL("http://localhost:3000/login")));
		});

		it("redirects to /login with error params", async () => {
			mockGetBaseUrl.mockResolvedValue(new URL("http://localhost:3000/"));
			const resp = await auth.authUser("bad", "401");
			const url = new URL("http://localhost:3000/login");
			url.searchParams.set("error", "bad");
			url.searchParams.set("errorCode", "401");
			expect(resp).toEqual(NextResponse.redirect(url));
		});

		it("redirects to /login with error param and empty errorCode if errorCode is undefined", async () => {
			mockGetBaseUrl.mockResolvedValue(new URL("http://localhost:3000/"));
			const resp = await auth.authUser("bad");
			const url = new URL("http://localhost:3000/login");
			url.searchParams.set("error", "bad");
			url.searchParams.set("errorCode", "");
			expect(resp).toEqual(NextResponse.redirect(url));
		});
	});

	describe("validateAuth", () => {
		it("returns false if no token cookie", async () => {
			mockCookies.mockResolvedValue({ get: () => undefined });
			const result = await auth.validateAuth();
			expect(result).toBe(false);
		});

		it("returns false wenn jwt.verify Fehler wirft", async () => {
			mockCookies.mockResolvedValue({ get: () => ({ value: "tokenval" }) });
			(jwt.verify as jest.Mock).mockImplementation(() => {
				throw new Error("bad token");
			});
			const result = await auth.validateAuth();
			expect(result).toBe(false);
		});

		it("returns user from cookie if skipUserCheck is true", async () => {
			mockCookies.mockResolvedValue({ get: () => ({ value: "tokenval" }) });
			(jwt.verify as jest.Mock).mockImplementation(() => ({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			}));
			const result = await auth.validateAuth(true);
			expect(result).toEqual({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			});
		});

		it("returns false if getUser returns null", async () => {
			mockCookies.mockResolvedValue({ get: () => ({ value: "tokenval" }) });
			(jwt.verify as jest.Mock).mockImplementation(() => ({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			}));
			mockGetUser.mockResolvedValue(null);
			const result = await auth.validateAuth();
			expect(result).toBe(false);
		});

		it("returns false if verifyToken returns false", async () => {
			mockCookies.mockResolvedValue({ get: () => ({ value: "tokenval" }) });
			(jwt.verify as jest.Mock).mockImplementation(() => ({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			}));
			mockGetUser.mockResolvedValue({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			});
			mockVerifyToken.mockResolvedValue(false);
			const result = await auth.validateAuth();
			expect(result).toBe(false);
		});

		it("returns user if all checks pass", async () => {
			mockCookies.mockResolvedValue({ get: () => ({ value: "tokenval" }) });
			(jwt.verify as jest.Mock).mockImplementation(() => ({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			}));
			mockGetUser.mockResolvedValue({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			});
			mockVerifyToken.mockResolvedValue(true);
			const result = await auth.validateAuth();
			expect(result).toEqual({
				id: "user1",
				email: "test@example.com",
				username: "testuser",
				avatar: "avatar.png",
				role: Role.User,
				plan: Plan.Free,
				stripeCustomerId: null,
			});
		});
	});
});
