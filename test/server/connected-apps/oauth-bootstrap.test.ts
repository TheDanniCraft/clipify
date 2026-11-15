/** @jest-environment node */
jest.mock("server-only", () => ({}));
const mockDatabaseBootstrap = jest.fn();
jest.mock("@/db/client", () => {
	mockDatabaseBootstrap();
	return { db: {} };
});
test("loading OAuth resource policy does not bootstrap the application database", () => {
	require("@/server/connected-apps/oauth-policy");
	expect(mockDatabaseBootstrap).not.toHaveBeenCalled();
});
