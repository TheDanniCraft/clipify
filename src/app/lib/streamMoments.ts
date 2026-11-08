type MomentClip = { id: string; vodOffsetSeconds: number | null; duration: number; views: number; createdAt: string };
export function groupStreamMoments<T extends MomentClip>(clips: T[]) {
	const ordered = [...clips].sort((a, b) => (a.vodOffsetSeconds ?? Infinity) - (b.vodOffsetSeconds ?? Infinity) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
	const groups: { id: string; offsetSeconds: number | null; anchor: T; clips: T[] }[] = [];
	let active: typeof groups = [];
	for (const clip of ordered) {
		if (clip.vodOffsetSeconds != null) active = active.filter((group) => group.offsetSeconds! + group.anchor.duration > clip.vodOffsetSeconds!);
		const group =
			clip.vodOffsetSeconds == null || clip.duration <= 0
				? undefined
				: active.find((candidate) => {
						const start = candidate.offsetSeconds!;
						const overlap = Math.min(start + candidate.anchor.duration, clip.vodOffsetSeconds! + clip.duration) - Math.max(start, clip.vodOffsetSeconds!);
						return overlap >= Math.min(candidate.anchor.duration, clip.duration) / 2;
					});
		if (group) group.clips.push(clip);
		else {
			const next = { id: clip.id, offsetSeconds: clip.vodOffsetSeconds, anchor: clip, clips: [clip] };
			groups.push(next);
			if (clip.vodOffsetSeconds != null) active.push(next);
		}
	}
	return groups.map(({ id, offsetSeconds, clips }) => ({ id, offsetSeconds, clips: clips.sort((a, b) => b.views - a.views || a.id.localeCompare(b.id)) }));
}
