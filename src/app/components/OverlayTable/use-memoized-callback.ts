/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";

type noop = (this: any, ...args: any[]) => any;

export function useMemoizedCallback<T extends noop>(fn: T) {
	const fnRef = useRef<T>(fn);

	// why not write `fnRef.current = fn`?
	// https://github.com/alibaba/hooks/issues/728
	useEffect(() => {
		fnRef.current = fn;
	}, [fn]);

	return ((...args: Parameters<T>) => fnRef.current.apply(undefined, args)) as T;
}
