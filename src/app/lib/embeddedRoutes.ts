export const EMBEDDED_ROUTE_PREFIXES = ["/embed", "/overlay", "/demoPlayer", "/gallery/"] as const;

export function isEmbeddedRoute(pathname: string) {
	return EMBEDDED_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}
