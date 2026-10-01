export type PasskeyState = "available" | "unavailable" | "removed" | "replayed" | "counter_regressed" | "failing";

export interface PasskeyFixture {
	id: string;
	userId: string;
	publicKey: Uint8Array;
	counter: number;
	state: PasskeyState;
	transports: ("ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb")[];
}

export function passkeyFixture(state: PasskeyState = "available", overrides: Partial<PasskeyFixture> = {}): PasskeyFixture {
	return {
		id: `passkey-${state}`,
		userId: "auth-user-0001",
		publicKey: new Uint8Array([1, 2, 3, 4]),
		counter: state === "counter_regressed" ? 1 : 2,
		state,
		transports: ["internal"],
		...overrides,
	};
}

export const passkeyFixtures = {
	available: passkeyFixture("available"),
	unavailable: passkeyFixture("unavailable"),
	removed: passkeyFixture("removed"),
	replayed: passkeyFixture("replayed"),
	counterRegressed: passkeyFixture("counter_regressed"),
	failing: passkeyFixture("failing"),
};
