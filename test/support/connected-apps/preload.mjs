// Native Bun fixture only: Next normally removes this compile-time import marker.
// Domain logic, authentication, database access and HTTP handlers remain real.
import { mock } from "bun:test";
mock.module("server-only", () => ({}));
