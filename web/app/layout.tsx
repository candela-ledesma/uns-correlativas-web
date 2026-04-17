import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Sora } from "next/font/google";
import Providers from "@/app/providers";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: {
    default: "Planes de estudio UNS",
    template: "%s",
  },
  description: "Explorá planes de estudio y correlativas de la UNS.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body className={`${manrope.variable} ${sora.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}