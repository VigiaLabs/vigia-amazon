import type { Metadata } from 'next';
import './globals.css';
import { SettingsProvider } from './components/SettingsContext';

export const metadata: Metadata = {
  title: 'VIGIA — Road Intelligence IDE',
  description: 'Sentient Road Infrastructure System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%', overflow: 'hidden' }}>
      <body style={{
        height: '100%',
        overflow: 'hidden',
        background: 'var(--c-bg)',
        color: 'var(--c-text)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        margin: 0, padding: 0,
        transition: 'background 0.2s, color 0.2s',
      }}>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
