import "./globals.css";
export const metadata = { title: "Luzny Roman", description: "Twój kretatywny partner agencyjny" };
export default function RootLayout({ children }) {
  return <html lang="pl"><body>{children}</body></html>;
}
