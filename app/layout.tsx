import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mars Survival | Mission Risk Intelligence",
  description: "Plan, compare and simulate transparent round-trip Mars expeditions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
