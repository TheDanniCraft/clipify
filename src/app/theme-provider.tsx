"use client";

import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	if (isEmbeddedRoute(pathname)) return <>{children}</>;

	return (
		<NextThemesProvider attribute='class' defaultTheme='dark' enableSystem={false} disableTransitionOnChange>
			{children}
		</NextThemesProvider>
	);
}
