import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const interUrl = "https://raw.githubusercontent.com/google/fonts/e1d6480102fed30739fead0faee463101f892c8f/ofl/inter/Inter%5Bopsz,wght%5D.ttf";
const interHash = "29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const destination = (composition, name) => new URL(`public/${composition}/fonts/${name}`, root);

async function prepareFonts() {
	for (const composition of ["clipify-flow", "clipify-rebuilt"]) {
		await mkdir(new URL(`public/${composition}/fonts/`, root), { recursive: true });
	}
	const inter = destination("clipify-flow", "Inter.ttf");
	let bytes = await readFile(inter).catch(() => null);
	if (!bytes || hash(bytes) !== interHash) {
		const response = await fetch(interUrl);
		if (!response.ok) throw new Error(`Inter download failed: HTTP ${response.status}`);
		bytes = Buffer.from(await response.arrayBuffer());
		if (hash(bytes) !== interHash) throw new Error("Inter font checksum mismatch");
		await writeFile(inter, bytes);
	}
	await copyFile(inter, destination("clipify-rebuilt", "Inter.ttf"));
	const copies = [
		["clipify-flow", "Serif-Regular.ttf", "DejaVuSerif.ttf"],
		["clipify-flow", "Mono-Regular.ttf", "DejaVuSansMono.ttf"],
		["clipify-rebuilt", "Serif-Bold.ttf", "DejaVuSerif-Bold.ttf"],
		["clipify-rebuilt", "Mono-Bold.ttf", "DejaVuSansMono-Bold.ttf"],
	];
	for (const [composition, target, source] of copies) {
		await copyFile(new URL(`../../public/fonts/brand/${source}`, root), destination(composition, target));
	}
	console.log(`Prepared ignored render fonts in ${fileURLToPath(new URL("public/", root))}`);
}

await prepareFonts();
