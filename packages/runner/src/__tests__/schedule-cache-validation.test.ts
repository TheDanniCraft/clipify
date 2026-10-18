jest.mock("@napi-rs/keyring", () => ({
	Entry: class {
		setPassword() {
			throw new Error("FIXTURE_KEYRING_UNAVAILABLE");
		}
		getPassword() {
			return null;
		}
	},
}));
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RunnerScheduleCache } from "../schedule-cache";
import { scheduleAuthorizationFixture } from "../../test/support/schedule-fixture";

type CacheValidationInput = { bundle?: Record<string, unknown>; entries: { job: Record<string, unknown> & { lease: { payload: string }; destinations: Record<string, unknown>[] } }[] };

const malformedInputs: [string, (value: CacheValidationInput) => unknown][] = [
	["missing response", () => null],
	[
		"missing bundle",
		(value) => {
			delete value.bundle;
			return value;
		},
	],
	["non-array entries", (value) => ({ ...value, entries: {} })],
	["unreadable claims", (value) => ({ ...value, bundle: { ...value.bundle, payload: "broken" } })],
	["invalid manifest signature", (value) => ({ ...value, bundle: { ...value.bundle, signature: "a".repeat(86) } })],
	["missing private entry", (value) => ({ ...value, entries: [] })],
	[
		"wrong admission",
		(value) => {
			value.entries[0].job.admissionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
			return value;
		},
	],
	[
		"wrong owner",
		(value) => {
			value.entries[0].job.ownerId = "another-owner";
			return value;
		},
	],
	[
		"wrong device",
		(value) => {
			value.entries[0].job.runnerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
			return value;
		},
	],
	[
		"wrong occurrence",
		(value) => {
			value.entries[0].job.occurrenceId = "another-occurrence";
			return value;
		},
	],
	[
		"missing source credential",
		(value) => {
			delete value.entries[0].job.overlaySecret;
			return value;
		},
	],
	[
		"fallback mode",
		(value) => {
			value.entries[0].job.mode = "failsafe";
			return value;
		},
	],
	[
		"zero capture FPS",
		(value) => {
			value.entries[0].job.fps = 0;
			return value;
		},
	],
	[
		"excess capture FPS",
		(value) => {
			value.entries[0].job.fps = 121;
			return value;
		},
	],
	[
		"invalid capture resolution",
		(value) => {
			value.entries[0].job.resolution = "unbounded";
			return value;
		},
	],
	[
		"missing target URL",
		(value) => {
			delete value.entries[0].job.rtmpUrl;
			return value;
		},
	],
	[
		"invalid target credential",
		(value) => {
			value.entries[0].job.streamKey = 10;
			return value;
		},
	],
	[
		"changed authorization",
		(value) => {
			value.entries[0].job.lease.payload += "a";
			return value;
		},
	],
	[
		"empty destinations",
		(value) => {
			value.entries[0].job.destinations = [];
			return value;
		},
	],
	[
		"duplicate destinations",
		(value) => {
			value.entries[0].job.destinations.push(value.entries[0].job.destinations[0]);
			return value;
		},
	],
	[
		"invalid destination credential",
		(value) => {
			value.entries[0].job.destinations[0].streamKey = 10;
			return value;
		},
	],
	[
		"changed private source",
		(value) => {
			value.entries[0].job.overlaySecret = "changed-private-value";
			return value;
		},
	],
];
test.each(malformedInputs)("TDD-US3-CON008 cache admission baseline: %s preserves the last valid document and requires sync", async (_name, alter) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-validation-"));
	try {
		const fixture = scheduleAuthorizationFixture(),
			request = { requestId: "11111111-1111-4111-8111-111111111111", sentAt: 1000 };
		const payloads = new Map<string, string>();
		const set = jest.fn(async (id: string, value: string) => {
			payloads.set(id, value);
		});
		const cache = new RunnerScheduleCache({ directory, runnerId: fixture.runnerId, ownerId: fixture.ownerId, keys: fixture.keys, clock: () => 1000, uptime: () => 50000, bootId: () => "boot", keyring: { set, get: async (id) => payloads.get(id) ?? null } });
		const response = fixture.response(request.requestId).scheduleCache;
		expect(await cache.accept(response, request)).toBe(true);
		const previous = readFileSync(join(directory, "snapshot.json"), "utf8");
		set.mockClear();
		expect(await cache.accept(alter(JSON.parse(JSON.stringify(response))), request)).toBe(false);
		expect(cache.error).toBe("sync_required");
		expect(await cache.restore()).toBeNull();
		expect(set).not.toHaveBeenCalled();
		expect(readFileSync(join(directory, "snapshot.json"), "utf8")).toBe(previous);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["invalid reference", "missing private payload", "altered private payload", "oversized snapshot", "invalid anchor"])("TDD-US3-CON008 restore baseline: %s cannot restore private scheduled inputs", async (variant) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-private-validation-"));
	try {
		const fixture = scheduleAuthorizationFixture(),
			request = { requestId: "11111111-1111-4111-8111-111111111111", sentAt: 1000 };
		let privateValue: string | null = null;
		const options = {
			directory,
			runnerId: fixture.runnerId,
			ownerId: fixture.ownerId,
			keys: fixture.keys,
			clock: () => 1000,
			uptime: () => 50000,
			bootId: () => "boot",
			keyring: {
				set: async (_id: string, value: string) => {
					privateValue = value;
				},
				get: async () => privateValue,
			},
		};
		expect(await new RunnerScheduleCache(options).accept(fixture.response(request.requestId).scheduleCache, request)).toBe(true);
		const path = join(directory, "snapshot.json"),
			document = JSON.parse(readFileSync(path, "utf8"));
		if (variant === "invalid reference") document.entries[0].credentialReference = "invalid";
		if (variant === "invalid anchor") document.anchor.received = -1;
		if (variant === "missing private payload") privateValue = null;
		if (variant === "altered private payload") privateValue = JSON.stringify({ overlaySecret: "altered" });
		writeFileSync(path, variant === "oversized snapshot" ? " ".repeat(2 * 1024 * 1024 + 1) : JSON.stringify(document));
		const restored = new RunnerScheduleCache(options);
		expect(await restored.restore()).toBeNull();
		expect(restored.error).toBe("sync_required");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["valid", "corrupt", "oversized"])("TDD-US3-CON008 protected fallback baseline: %s private storage is isolated from signed metadata", async (variant) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-default-keyring-"));
	try {
		const fixture = scheduleAuthorizationFixture(),
			request = { requestId: "11111111-1111-4111-8111-111111111111", sentAt: 1000 };
		const options = { directory, runnerId: fixture.runnerId, keys: fixture.keys, clock: () => 1000, bootId: () => "boot" };
		expect(await new RunnerScheduleCache(options).accept(fixture.response(request.requestId).scheduleCache, request)).toBe(true);
		const path = join(directory, "private-payloads.json");
		expect(readFileSync(join(directory, "snapshot.json"), "utf8")).not.toContain(fixture.overlaySecret);
		if (variant === "corrupt") writeFileSync(path, JSON.stringify({ arbitrary: 12 }));
		if (variant === "oversized") writeFileSync(path, " ".repeat(16 * 1024 * 1024 + 1));
		const restored = new RunnerScheduleCache(options);
		if (variant === "valid") expect((await restored.restore())?.jobs[0].overlaySecret).toBe(fixture.overlaySecret);
		else {
			expect(await restored.restore()).toBeNull();
			expect(restored.error).toBe("sync_required");
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test.each(["unknown platform", "invalid boot response", "boot command failure"])("TDD-US3-CON008 boot identity baseline: %s requires sync after restart", async (variant) => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-boot-failure-"));
	const descriptor = Object.getOwnPropertyDescriptor(process, "platform")!;
	const child = jest.requireActual("node:child_process");
	const command = jest.spyOn(child, "execFileSync").mockImplementation(() => {
		if (variant === "boot command failure") throw new Error("FIXTURE_BOOT_UNAVAILABLE");
		return JSON.stringify({ bootId: -1, machine: "invalid" });
	});
	try {
		Object.defineProperty(process, "platform", { configurable: true, value: variant === "unknown platform" ? "aix" : "win32" });
		const fixture = scheduleAuthorizationFixture(),
			request = { requestId: "11111111-1111-4111-8111-111111111111", sentAt: 1000 };
		const options = { directory, runnerId: fixture.runnerId, keys: fixture.keys, clock: () => 1000, uptime: () => 50000, keyring: { set: async () => undefined, get: async () => null } };
		const current = new RunnerScheduleCache(options);
		expect(await current.accept(fixture.response(request.requestId).scheduleCache, request)).toBe(true);
		expect((await current.restore())?.jobs).toHaveLength(1);
		const restarted = new RunnerScheduleCache(options);
		expect(await restarted.restore()).toBeNull();
		expect(restarted.error).toBe("sync_required");
	} finally {
		command.mockRestore();
		Object.defineProperty(process, "platform", descriptor);
		rmSync(directory, { recursive: true, force: true });
	}
});

test("TDD-US3-CON008: a valid authorization cannot replace a different digest in a valid signed manifest", async () => {
	const directory = mkdtempSync(join(tmpdir(), "clipify-cache-inventory-binding-"));
	try {
		const fixture = scheduleAuthorizationFixture(),
			request = { requestId: "11111111-1111-4111-8111-111111111111", sentAt: 1000 };
		const response = fixture.response(request.requestId).scheduleCache;
		const claims = JSON.parse(Buffer.from(response.bundle.payload, "base64url").toString("utf8")) as { entries: { authorizationHash: string }[] };
		claims.entries[0].authorizationHash = "0".repeat(64);
		const set = jest.fn().mockResolvedValue(undefined);
		const cache = new RunnerScheduleCache({ directory, runnerId: fixture.runnerId, keys: fixture.keys, clock: () => 1000, uptime: () => 50000, bootId: () => "boot", keyring: { set, get: async () => null } });
		expect(await cache.accept({ ...response, bundle: fixture.signed(claims) }, request)).toBe(false);
		expect(set).not.toHaveBeenCalled();
		expect(cache.error).toBe("sync_required");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
