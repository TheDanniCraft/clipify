const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;
const location = (value) => object(value) && object(value.start) && object(value.end) && Number.isSafeInteger(value.start.line) && value.start.line > 0 && Number.isSafeInteger(value.end.line) && value.end.line >= value.start.line;

const branchLocation = (value) => location(value) || (object(value) && object(value.start) && object(value.end) && Object.keys(value.start).length === 0 && Object.keys(value.end).length === 0);

export function validCoverage(value) {
	if (!object(value) || !["statementMap", "fnMap", "branchMap", "s", "f", "b"].every((key) => object(value[key]))) return false;
	for (const [map, counters] of [
		["statementMap", "s"],
		["fnMap", "f"],
		["branchMap", "b"],
	]) {
		const keys = Object.keys(value[map]);
		if (keys.length !== Object.keys(value[counters]).length || keys.some((key) => !Object.hasOwn(value[counters], key))) return false;
		for (const key of keys) {
			if (map === "branchMap") {
				if (!object(value[map][key]) || !Array.isArray(value[map][key].locations) || !Array.isArray(value[counters][key]) || value[map][key].locations.length !== value[counters][key].length || !value[counters][key].every(count) || !location(value[map][key].loc) || !value[map][key].locations.every(branchLocation)) return false;
			} else if (!count(value[counters][key]) || !location(map === "fnMap" ? value[map][key]?.loc : value[map][key])) return false;
		}
	}
	return true;
}
