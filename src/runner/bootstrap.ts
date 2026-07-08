import * as fs from "fs";

export function extractBakedConfig(execPath: string): any {
	try {
		const fd = fs.openSync(execPath, "r");
		const stat = fs.fstatSync(fd);
		const readLen = Math.min(2048, stat.size);
		const buffer = Buffer.alloc(readLen);
		
		// Read the last `readLen` bytes of the file
		fs.readSync(fd, buffer, 0, readLen, stat.size - readLen);
		fs.closeSync(fd);

		const text = buffer.toString("utf-8");
		const match = text.match(/___CLIPIFY_CONFIG_START____(.*?)___CLIPIFY_CONFIG_END____/);
		if (match && match[1]) {
			return JSON.parse(match[1]);
		}
	} catch (error) {
		// Ignore
	}
	return null;
}
