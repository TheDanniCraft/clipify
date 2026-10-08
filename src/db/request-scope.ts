import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type PoolConfig } from "pg";

type Release = (error?: Error | boolean) => void;
type ConnectCallback = Parameters<Pool["connect"]>[0];
const requests = new AsyncLocalStorage<DatabaseRequestScope>();
const cancelled = () => new Error("DATABASE_REQUEST_CANCELLED");

class OwnedLease {
	readonly client: PoolClient;
	private marker = `/* clipify-mcp ${randomUUID()} */`;
	private released = false;
	private cancellation?: Promise<void>;
	constructor(
		private raw: PoolClient,
		private nativeRelease: Release,
		private scope: DatabaseRequestScope,
		private cancelBackend: (marker: string) => Promise<void>,
	) {
		this.client = new Proxy(raw, {
			get: (target, key) => {
				if (key === "release") return this.release;
				const value = Reflect.get(target, key);
				if (key === "query")
					return (...args: unknown[]) => {
						this.scope.assertOpen();
						const [query, ...rest] = args;
						if (typeof query === "string") return Reflect.apply(value, target, [`${this.marker} ${query}`, ...rest]);
						if (query && typeof query === "object" && "text" in query && typeof query.text === "string" && !("submit" in query)) {
							return Reflect.apply(value, target, [{ ...query, text: `${this.marker} ${query.text}`, name: undefined }, ...rest]);
						}
						throw new Error("Unsupported request-owned database query");
					};
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	}
	readonly release: Release = (error) => {
		if (this.released) return;
		if (this.scope.stopped) {
			void this.cancel();
			return;
		}
		this.finish(error);
	};
	private finish(error?: Error | boolean) {
		if (this.released) return;
		this.released = true;
		this.scope.forget(this);
		this.nativeRelease(error);
	}
	cancel(): Promise<void> {
		if (this.released) return Promise.resolve();
		if (!this.cancellation) {
			// Match current SQL ownership rather than an earlier backend identity; retain the lease until acknowledgement.
			this.cancellation = this.cancelBackend(this.marker)
				.catch(() => {})
				.finally(() => this.finish(true));
		}
		return this.cancellation;
	}
}

class DatabaseRequestScope {
	readonly stopSignal = new AbortController();
	readonly interrupted: Promise<never>;
	stopped = false;
	private leases = new Set<OwnedLease>();
	private reject!: (error: Error) => void;
	private stopping?: Promise<void>;
	private onAbort = () => {
		void this.stop();
	};
	constructor(private signal: AbortSignal) {
		this.interrupted = new Promise<never>((_, reject) => {
			this.reject = reject;
		});
		// An already-aborted request can stop before the race below is attached.
		void this.interrupted.catch(() => {});
		signal.addEventListener("abort", this.onAbort, { once: true });
		if (signal.aborted) this.onAbort();
	}
	assertOpen() {
		if (this.stopped) throw cancelled();
	}
	own(raw: PoolClient, release: Release, cancelBackend: (marker: string) => Promise<void>) {
		this.assertOpen();
		const lease = new OwnedLease(raw, release, this, cancelBackend);
		this.leases.add(lease);
		return lease;
	}
	forget(lease: OwnedLease) {
		this.leases.delete(lease);
	}
	stop(): Promise<void> {
		if (!this.stopping) {
			this.stopped = true;
			this.signal.removeEventListener("abort", this.onAbort);
			this.reject(cancelled());
			this.stopSignal.abort();
			this.stopping = Promise.allSettled([...this.leases].map((lease) => lease.cancel())).then(() => {});
		}
		return this.stopping;
	}
}

/** Ordinary callers use the shared pool unchanged; request-owned leases have isolated cancellation. */
export class RequestAwarePool extends Pool {
	private cancellationPool: Pool;
	private pendingCancellation = new Set<Promise<void>>();
	constructor(configuration: PoolConfig) {
		super(configuration);
		this.cancellationPool = new Pool({ ...configuration, max: 2, connectionTimeoutMillis: 1000, statement_timeout: 1000 });
		// Background connection failure is recovered by the next bounded cancellation attempt.
		this.cancellationPool.on("error", () => {});
	}
	private cancelBackend = (marker: string) => {
		const pending = this.cancellationPool.query("SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND state='active' AND query LIKE $1", [`${marker} %`]).then(() => {});
		this.pendingCancellation.add(pending);
		void pending.finally(() => this.pendingCancellation.delete(pending)).catch(() => {});
		return pending;
	};
	override connect(): Promise<PoolClient>;
	override connect(callback: ConnectCallback): void;
	override connect(callback?: ConnectCallback): Promise<PoolClient> | void {
		const scope = requests.getStore();
		if (!scope) return callback ? super.connect(callback) : super.connect();
		if (callback) {
			this.acquire(scope, callback);
			return;
		}
		return new Promise<PoolClient>((resolve, reject) => this.acquire(scope, (error, client) => (error || !client ? reject(error ?? cancelled()) : resolve(client))));
	}
	private acquire(scope: DatabaseRequestScope, callback: ConnectCallback) {
		let delivered = false;
		const fail = (error: Error) => {
			if (delivered) return;
			delivered = true;
			scope.stopSignal.signal.removeEventListener("abort", onStop);
			callback(error, undefined, () => {});
		};
		const onStop = () => fail(cancelled());
		if (scope.stopped) {
			fail(cancelled());
			return;
		}
		scope.stopSignal.signal.addEventListener("abort", onStop, { once: true });
		super.connect((error, raw, release) => {
			if (delivered) {
				if (raw) release();
				return;
			}
			if (error || !raw) {
				fail(error ?? new Error("Database lease unavailable"));
				return;
			}
			const lease = scope.own(raw, release, this.cancelBackend);
			void Promise.resolve().then(() => {
				if (delivered || scope.stopped) {
					void lease.cancel();
					return;
				}
				delivered = true;
				scope.stopSignal.signal.removeEventListener("abort", onStop);
				callback(undefined, lease.client, lease.release);
			});
		});
	}
	override end(): Promise<void>;
	override end(callback: () => void): void;
	override end(callback?: () => void): Promise<void> | void {
		const pending = Promise.allSettled([...this.pendingCancellation])
			.then(() => super.end())
			.then(() => this.cancellationPool.end());
		if (callback) {
			void pending.then(callback, (error: unknown) => Reflect.apply(callback, undefined, [error]));
			return;
		}
		return pending;
	}
}

/** Provider credential rotation must finish its encrypted persistence independently of caller cancellation. */
export function withoutDatabaseRequest<T>(operation: () => Promise<T>): Promise<T> {
	return requests.exit(operation);
}

/** Keep ownership through streamed MCP results; stream cancellation also closes outstanding leases. */
export async function withDatabaseRequest(signal: AbortSignal, operation: () => Promise<Response>): Promise<Response> {
	const scope = new DatabaseRequestScope(signal);
	const pending = requests.run(scope, operation);
	void pending.then(
		(response) => {
			if (scope.stopped) void response.body?.cancel().catch(() => {});
		},
		() => {},
	);
	try {
		const response = await Promise.race([pending, scope.interrupted]);
		if (signal.aborted) {
			await scope.stop();
			return Response.json({ error: "invalid_request" }, { status: 400 });
		}
		if (!response.body) {
			await scope.stop();
			return response;
		}
		const reader = response.body.getReader();
		const body = new ReadableStream<Uint8Array>({
			async pull(controller) {
				try {
					const value = await reader.read();
					if (value.done) {
						await scope.stop();
						reader.releaseLock();
						controller.close();
					} else controller.enqueue(value.value);
				} catch {
					await scope.stop();
					controller.error(new Error("MCP response unavailable"));
				}
			},
			async cancel(reason) {
				await Promise.allSettled([reader.cancel(reason), scope.stop()]);
			},
		});
		return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
	} catch (error) {
		await scope.stop();
		if (signal.aborted) return Response.json({ error: "invalid_request" }, { status: 400 });
		throw error;
	}
}
