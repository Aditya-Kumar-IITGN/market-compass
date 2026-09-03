import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — QuantDesk" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { toast.error(error.message ?? "Google sign in failed"); setBusy(false); return; }
  };

  return (
    <div className="dark min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-sm border border-border/60 rounded-lg bg-surface/40 p-6 space-y-5">
        <div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">← Back to charts</Link>
          <h1 className="mt-3 text-xl font-semibold">
            QUANT<span className="text-primary">DESK</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup" ? "Create an account" : "Sign in to your account"}
          </p>
        </div>

        <button
          onClick={google}
          disabled={busy}
          className="w-full h-9 rounded border border-border bg-surface-2 hover:bg-surface text-sm font-medium disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border/60" /> or <div className="h-px flex-1 bg-border/60" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase text-muted-foreground">Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase text-muted-foreground">Password</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full bg-input border border-border rounded px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={busy}
            className="w-full h-9 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {mode === "signup" ? "Sign up" : "Sign in"}
          </button>
        </form>

        <button
          onClick={() => setMode((m) => (m === "signup" ? "signin" : "signup"))}
          className="w-full text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </div>
    </div>
  );
}
