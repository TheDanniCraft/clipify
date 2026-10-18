import * as os from "node:os";
import { readNativeTestRuntime } from "./native-test-shims.mjs";

export * from "node:os";
export const homedir = () => readNativeTestRuntime().home;
export const tmpdir = () => readNativeTestRuntime().home;
export default { ...os, homedir, tmpdir };
