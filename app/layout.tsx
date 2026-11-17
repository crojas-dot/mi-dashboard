import type { Metadata } from "next"
import "./globals.css"
import ToastProvider from "@/lib/providers/ToastProvider"
import AuthShell from "@/components/AuthShell"

export const metadata: Metadata = {
  title: "ECA-QMS | Sistema de Gestión de Calidad",
  description: "Ente Costarricense de Acreditación",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="select-none">
        <AuthShell>{children}</AuthShell>
        <ToastProvider />
      </body>
    </html>
  )
}
