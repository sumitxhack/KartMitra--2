import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KartMitra - AI Verification Lab",
  description: "Barcode scan & verification system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <main className="min-h-screen bg-gray-50 flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
