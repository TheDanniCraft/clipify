import { releaseSummary } from "@/app/lib/releaseSummary";
it("highlights published creator-facing subjects and leaves technical notes to the full detail", () => {
	expect(releaseSummary("# Changes\n✨ Add playlist controls\n✅ Improve CI coverage\n🐛 Fix OBS audio\n📦 Bump dependencies\n💄 Refine galleries\n✨ Add more tools")).toEqual(["Add playlist controls", "Fix OBS audio", "Refine galleries"]);
	expect(releaseSummary("\n")).toEqual([]);
});

it("removes decorative emoji from the summary without changing published wording", () => {
	expect(releaseSummary("🔒️ Fix account access\n🔀 Merge branch master\n⚡️ Speed up playback")).toEqual(["Fix account access", "Speed up playback"]);
});
