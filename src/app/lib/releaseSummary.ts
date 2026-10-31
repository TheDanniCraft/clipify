// Keep the published notes intact; highlight creator-facing subjects before technical detail.
export function releaseSummary(body: string): string[] {
	return body
		.split(/\r?\n/)
		.map((line) =>
			line
				.replace(/^[-*]\s+/, "")
				.trim()
				.replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, ""),
		)
		.filter((line) => line && !/^#|^Merge |^https?:/.test(line) && !/\b(CI|coverage|workflow|migration|dependency|dependencies|test suite|typecheck|lint|fixture|benchmark|lockfile)\b/i.test(line));
}
