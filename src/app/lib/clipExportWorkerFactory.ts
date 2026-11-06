export function createClipExportWorker() {
	return new Worker(new URL("./clipBrowserRender.worker.ts", import.meta.url));
}
