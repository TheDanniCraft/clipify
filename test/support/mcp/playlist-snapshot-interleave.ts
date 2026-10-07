import type { Pool } from "pg";

/** Interleave an independent commit after the actual parent query on the application pool. */
export function interleavePlaylistWriter(writerPool: Pool) {
	const pool = (globalThis as any).__dbPool as Pool;
	if (!pool) throw new Error("Application query pool is unavailable");
	let committed = false;
	let interleaving = false;
	const originalQuery = pool.query.bind(pool);
	const originalConnect = pool.connect.bind(pool);
	const afterQuery = async (arguments_: any[], result: unknown) => {
		const text = typeof arguments_[0] === "string" ? arguments_[0] : arguments_[0]?.text;
		if (!interleaving && typeof text === "string" && text.includes('from "playlists"') && text.startsWith('select "id", "owner_id"')) {
			interleaving = true;
			const writer = await writerPool.connect();
			try {
				await writer.query("BEGIN");
				await writer.query("UPDATE playlists SET name='Concurrent playlist',configuration_revision=2 WHERE id='a1dca8b8-089a-47ce-b649-1c32bb3842c1'");
				await writer.query("UPDATE playlist_clips SET clip_data=$1 WHERE clip_id='ClipFirst'", [JSON.stringify({ id: "ClipFirst", title: "Concurrent clip", duration: 20 })]);
				await writer.query("COMMIT");
				committed = true;
			} catch (error) {
				await writer.query("ROLLBACK");
				throw error;
			} finally {
				writer.release();
			}
		}
		return result;
	};
	const query = (original: any, arguments_: any[]) => {
		const callback = arguments_.at(-1);
		if (typeof callback === "function")
			return original(...arguments_.slice(0, -1), (error: unknown, result: unknown) => {
				if (error) callback(error, result);
				else
					void afterQuery(arguments_, result).then(
						(value) => callback(null, value),
						(error) => callback(error),
					);
			});
		return original(...arguments_).then((result: unknown) => afterQuery(arguments_, result));
	};
	const wrapClient = (client: any) =>
		new Proxy(client, {
			get(target, property) {
				const value = Reflect.get(target, property);
				if (property === "query") return (...args: any[]) => query(value.bind(target), args);
				return typeof value === "function" ? value.bind(target) : value;
			},
		});
	(pool as any).query = (...args: any[]) => query(originalQuery, args);
	(pool as any).connect = (callback?: any) => (typeof callback === "function" ? originalConnect((error, client, release) => callback(error, client ? wrapClient(client) : client, release)) : originalConnect().then(wrapClient));
	return {
		committed: () => committed,
		restore: () => {
			pool.query = originalQuery;
			pool.connect = originalConnect;
		},
	};
}
