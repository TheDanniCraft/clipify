import { createRequire } from "node:module";

// Native Node ESM cannot discover this package's forwarded CommonJS named exports.
// Use the installed server SDK, matching webpack's CommonJS interop, without mocks.
const sdk = createRequire(import.meta.url)("@sentry/nextjs");
export const { setUser, captureException, captureCheckIn, captureRequestError, getClient, withScope, startSpan, logger, metrics, init, flush, close, captureFeedback, Scope } = sdk;
