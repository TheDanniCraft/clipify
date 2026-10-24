import { formatDisplayDate } from "@lib/dateFormat";
test.each([
	["en-US", "01/04/2027"],
	["en-GB", "04/01/2027"],
	["de-DE", "04.01.2027"],
])("date-only values follow %s without shifting the calendar day", (locale, expected) => {
	expect(formatDisplayDate("2027-01-04", locale)).toBe(expected);
});
test("instant dates respect an explicitly selected timezone and invalid input stays readable", () => {
	expect(formatDisplayDate("2027-01-04T00:00:00Z", "en-GB", { timeZone: "America/Los_Angeles" })).toBe("03/01/2027");
	expect(formatDisplayDate("invalid", "en-GB")).toBe("Date unavailable");
});
