"use client";
import { useEffect, useState } from "react";
import { startRunnerConnectionTest, readRunnerConnectionTest, stopRunnerConnectionTest } from "@/app/actions/runner";
export function useConnectionTest(ownerId: string, runnerId: string, onError: (message: string | null) => void) {
	const [duration, setDuration] = useState("60");
	const [test, setTest] = useState<{ id: string; state: string; expiresAt: string; outputs: { id: string; state: string }[] } | null>(null);
	const [pending, setPending] = useState(false);
	const id = test?.id,
		state = test?.state;
	useEffect(() => {
		if (!id || state === "stopped") return;
		let current = true;
		const timer = setInterval(() => {
			void readRunnerConnectionTest({ ownerId, id })
				.then((result) => {
					if (!current) return;
					if (result.success) setTest(result.test);
					else onError(result.error);
				})
				.catch(() => {
					if (current) onError("Could not read test status. Your test still ends automatically.");
				});
		}, 2000);
		return () => {
			current = false;
			clearInterval(timer);
		};
	}, [ownerId, id, state, onError]);
	async function start(connectionId: string) {
		if (pending) return;
		setPending(true);
		onError(null);
		try {
			const result = await startRunnerConnectionTest({ ownerId, runnerId, connectionId, durationSeconds: Number(duration) });
			if (result.success) setTest({ ...result.test, state: "starting", outputs: [] });
			else onError(result.error);
		} catch {
			onError("Could not start the test. Please try again.");
		} finally {
			setPending(false);
		}
	}
	async function stop() {
		if (!test || test.state === "stopped") return true;
		setPending(true);
		onError(null);
		try {
			const result = await stopRunnerConnectionTest({ ownerId, id: test.id });
			if (result.success) {
				setTest(result.test);
				return true;
			}
			onError(result.error);
			return false;
		} catch {
			onError("Could not stop the test. Please try again.");
			return false;
		} finally {
			setPending(false);
		}
	}
	return { duration, setDuration, test, pending, start, stop, reset: () => setTest(null) };
}
