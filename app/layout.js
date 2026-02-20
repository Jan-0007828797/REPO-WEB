import "./globals.css";

export const metadata = {
  title: "Kryptopoly",
  description: "Kryptopoly test menu",
};

export default function RootLayout({ children }) {
  return (
    <html lang="cs">
      <body>
        {children}
      </body>
    </html>
  );
}
