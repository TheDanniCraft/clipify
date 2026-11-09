jest.mock("server-only", () => ({}));
jest.mock("@/auth/session", () => ({ getAuthSession: jest.fn() }));
jest.mock("@/db/client", () => ({ db: { select: jest.fn() } }));
import { getAuthSession } from "@/auth/session";
import { db } from "@/db/client";
import { getEventParticipant } from "@/server/events/participant";
it("requires a current session and a linked Twitch identity", async () => {
	jest.mocked(getAuthSession).mockResolvedValue(null);
	expect(await getEventParticipant()).toBeNull();
	jest.mocked(getAuthSession).mockResolvedValue({ session: { userId: "viewer" } } as never);
	const query = { from: () => query, where: () => query, limit: jest.fn().mockResolvedValue([]) };
	(db.select as jest.Mock).mockReturnValue(query);
	expect(await getEventParticipant()).toBeNull();
	query.limit.mockResolvedValue([{ accountId: "twitch-viewer" }] as never);
	expect(await getEventParticipant()).toEqual({ authUserId: "viewer", twitchId: "twitch-viewer" });
});
