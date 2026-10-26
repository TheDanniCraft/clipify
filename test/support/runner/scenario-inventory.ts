import { generateMessages } from "@cucumber/gherkin";
import { IdGenerator, SourceMediaType } from "@cucumber/messages";

export function runnerScenarioInventory(source: string, uri: string) {
	const envelopes = generateMessages(source, uri, SourceMediaType.TEXT_X_CUCUMBER_GHERKIN_PLAIN, { includePickles: true, includeGherkinDocument: true, newId: IdGenerator.incrementing() });
	const errors = envelopes.flatMap((e) => (e.parseError ? [e.parseError.message] : []));
	if (errors.length) throw new Error(errors.join("\n"));
	const ids = envelopes.flatMap((e) => (e.pickle ? [e.pickle.tags.map((t) => t.name.slice(1)).filter((name) => /^(BDD|ATDD)-US\d-/.test(name))] : []));
	if (ids.some((row) => row.length !== 1)) throw new Error("Every Runner scenario must have exactly one stable owning ID");
	const flat = ids.flat();
	if (new Set(flat).size !== flat.length) throw new Error("Duplicate Runner scenario ID");
	return flat;
}
export function assertRunnerBindings(declared: readonly string[], executed: readonly string[]) {
	const counts = new Map<string, number>();
	for (const id of executed) counts.set(id, (counts.get(id) ?? 0) + 1);
	if (new Set(declared).size !== declared.length || declared.some((id) => counts.get(id) !== 1) || executed.some((id) => !declared.includes(id))) throw new Error("Missing, foreign or duplicate Runner binding evidence");
}
