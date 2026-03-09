import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

if (!global.TextEncoder) {
	(global as { TextEncoder?: typeof TextEncoder }).TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
	(global as { TextDecoder?: typeof TextDecoder }).TextDecoder = TextDecoder as typeof global.TextDecoder;
}
