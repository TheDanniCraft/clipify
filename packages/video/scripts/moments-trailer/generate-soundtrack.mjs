import { generateSoundtrack } from "../moments-preview/generate-soundtrack.mjs";
import { TRAILER_EVENTS, TRAILER_DURATION } from "../../src/compositions/moments-trailer/timeline.ts";
generateSoundtrack({ events: TRAILER_EVENTS, frames: TRAILER_DURATION, directory: "public/moments-trailer/audio", trailer: true });
