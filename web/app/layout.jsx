export const metadata = {
  title: "LIFE180% — Remote Lock / Ring / Shutdown",
  description: "Control your lost Android phone from the web with your Google account, or by SMS / WhatsApp command."
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
