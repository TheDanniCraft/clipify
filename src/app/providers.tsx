"use client";

import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { NavigationGuardProvider } from "next-navigation-guard";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
	return (
		<HeroUIProvider>
			<ThemeProvider attribute='class' defaultTheme='dark'>
				<NavigationGuardProvider>
					<ToastProvider />
					{children}
				</NavigationGuardProvider>
			</ThemeProvider>
		</HeroUIProvider>
	);
}
