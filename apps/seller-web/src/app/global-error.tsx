'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ padding: 40, fontFamily: 'monospace', background: '#1a1a1a', color: '#fff' }}>
        <h2>Error capturado:</h2>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#ff6b6b', background: '#2d2d2d', padding: 16, borderRadius: 8 }}>
          {error.message}
        </pre>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#999', fontSize: 12, marginTop: 8 }}>
          {error.stack}
        </pre>
        <button
          onClick={() => reset()}
          style={{ marginTop: 20, padding: '10px 20px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
