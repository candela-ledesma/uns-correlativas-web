export const metadata = {
  title: "UNS Correlativas",
  description: "Visualizador de correlativas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}