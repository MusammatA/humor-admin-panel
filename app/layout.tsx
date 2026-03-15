import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humor Admin Panel",
  description: "Admin interface for humor project",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="admin-theme-bootstrap" strategy="beforeInteractive">
          {`
            try {
              var theme = window.localStorage.getItem("admin_theme");
              document.documentElement.classList.toggle("dark", theme === "dark");
            } catch (error) {}
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}
