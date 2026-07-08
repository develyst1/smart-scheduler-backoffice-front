"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { DatesProvider } from "@mantine/dates";
import { Notifications } from "@mantine/notifications";
import { QueryProvider } from "@/context/query/QueryProvider";
import "dayjs/locale/th";

// Dark gray-black back-office theme with a green primary (money / management).
// No SessionProvider yet — auth lands in a later wave; keep the shell runnable.
const theme = createTheme({
  primaryColor: "green",
  primaryShade: 6,
  fontFamily: "var(--font-noto-sans-thai), system-ui, sans-serif",
  headings: { fontFamily: "var(--font-noto-sans-thai), system-ui, sans-serif" },
  defaultRadius: "md",
  cursorType: "pointer",
  shadows: {
    sm: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
    md: "0 4px 12px rgba(0,0,0,0.45)",
  },
  components: {
    Card: { defaultProps: { shadow: "sm", radius: "lg", withBorder: true } },
    Paper: { defaultProps: { radius: "lg" } },
    DatePickerInput: { styles: { input: { textAlign: "right" as const } } },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <DatesProvider settings={{ locale: "th", firstDayOfWeek: 0 }}>
        <Notifications position="top-right" autoClose={4000} />
        <QueryProvider>{children}</QueryProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
