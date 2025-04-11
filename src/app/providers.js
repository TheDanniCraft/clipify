'use client'

import { HeroUIProvider } from '@heroui/react'
import { ThemeProvider as NextThemesProvider, ThemeProvider } from "next-themes";

export function Providers({ children }) {
    return (
        <HeroUIProvider>
            <ThemeProvider attribute="class" defaultTheme="dark" >
                {children}
            </ThemeProvider>
        </HeroUIProvider>
    )
}