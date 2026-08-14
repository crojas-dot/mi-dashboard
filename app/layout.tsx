import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import QueryProvider from "@/lib/providers/QueryProvider"
import ToastProvider from "@/lib/providers/ToastProvider"
import AuthShell from "@/components/AuthShell"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" })
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" })

export const metadata: Metadata = {
  title: { default: "ECA-QMS", template: "%s | ECA-QMS" },
  description: "Sistema de Gestión de Calidad del Ente Costarricense de Acreditación",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1522" },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className="bg-background" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
        <QueryProvider>
          <AuthShell>{children}</AuthShell>
          <ToastProvider />
        </QueryProvider>
      </body>
    </html>
  )
}
