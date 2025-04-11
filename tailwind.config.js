const { heroui } = require("@heroui/react");
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        // ...
        // make sure it's pointing to the ROOT node_module
        "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    darkMode: "class",
    plugins: [heroui({
        themes: {
            light: {
                colors: {
                    primary: {
                        DEFAULT: "#5F06F5",
                        foreground: "#FFFFFF",
                        50: "#F4E9FF",
                        100: "#E6CCFE",
                        200: "#CB9AFE",
                        300: "#AA68FC",
                        400: "#8D42F9",
                        500: "#5F06F5",
                        600: "#4904D2",
                        700: "#3603B0",
                        800: "#26018E",
                        900: "#1A0175"
                    },
                    secondary: {
                        DEFAULT: "#D23B5D",
                        50: "#F8D0D6",
                        100: "#F0A8B3",
                        200: "#E77D91",
                        300: "#E05A6F",
                        400: "#D73A4D",
                        500: "#D23B5D",
                        600: "#B72F4F",
                        700: "#9B2440",
                        800: "#7F1932",
                        900: "#631127"
                    },
                    accent: {
                        DEFAULT: "#4FB9B8",
                        50: "#D7F9F9",
                        100: "#A3F0F0",
                        200: "#6EE8E8",
                        300: "#3AC0C0",
                        400: "#1D9B9B",
                        500: "#4FB9B8",
                        600: "#1D8787",
                        700: "#176666",
                        800: "#114545",
                        900: "#0A2C2C"
                    },
                    background: "#f9fafb",
                    foreground: "#1c1c1e"
                }
            },
            dark: {
                colors: {
                    background: "#242429",
                    primary: {
                        DEFAULT: "#5F06F5",
                        foreground: "#FFFFFF",
                        50: "#F4E9FF",
                        100: "#E6CCFE",
                        200: "#CB9AFE",
                        300: "#AA68FC",
                        400: "#8D42F9",
                        500: "#5F06F5",
                        600: "#4904D2",
                        700: "#3603B0",
                        800: "#26018E",
                        900: "#1A0175"
                    },
                    secondary: {
                        DEFAULT: "#D23B5D",
                        50: "#F8D0D6",
                        100: "#F0A8B3",
                        200: "#E77D91",
                        300: "#E05A6F",
                        400: "#D73A4D",
                        500: "#D23B5D",
                        600: "#B72F4F",
                        700: "#9B2440",
                        800: "#7F1932",
                        900: "#631127"
                    },
                    accent: {
                        DEFAULT: "#4FB9B8",
                        50: "#D7F9F9",
                        100: "#A3F0F0",
                        200: "#6EE8E8",
                        300: "#3AC0C0",
                        400: "#1D9B9B",
                        500: "#4FB9B8",
                        600: "#1D8787",
                        700: "#176666",
                        800: "#114545",
                        900: "#0A2C2C"
                    },
                    foreground: "#f0f0f4"
                }
            }
        }
    })],
};