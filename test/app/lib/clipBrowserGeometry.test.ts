import { compositionRectPixels } from "@lib/clipComposition";
it("uses identical even-pixel crop and output bounds for native and browser video", () => {
	expect(compositionRectPixels({ x: 0.101, y: 0.203, w: 0.301, h: 0.403 }, 1280, 720)).toEqual({ x: 128, y: 146, w: 384, h: 290 });
	expect(compositionRectPixels({ x: 0, y: 0, w: 0.000001, h: 0.000001 }, 720, 1280)).toEqual({ x: 0, y: 0, w: 2, h: 2 });
});
