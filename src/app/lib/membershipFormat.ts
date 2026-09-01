export function formatMemberNumber(memberNumber: number | null): string {
	if (memberNumber === null) return "Pending";
	if (memberNumber === 0) return "Early member";
	return `#${String(memberNumber).padStart(4, "0")}`;
}

export function formatMemberSince(joinedAt: Date | string, memberNumber: number | null): string {
	if (memberNumber === null) return "Pending backfill";
	if (memberNumber === 0) return "Before records";
	const date = typeof joinedAt === "string" ? new Date(joinedAt) : joinedAt;
	if (Number.isNaN(date.getTime())) return "Unknown";
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}
