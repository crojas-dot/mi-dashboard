import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import QueryProvider from "@/lib/providers/QueryProvider"
import ToastProvider from "@/lib/providers/ToastProvider"
import AuthShell from "@/components/AuthShell"

export const metadata: Metadata = {
  title: "ECA-QMS | Sistema de Gestión de Calidad",
  description: "Ente Costarricense de Acreditación",
}

const inter = Inter({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.className} select-none`}>
        <QueryProvider>
          <AuthShell>{children}</AuthShell>
          <ToastProvider />
        </QueryProvider>
      </body>
    </html>
  )
}
