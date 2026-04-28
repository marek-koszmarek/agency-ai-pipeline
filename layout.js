import "./globals.css";

export const metadata = {
  title: "Agency AI Pipeline",
  description: "Researcher → Creative → Analyst",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
