import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
const runnerRequire = createRequire(new URL("../../package.json", import.meta.url));
const streamRequire = createRequire(runnerRequire.resolve("puppeteer-stream"));
const captureCoreVersion = streamRequire("puppeteer-core/package.json").version;
const runnerCoreVersion = runnerRequire("puppeteer-core/package.json").version;
const captureBrowserRequire = createRequire(streamRequire.resolve("puppeteer-core"));
const readBrowserVersion = (resolver) => JSON.parse(readFileSync(join(dirname(dirname(resolver.resolve("@puppeteer/browsers"))), "package.json"), "utf8")).version;
const captureBrowserVersion = readBrowserVersion(captureBrowserRequire);
const runnerBrowserVersion = readBrowserVersion(runnerRequire);
if (captureBrowserVersion !== runnerBrowserVersion) throw new Error(`Capture downloader ${captureBrowserVersion} differs from Runner downloader ${runnerBrowserVersion}; reinstall native dependencies cleanly`);
const { launch, getStream, wss } = runnerRequire("puppeteer-stream");
const executablePath = process.env.RUNNER_CHROME_PATH || createRequire(new URL("../../../../package.json", import.meta.url))("@playwright/test").chromium.executablePath();
let browser, stream;
const server = createServer((_req, res) => {
	res.setHeader("Content-Type", "text/html");
	res.end(`<canvas width="320" height="180"></canvas><script>let i=0;const c=document.querySelector('canvas').getContext('2d');setInterval(()=>{c.fillStyle=i++%2?'#f00':'#00f';c.fillRect(0,0,320,180)},40);const a=new AudioContext();let o=a.createOscillator();o.connect(a.destination);o.start()</script>`);
});
try {
	await new Promise((r) => server.listen(0, "127.0.0.1", r));
	browser = await launch({ executablePath: executablePath, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage"], defaultViewport: { width: 320, height: 180 } });
	const page = await browser.newPage();
	await page.goto(`http://127.0.0.1:${server.address().port}`);
	stream = await getStream(page, { audio: true, video: true, frameSize: 50 });
	const chunks = [];
	await new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("No captured media within 15s")), 15000);
		stream.on("data", (chunk) => {
			chunks.push(chunk);
			if (Buffer.concat(chunks).length > 4096) {
				clearTimeout(timer);
				resolve();
			}
		});
		stream.once("error", reject);
	});
	const bytes = Buffer.concat(chunks);
	if (bytes.subarray(0, 4).toString("hex") !== "1a45dfa3") throw new Error("Captured bytes are not WebM");
	console.log(JSON.stringify({ capture: "passed", bytes: bytes.length, webm: true, captureCoreVersion, runnerCoreVersion, captureBrowserVersion, runnerBrowserVersion }));
} finally {
	stream?.destroy();
	if (browser) await browser.close();
	await new Promise((r) => server.close(r));
	const ws = await wss;
	await new Promise((r) => ws.close(r));
}
