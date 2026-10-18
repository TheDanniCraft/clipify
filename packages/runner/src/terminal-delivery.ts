import type { TerminalCredentialStore } from "./terminal-credentials";
import type { ExecutionJournal } from "./execution-journal";

type Options = { credentials: Pick<TerminalCredentialStore, "load" | "remove">; journalFor: (runnerId: string) => Pick<ExecutionJournal, "pendingTerminals" | "acknowledge">; fetch?: typeof fetch };

/** A retired token is used only for its narrow terminal endpoint, never for start or renewal. */
export async function flushTerminalReceipts(options: Options): Promise<void> {
	const network = options.fetch ?? fetch;
	for (const credential of await options.credentials.load()) {
		try {
			const journal = options.journalFor(credential.runnerId);
			const receipts = journal.pendingTerminals().filter((receipt) => receipt.runnerId === credential.runnerId);
			for (const receipt of receipts) {
				const response = await network(credential.apiBase.replace(/\/+$/, "") + "/api/runner/terminal", {
					method: "POST",
					headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential.token}` },
					body: JSON.stringify({ admissionId: receipt.admissionId, executionGeneration: receipt.executionGeneration, allOutputsClosed: true, ...(receipt.playbackOutcome ? { playbackOutcome: receipt.playbackOutcome } : {}) }),
					redirect: "error",
					signal: AbortSignal.timeout(5000),
				});
				if (!response.ok) continue;
				const result = (await response.json()) as { accepted?: unknown };
				if (result.accepted === true) journal.acknowledge(receipt.admissionId, receipt.executionGeneration);
			}
			if (receipts.length && !journal.pendingTerminals().some((receipt) => receipt.runnerId === credential.runnerId)) await options.credentials.remove(credential.id);
		} catch {
			console.warn("[Runner] Terminal receipt remains pending for a later retry.");
		}
	}
}
