import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Brutal Fist',
  description: 'Bannon mobile fighting-game workspace',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', background: '#050508' }}>{children}</body>
    </html>
  );
}
