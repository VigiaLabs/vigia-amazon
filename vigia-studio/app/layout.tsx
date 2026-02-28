import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'VIGIA Studio',
  description: 'Geospatial Intelligence IDE',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden bg-bg-base text-text-primary font-ui">
        {children}
      </body>
    </html>
  );
}
