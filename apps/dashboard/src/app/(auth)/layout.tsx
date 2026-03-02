export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-sf-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-sf-accent tracking-tight">
            SessionForge
          </h1>
          <p className="text-sf-text-secondary text-sm mt-1">
            Mine your Claude sessions. Ship content.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
