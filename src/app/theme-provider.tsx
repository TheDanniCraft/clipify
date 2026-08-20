"use client";

import { isEmbeddedRoute } from "@lib/embeddedRoutes";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	const isEmbedded = isEmbeddedRoute(pathname);

	return (
		<NextThemesProvider attribute='class' defaultTheme='dark' enableSystem={false} disableTransitionOnChange enableColorScheme={!isEmbedded}>
			{children}
		</NextThemesProvider>
	);
}
