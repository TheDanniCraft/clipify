/** @jest-environment node */
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { registerBrowserClient } from "../../support/mcp/browser-registration";
function response(status: number, retryAfter?: string) {
	return { status: () => status, headers: () => (retryAfter === undefined ? {} : { "retry-after": retryAfter }), dispose: jest.fn().mockResolvedValue(undefined) } as unknown as APIResponse;
}
test("honors Retry-After before retrying the exact registration metadata", async () => {
	const throttled = response(429, "12");
	const accepted = response(201);
	const post = jest.fn().mockResolvedValueOnce(throttled).mockResolvedValueOnce(accepted);
	const pause = jest.fn().mockResolvedValue(undefined);
	const data = { client_name: "Test client" };
	expect(await registerBrowserClient({ post } as unknown as APIRequestContext, "http://127.0.0.1:3107", data, pause)).toBe(accepted);
	expect(pause).toHaveBeenCalledWith(12000);
	expect(throttled.dispose).toHaveBeenCalled();
	expect(post).toHaveBeenCalledTimes(2);
	expect(post).toHaveBeenLastCalledWith("http://127.0.0.1:3107/api/auth/oauth2/register", { data });
});
test.each([undefined, "invalid", "0", "86400"])("does not conceal a missing or excessive registration budget: %s", async (header) => {
	const post = jest.fn().mockResolvedValue(response(429, header));
	const pause = jest.fn();
	await expect(registerBrowserClient({ post } as unknown as APIRequestContext, "http://127.0.0.1:3107", {}, pause)).rejects.toThrow();
	expect(post).toHaveBeenCalledTimes(1);
	expect(pause).not.toHaveBeenCalled();
});
test("returns a persistent denial after two bounded retries", async () => {
	const denied = response(429, "1");
	const post = jest.fn().mockResolvedValue(denied);
	const pause = jest.fn().mockResolvedValue(undefined);
	expect(await registerBrowserClient({ post } as unknown as APIRequestContext, "http://127.0.0.1:3107", {}, pause)).toBe(denied);
	expect(post).toHaveBeenCalledTimes(3);
	expect(pause).toHaveBeenCalledTimes(2);
});
test("does not retry invalid client metadata", async () => {
	const denied = response(400);
	const post = jest.fn().mockResolvedValue(denied);
	const pause = jest.fn();
	expect(await registerBrowserClient({ post } as unknown as APIRequestContext, "http://127.0.0.1:3107", {}, pause)).toBe(denied);
	expect(post).toHaveBeenCalledTimes(1);
	expect(pause).not.toHaveBeenCalled();
});
