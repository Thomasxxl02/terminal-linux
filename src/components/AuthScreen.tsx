import React, { useState } from "react";

interface AuthScreenProps {
  onLogin: (staticToken: string) => Promise<void>;
}

/**
 * Écran de connexion : demande le token statique configuré côté serveur
 * (ADMIN_TOKEN / DEV_TOKEN / GUEST_TOKEN dans .env), échangé contre un JWT.
 */
export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(token.trim());
    } catch (err: any) {
      setError(err.message || "Échec de l'authentification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900/60 p-8 shadow-2xl"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-600/20 text-2xl">
            🖥️
          </div>
          <h1 className="text-lg font-bold">Terminal Linux</h1>
          <p className="mt-1 text-xs text-slate-400">
            Authentification requise — entrez votre token d'accès
          </p>
        </div>

        <label className="mb-1 block text-xs font-medium text-slate-400" htmlFor="auth-token">
          Token d'accès
        </label>
        <input
          id="auth-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="••••••••••••"
          autoFocus
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500"
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !token.trim()}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-600">
          Le token est fourni par l'administrateur du serveur
          (ADMIN_TOKEN / DEV_TOKEN / GUEST_TOKEN).
        </p>
      </form>
    </div>
  );
}
