/** @jest-environment node */
import { GET } from "@/app/api/dashboard/presence/route";
const presence = jest.fn();
jest.mock("@actions/dashboardPresence", () => ({ getOwnTwitchPresence: () => presence() }));
it.each([true, false, null])("returns only private own-channel presence %s", async (live) => {
	presence.mockResolvedValue(live);
	const response = await GET();
	expect(response.headers.get("cache-control")).toBe("private, no-store");
	expect(await response.json()).toEqual({ live });
});
