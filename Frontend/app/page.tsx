export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-blue-50 px-6 text-center text-blue-900">
      <p className="text-sm font-medium uppercase tracking-widest text-blue-700/70">
        Aura
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Frontend scaffold ready
      </h1>
      <p className="max-w-md text-blue-800/80">
        Next.js + Zustand + Tailwind + Recharts on port 3001. Design and API
        integration come next.
      </p>
      <p className="text-xs text-blue-700/60">
        Aura is not a medical device and does not diagnose.
      </p>
    </main>
  );
}
