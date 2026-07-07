import * as readline from "readline";
import * as fs from "fs";

export class ConsoleUI {
	private static pinnedLines: string[] = [];
	private static originalLog = console.log;
	private static originalError = console.error;
	private static originalWarn = console.warn;
	private static originalInfo = console.info;

	static init() {
		console.log = (...args) => this.addLog(this.formatArgs(args));
		console.error = (...args) => this.addLog(`\x1b[31m${this.formatArgs(args)}\x1b[0m`);
		console.warn = (...args) => this.addLog(`\x1b[33m${this.formatArgs(args)}\x1b[0m`);
		console.info = (...args) => this.addLog(`\x1b[36m${this.formatArgs(args)}\x1b[0m`);
	}

	static setPinned(lines: string[]) {
		this.pinnedLines = lines;
		this.renderStatusBar();
	}

	private static formatArgs(args: unknown[]) {
		return args
			.map((a) => {
				if (a instanceof Error) {
					return a.stack || a.message;
				}
				if (typeof a === "object") {
					try {
						return JSON.stringify(a, null, 2);
					} catch {
						return "[Object]";
					}
				}
				return String(a);
			})
			.join(" ");
	}

	private static lastRenderedLines = 0;

	private static clearStatusBar() {
		if (this.lastRenderedLines > 0) {
			readline.moveCursor(process.stdout, 0, -this.lastRenderedLines);
			readline.clearScreenDown(process.stdout);
			this.lastRenderedLines = 0;
		}
	}

	private static addLog(msg: string) {
		const timestamp = new Date().toISOString();

		const unstyledMsg = msg.replace(/\x1b\[[0-9;]*m/g, "");
		const logLine = `[${timestamp}] ${unstyledMsg}\n`;

		try {
			fs.appendFileSync("runner.log", logLine);
		} catch {}

		this.clearStatusBar();
		process.stdout.write(`[${timestamp}] ${msg}\n`);
		this.renderStatusBar();
	}

	private static renderStatusBar() {
		this.clearStatusBar();
		if (this.pinnedLines.length > 0) {
			const statusText = `--------------------------------------------------\n${this.pinnedLines.join("\n")}\n`;
			process.stdout.write(statusText);
			this.lastRenderedLines = this.pinnedLines.length + 1;
		}
	}
}
