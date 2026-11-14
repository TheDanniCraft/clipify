export type FlowFormat = "landscape" | "vertical" | "feed";
export type Box = { x: number; y: number; w: number; h: number };
const video = (x: number, y: number, w: number): Box => ({ x, y, w, h: (w * 9) / 16 });
const automaticPanel = (x: number, y: number, w: number, h: number, previewWidth: number) => {
	const inset = 31;
	return { box: { x, y, w, h }, inset, preview: video(x + w - inset - previewWidth, y + h - inset - (previewWidth * 9) / 16, previewWidth) };
};

// Keep each format explicit so layout changes cannot affect another aspect ratio.
const layouts = {
	landscape: () => {
		const panel = automaticPanel(1360, 363, 440, 582, 378);
		return {
			...{
				intro: { x: 850, y: 250, w: 980, h: 551.25 },
				moment: { x: 1000, y: 420, w: 740, h: 416.25 },
				source: { x: 125, y: 350, w: 1080, h: 607.5 },
				stream: { x: 160, y: 320, w: 1180, h: 663.75 },
				custom: { x: 100, y: 340, w: 1180, h: 663.75 },
				end: { x: 1050, y: 275, w: 750, h: 421.875 },
				portrait: { x: 1400, y: 350, w: 341.71875, h: 607.5 },
				other: { x: 150, y: 470, w: 640, h: 360 },
				heading: { x: 110, y: 135 },
				introHeading: { x: 100, y: 240 },
				exportButton: { x: 1374, y: 982 },
				template: { x: 1420, y: 390 },
			},
			queue: panel.preview,
			autoPanel: panel,
		};
	},
	vertical: () => {
		const panel = automaticPanel(72, 1210, 900, 440, 360);
		return {
			...{
				intro: { x: 72, y: 760, w: 900, h: 506.25 },
				moment: { x: 180, y: 620, w: 792, h: 445.5 },
				source: { x: 72, y: 600, w: 900, h: 506.25 },
				stream: { x: 72, y: 600, w: 900, h: 506.25 },
				custom: { x: 72, y: 600, w: 900, h: 506.25 },
				end: { x: 72, y: 650, w: 900, h: 506.25 },
				portrait: { x: 365, y: 1160, w: 300, h: 533.3333333333334 },
				other: { x: 180, y: 1170, w: 650, h: 365.625 },
				heading: { x: 72, y: 290 },
				introHeading: { x: 72, y: 310 },
				exportButton: { x: 318, y: 1720 },
				template: { x: 72, y: 1210 },
			},
			queue: panel.preview,
			autoPanel: panel,
		};
	},
	feed: () => {
		const panel = automaticPanel(72, 1010, 900, 308, 300);
		return {
			...{
				intro: { x: 72, y: 460, w: 900, h: 506.25 },
				moment: { x: 542, y: 592.1875, w: 430, h: 241.875 },
				source: { x: 72, y: 544.375, w: 600, h: 337.5 },
				stream: { x: 72, y: 460, w: 900, h: 506.25 },
				custom: { x: 72, y: 460, w: 900, h: 506.25 },
				end: { x: 72, y: 460, w: 900, h: 506.25 },
				portrait: { x: 720, y: 488.125, w: 253.125, h: 450 },
				other: { x: 72, y: 592.1875, w: 430, h: 241.875 },
				heading: { x: 72, y: 190 },
				introHeading: { x: 72, y: 200 },
				exportButton: { x: 650, y: 1020 },
				template: { x: 72, y: 1010 },
			},
			queue: panel.preview,
			autoPanel: panel,
		};
	},
};

export const flowLayout = (format: FlowFormat) => layouts[format]();
