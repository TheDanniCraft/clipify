export const EMBEDDED_ROUTE_PREFIXES = ["/embed", "/overlay", "/demoPlayer", "/gallery/"] as const;

const GALLERY_PREVIEW_ROUTE = /^\/dashboard\/galleries\/[^/]+\/preview(?:\/|$)/;

export function isEmbeddedRoute(pathname: string) {
	return EMBEDDED_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) || GALLERY_PREVIEW_ROUTE.test(pathname);
}
