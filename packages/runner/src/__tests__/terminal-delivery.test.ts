import { existsSync } from "node:fs";
import { join } from "node:path";
import { flushTerminalReceipts } from "../terminal-delivery";

test.each(["http", "network", "json"])("TDD-US1-FR004: %s failure retains its receipt while another device can acknowledge", async (failure) => {
	const closed = { ownerId: "owner", sessionId: "session", leaseId: "lease", configurationRevision: 1, state: "stopped" as const, allOutputsClosed: true as const, updatedAt: 0 };
	const first = { ...closed, runnerId: "first", admissionId: "a", executionGeneration: "g" };
	const second = { ...closed, runnerId: "second", admissionId: "b", executionGeneration: "h" };
	let pending = [first, second];
	const journal = {
		pendingTerminals: () => pending,
		acknowledge: jest.fn((id: string) => {
			pending = pending.filter((item) => item.admissionId !== id);
			return true;
		}),
	};
	const credentials = { load: async () => ["first", "second"].map((runnerId) => ({ id: runnerId, runnerId, apiBase: "https://example.invalid///", token: runnerId })), remove: jest.fn().mockResolvedValue(undefined) };
	const network = jest.fn(async (_url: unknown, init: RequestInit) => {
		if ((init.headers as Record<string, string>).Authorization === "Bearer first") {
			if (failure === "network") throw new Error("offline");
			return failure === "http" ? new Response("retry", { status: 429 }) : new Response("invalid-json");
		}
		return new Response(JSON.stringify({ accepted: true }));
	});
	await flushTerminalReceipts({ credentials, journalFor: () => journal, fetch: network as typeof fetch });
	expect(pending).toEqual([first]);
	expect(journal.acknowledge).toHaveBeenCalledTimes(1);
	expect(journal.acknowledge).toHaveBeenCalledWith("b", "h");
	expect(credentials.remove).toHaveBeenCalledTimes(1);
	expect(credentials.remove).toHaveBeenCalledWith("second");
	expect(network).toHaveBeenCalledTimes(2);
});

test("TDD-US1-FR004: unrelated device receipts are never submitted with a retired bearer", async () => {
	const network = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("must not send"));
	const remove = jest.fn();
	try {
		await flushTerminalReceipts({ credentials: { load: async () => [{ id: "first", runnerId: "first", apiBase: "https://example.invalid", token: "fixture" }], remove }, journalFor: () => ({ pendingTerminals: () => [{ runnerId: "second" }] as never, acknowledge: jest.fn() }) });
		expect(network).not.toHaveBeenCalled();
		expect(remove).not.toHaveBeenCalled();
	} finally {
		network.mockRestore();
	}
});

test("TDD-US1-FR004 terminal delivery retains receipts on HTTP success without acceptance and retires only explicit acceptance", async () => {
	const receipt = { ownerId: "creator", runnerId: "device", sessionId: "session", admissionId: "admission", executionGeneration: "generation", leaseId: "lease", configurationRevision: 2, state: "stopped", allOutputsClosed: true };
	let pending = [receipt];
	const journal = {
		pendingTerminals: () => pending,
		acknowledge: jest.fn((id: string, generation: string) => {
			pending = pending.filter((record) => record.admissionId !== id || record.executionGeneration !== generation);
			return true;
		}),
	};
	const credentials = { load: jest.fn(async () => [{ id: "credential-ref", runnerId: "device", apiBase: "http://127.0.0.1:3107", token: "retired-fixture-token" }]), remove: jest.fn().mockResolvedValue(undefined) };
	let accepted = false;
	const network = jest.fn(async () => new Response(JSON.stringify(accepted ? { accepted: true } : { success: true }), { status: 200 }));
	const deliver = existsSync(join(__dirname, "../terminal-delivery.ts")) ? jest.requireActual("../terminal-delivery").flushTerminalReceipts : undefined;
	const options = { credentials, journalFor: () => journal, fetch: network };
	await deliver?.(options);
	expect(network).toHaveBeenCalledTimes(1);
	expect(network).toHaveBeenCalledWith("http://127.0.0.1:3107/api/runner/terminal", expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer retired-fixture-token" }, body: JSON.stringify({ admissionId: "admission", executionGeneration: "generation", allOutputsClosed: true }) }));
	expect(journal.acknowledge).not.toHaveBeenCalled();
	expect(credentials.remove).not.toHaveBeenCalled();
	accepted = true;
	await deliver(options);
	expect(journal.acknowledge).toHaveBeenCalledWith("admission", "generation");
	expect(credentials.remove).toHaveBeenCalledWith("credential-ref");
	expect(pending).toEqual([]);
});

test("TDD-US3-EC009: retired-device terminal delivery retains its playback timeout", async () => {
	const receipt = { ownerId: "owner", runnerId: "device", sessionId: "session", admissionId: "admission", executionGeneration: "generation", leaseId: "lease", configurationRevision: 1, state: "stopped" as const, allOutputsClosed: true as const, updatedAt: 0, playbackOutcome: "playback_timeout" as const };
	const network = jest.fn(async () => new Response(JSON.stringify({ accepted: true })));
	await flushTerminalReceipts({ credentials: { load: async () => [{ id: "credential", runnerId: "device", apiBase: "https://example.invalid", token: "fixture" }], remove: jest.fn() }, journalFor: () => ({ pendingTerminals: () => [receipt], acknowledge: jest.fn() }), fetch: network as typeof fetch });
	const parameters: unknown[] = network.mock.calls[0];
	expect(JSON.parse((parameters[1] as RequestInit).body as string)).toMatchObject({ admissionId: "admission", allOutputsClosed: true, playbackOutcome: "playback_timeout" });
});
