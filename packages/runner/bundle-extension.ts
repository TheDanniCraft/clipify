import fs from "fs";
import path from "path";

const extPath = "packages/runner/node_modules/puppeteer-stream/extension";
const files = ["manifest.json", "background.js", "options.html", "options.js"];

let out = `import fs from "fs";
import path from "path";

export function writeExtension(dir: string) {
	fs.mkdirSync(dir, { recursive: true });
`;

files.forEach((f) => {
	const content = fs.readFileSync(path.join(extPath, f), "utf8");
	const escapedContent = content.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
	out += `\tfs.writeFileSync(path.join(dir, "${f}"), \`${escapedContent}\`);\n`;
});

out += "}\n";

fs.writeFileSync("packages/runner/src/extension.ts", out);
