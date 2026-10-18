import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import coverageLibrary from "istanbul-lib-coverage";
import { validCoverage } from "./coverage-counters.mjs";

const policy = JSON.parse(readFileSync(new URL("./runner-feature-coverage.json", import.meta.url), "utf8")).legacy;
const { createFileCoverage } = coverageLibrary;

export function evaluateRunnerPlayerCoverage(report, sourceText) {
	const entry = Object.entries(report).find(([path]) => resolve(path) === resolve(policy.path))?.[1];
	if (!entry) return { ok: false, errors: ["Missing required legacy player source coverage"] };
	if (!validCoverage(entry) || resolve(entry.path ?? policy.path) !== resolve(policy.path)) return { ok: false, errors: ["Invalid legacy player coverage counters"] };
	const errors = [];
	const coverage = createFileCoverage(entry);
	const summary = coverage.toSummary().toJSON();
	for (const [metric, minimum] of Object.entries(policy.thresholdFloors)) if (summary[metric].pct < minimum) errors.push(`Retained player ${metric} ${summary[metric].pct} is below ${minimum}`);
	const lines = (sourceText ?? readFileSync(policy.path, "utf8")).split("\n").flatMap((line, index) => (/runnerPresentation|runnerContent|RunnerContent|runnerSelectionSettled|setRunnerSelectionSettled/.test(line) ? [index + 1] : []));
	const selected = new Set(lines);
	const intersects = (loc) => loc && lines.some((line) => line >= loc.start.line && line <= loc.end.line);
	const starts = (loc) => loc && selected.has(loc.start.line);
	const metric = (values) => ({ covered: values.filter((hits) => hits > 0).length, total: values.length, pct: values.length ? Math.floor((values.filter((hits) => hits > 0).length / values.length) * 10000) / 100 : 0 });
	const runner = {
		statements: metric(
			Object.entries(entry.s)
				.filter(([id]) => intersects(entry.statementMap[id]))
				.map(([, hits]) => hits),
		),
		functions: metric(
			Object.entries(entry.f)
				.filter(([id]) => intersects(entry.fnMap[id].loc))
				.map(([, hits]) => hits),
		),
		branches: metric(
			Object.entries(entry.b)
				.filter(([id]) => starts(entry.branchMap[id].loc) || entry.branchMap[id].locations.some(starts))
				.flatMap(([, hits]) => hits),
		),
		lines: metric(
			Object.entries(coverage.getLineCoverage())
				.filter(([line]) => selected.has(Number(line)))
				.map(([, hits]) => hits),
		),
	};
	for (const [name, minimum] of Object.entries(policy.runnerCounterFloors)) if (!runner[name].total || runner[name].pct < minimum) errors.push(`Runner ${name} ${runner[name].pct} is below ${minimum} or has no executable counters`);
	return { ok: errors.length === 0, errors, summary, runner };
}
