import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mars Survival | Inteligencia de misión",
  description: "Planifica, compara y simula expediciones marcianas con un modelo científico transparente.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
