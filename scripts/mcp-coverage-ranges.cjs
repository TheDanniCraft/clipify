/** Source maps can map a generated constructor assignment end before its start.
 * Keep the trustworthy start point; never broaden that interval or drop its counter.
 * Other malformed mappings remain untouched for the strict coverage gate to reject.
 */
function repairMappedCoverage(coverage) {
	// CoverageMap.toJSON returns FileCoverage instances whose accessors live on
	// their prototype. Serialize each instance before cloning its raw counters.
	const result = structuredClone(Object.fromEntries(Object.entries(coverage).map(([path, file]) => [path, typeof file?.toJSON === "function" ? file.toJSON() : file])));
	function repair(range) {
		if (Number.isSafeInteger(range?.start?.line) && range.start.line > 0 && Number.isSafeInteger(range?.end?.line) && range.end.line > 0 && range.end.line < range.start.line) range.end = { ...range.start };
	}
	for (const file of Object.values(result)) {
		for (const range of Object.values(file.statementMap)) repair(range);
		for (const fn of Object.values(file.fnMap)) {
			repair(fn.decl);
			repair(fn.loc);
		}
		for (const branch of Object.values(file.branchMap)) {
			repair(branch.loc);
			for (const range of branch.locations) repair(range);
		}
	}
	return result;
}
module.exports = { repairMappedCoverage };
