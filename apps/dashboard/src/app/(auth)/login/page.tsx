"use client";

import { signIn } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await signIn.email({
      email,
      password,
    });

    if (authError) {
      setError(authError.message || "Invalid credentials");
      setLoading(false);
      return;
    }

    router.push("/");
  }

  async function handleGitHub() {
    await signIn.social({ provider: "github", callbackURL: "/" });
  }

  return (
    <div className="bg-sf-bg-secondary border border-sf-border rounded-sf-lg p-6">
      <h2 className="text-lg font-semibold text-sf-text-primary mb-4">
        Sign in
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-sf-text-secondary mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm text-sf-text-secondary mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-sf-bg-tertiary border border-sf-border rounded-sf px-3 py-2 text-sf-text-primary placeholder:text-sf-text-muted focus:border-sf-border-focus focus:outline-none"
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <p className="text-sf-danger text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-sf-accent text-sf-bg-primary font-medium py-2 rounded-sf hover:bg-sf-accent-dim transition-colors disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="flex-1 h-px bg-sf-border" />
        <span className="text-sf-text-muted text-xs">or</span>
        <div className="flex-1 h-px bg-sf-border" />
      </div>

      <button
        onClick={handleGitHub}
        className="w-full bg-sf-bg-tertiary border border-sf-border text-sf-text-primary py-2 rounded-sf hover:bg-sf-bg-hover transition-colors"
      >
        Continue with GitHub
      </button>

      <p className="text-center text-sf-text-muted text-sm mt-4">
        No account?{" "}
        <Link href="/signup" className="text-sf-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
