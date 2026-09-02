import { formatMemberNumber, formatMemberSince } from "@lib/membershipFormat";

describe("membership formatting", () => {
	it("pads assigned member numbers", () => {
		expect(formatMemberNumber(7)).toBe("#0007");
		expect(formatMemberNumber(12345)).toBe("#12345");
	});

	it("uses a pending state for legacy accounts without a number", () => {
		expect(formatMemberNumber(null)).toBe("Pending");
		expect(formatMemberNumber(0)).toBe("Early member");
	});

	it("formats known join dates in UTC", () => {
		expect(formatMemberSince("2026-04-09T23:30:00.000Z")).toBe("Apr 9, 2026");
	});

	it("uses the stored timestamp independently of member-number backfill", () => {
		expect(formatMemberSince("2026-01-01")).toBe("Jan 1, 2026");
		expect(formatMemberSince(new Date("2026-01-01"))).toBe("Jan 1, 2026");
		expect(formatMemberSince("not-a-date")).toBe("Unknown");
	});
});
