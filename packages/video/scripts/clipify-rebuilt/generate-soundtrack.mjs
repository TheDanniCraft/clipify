import { generateSoundtrack } from "../moments-preview/generate-soundtrack.mjs";
import { REBUILT_DURATION, SOUND_CUES } from "../../src/compositions/clipify-rebuilt/timeline.ts";

generateSoundtrack({
	frames: REBUILT_DURATION,
	directory: "public/clipify-rebuilt/audio",
	trailer: true,
	continuous: true,
	cues: SOUND_CUES,
});
