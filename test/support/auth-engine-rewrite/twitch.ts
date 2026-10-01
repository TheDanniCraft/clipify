import { FixtureBuilder } from "./database";

export const REQUIRED_TWITCH_SCOPES = ["openid", "user:read:email"] as const;

export interface TwitchAuthFixture {
	subject: string;
	username: string;
	email: string;
	emailVerified: boolean;
	accessToken: string;
	refreshToken: string;
	scopes: string[];
	expiresAt: Date;
	revoked: boolean;
	rotation: number;
}

const baseTwitchFixture: TwitchAuthFixture = {
	subject: "twitch-subject-0001",
	username: "fixture_creator_0001",
	email: "creator-0001@example.invalid",
	emailVerified: true,
	accessToken: "test-access-token-0001",
	refreshToken: "test-refresh-token-0001",
	scopes: [...REQUIRED_TWITCH_SCOPES],
	expiresAt: new Date("2026-09-27T13:00:00.000Z"),
	revoked: false,
	rotation: 0,
};

export function twitchFixture(overrides: Partial<TwitchAuthFixture> = {}): TwitchAuthFixture {
	return new FixtureBuilder(baseTwitchFixture).with(overrides).build();
}

export const twitchFailureFixtures = {
	declined: { code: "access_denied", description: "The user declined consent" },
	expiredState: { code: "invalid_state", description: "The OAuth state expired" },
	insufficientScopes: twitchFixture({ scopes: ["openid"] }),
	unverifiedEmail: twitchFixture({ emailVerified: false }),
	expiredCredential: twitchFixture({ expiresAt: new Date("2026-09-27T11:59:59.000Z") }),
	revokedCredential: twitchFixture({ revoked: true }),
} as const;

export function rotateTwitchFixture(current: TwitchAuthFixture): TwitchAuthFixture {
	const rotation = current.rotation + 1;
	return twitchFixture({
		...current,
		accessToken: `test-access-token-${String(rotation + 1).padStart(4, "0")}`,
		refreshToken: `test-refresh-token-${String(rotation + 1).padStart(4, "0")}`,
		rotation,
		revoked: false,
	});
}
