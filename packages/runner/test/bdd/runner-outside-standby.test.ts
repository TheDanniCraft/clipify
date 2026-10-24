import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";

test.each(["before", "after"])(
	"BDD-US4-OPT094: a cold Runner with an empty source cannot start standby %s its signed broadcast window",
	(boundary) => {
		expect(readFileSync(join(__dirname, "runner-outside-standby.feature"), "utf8")).toContain("@BDD-US4-OPT094");
		const output = execFileSync(process.execPath, [join(__dirname, "../support/outside-standby-probe.mjs"), boundary], { encoding: "utf8", timeout: 25000 });
		expect(JSON.parse(output.trim())).toEqual({ cacheStored: true, coldProcess: true, cacheRestored: true, prepared: true, applied: false, emptyPlaylist: true, engineCreations: 0, outputStarts: 0, sourceReads: 0, journalUnchanged: true });
	},
	30000,
);
