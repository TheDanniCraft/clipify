/** @jest-environment node */
export {};

import { getGamesDetailsBulk } from "@/app/actions/twitch";
import axios from "axios";
import { getTwitchCacheBatch, setTwitchCacheBatch, getAccessToken } from "@actions/database";
import { TwitchCacheType } from "@types";

jest.mock("axios");
jest.mock("@actions/database");

describe("getGamesDetailsBulk", () => {
	const mockGameIds = ["123", "456"];
	const mockUserId = "user-1";
	const mockAccessToken = "mock-token";

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("should return cached games if available", async () => {
		const mockCachedGames = [
			{ id: "123", name: "Game 1" },
			{ id: "456", name: "Game 2" },
		];
		(getTwitchCacheBatch as jest.Mock).mockResolvedValue(mockCachedGames);

		const result = await getGamesDetailsBulk(mockGameIds, mockUserId);

		expect(result).toEqual(mockCachedGames);
		expect(getTwitchCacheBatch).toHaveBeenCalledWith(TwitchCacheType.Game, mockGameIds);
		expect(axios.get).not.toHaveBeenCalled();
	});

	it("should fetch missing games from Twitch and cache them", async () => {
		(getTwitchCacheBatch as jest.Mock).mockResolvedValue([null, null]);
		(getAccessToken as jest.Mock).mockResolvedValue({ accessToken: mockAccessToken });
		(axios.get as jest.Mock).mockResolvedValue({
			data: {
				data: [
					{ id: "123", name: "Game 1" },
					{ id: "456", name: "Game 2" },
				],
			},
		});

		const result = await getGamesDetailsBulk(mockGameIds, mockUserId);

		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Game 1");
		expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/helix/games"), expect.objectContaining({
			params: { id: mockGameIds }
		}));
		expect(setTwitchCacheBatch).toHaveBeenCalled();
	});

	it("should handle mixed cached and missing games", async () => {
		const mockCachedGame = { id: "123", name: "Game 1" };
		(getTwitchCacheBatch as jest.Mock).mockResolvedValue([mockCachedGame, null]);
		(getAccessToken as jest.Mock).mockResolvedValue({ accessToken: mockAccessToken });
		(axios.get as jest.Mock).mockResolvedValue({
			data: {
				data: [{ id: "456", name: "Game 2" }],
			},
		});

		const result = await getGamesDetailsBulk(mockGameIds, mockUserId);

		expect(result).toHaveLength(2);
		expect(result.find(g => g.id === "123")).toBeDefined();
		expect(result.find(g => g.id === "456")).toBeDefined();
		expect(axios.get).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
			params: { id: ["456"] }
		}));
	});

	it("should return empty array if no IDs provided", async () => {
		const result = await getGamesDetailsBulk([], mockUserId);
		expect(result).toEqual([]);
		expect(axios.get).not.toHaveBeenCalled();
	});
});
