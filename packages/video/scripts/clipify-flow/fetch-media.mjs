import { mkdirSync, writeFileSync } from "node:fs";

const clips = [
	{ file: "backstab", slug: "OddCrowdedPlumageMau5-og73QMsJ2TO8KT8E", title: "Insane double backstab knife", creator: "richieboooy" },
	{ file: "minecraft", slug: "FriendlySpineyPastaStinkyCheese-9Ijn-aVz5gYS5BPK", title: "GG Danni spielt OP Move", creator: "yummidonut" },
];
const directory = "public/clipify-flow/media";
mkdirSync(directory, { recursive: true });
for (const clip of clips) {
	const response = await fetch("https://gql.twitch.tv/gql", {
		method: "POST",
		headers: { "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko", "Content-Type": "application/json" },
		body: JSON.stringify([{ operationName: "VideoAccessToken_Clip", variables: { platform: "web", slug: clip.slug }, extensions: { persistedQuery: { version: 1, sha256Hash: "993d9a5131f15a37bd16f32342c44ed1e0b1a9b968c6afdb662d2cddd595f6c5" } } }]),
	});
	if (!response.ok) throw Error(`Playback lookup failed: ${response.status}`);
	const data = (await response.json())[0]?.data?.clip;
	if (!data?.videoQualities?.length) throw Error(`No playback media: ${clip.file}`);
	const quality = data.videoQualities.find((q) => Number(q.quality) === 720) ?? data.videoQualities[0];
	const url = new URL(quality.sourceURL);
	url.searchParams.set("sig", data.playbackAccessToken.signature);
	url.searchParams.set("token", data.playbackAccessToken.value);
	const media = await fetch(url);
	if (!media.ok) throw Error(`Video download failed: ${media.status}`);
	await Bun.write(`${directory}/${clip.file}-source.mp4`, media);
	console.log(`Downloaded ${clip.file}: ${quality.quality}p`);
}
writeFileSync(
	`${directory}/sources.json`,
	JSON.stringify(
		clips.map((c) => ({ ...c, url: `https://clips.twitch.tv/${c.slug}`, broadcaster: "thedannicraft", retrieved: "2026-11-13", source: "Clipify approved creator search, Twitch playback resolver" })),
		null,
		2,
	) + "\n",
);
