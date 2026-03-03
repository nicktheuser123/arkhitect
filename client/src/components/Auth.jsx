import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setConfirmMsg(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setConfirmMsg("Check your email to confirm your account.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0c0c0d",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#18181b", borderRadius: 12, padding: 32,
        width: 360, display: "flex", flexDirection: "column", gap: 16,
        border: "1px solid #27272a",
      }}>
        <h2 style={{ margin: 0, color: "#fafafa", textAlign: "center" }}>
          {isSignUp ? "Create Account" : "Sign In"}
        </h2>

        {error && (
          <div style={{
            background: "rgba(248, 81, 73, 0.1)", color: "#f85149", padding: "8px 12px",
            borderRadius: 6, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {confirmMsg && (
          <div style={{
            background: "rgba(23, 177, 105, 0.1)", color: "#17b169", padding: "8px 12px",
            borderRadius: 6, fontSize: 13,
          }}>
            {confirmMsg}
          </div>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            padding: "10px 12px", borderRadius: 6, border: "1px solid #27272a",
            background: "#0c0c0d", color: "#fafafa", fontSize: 14,
            outline: "none",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{
            padding: "10px 12px", borderRadius: 6, border: "1px solid #27272a",
            background: "#0c0c0d", color: "#fafafa", fontSize: 14,
            outline: "none",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 0", borderRadius: 6, border: "none",
            background: loading ? "#3f3f46" : "#3aafa9", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>

        <p style={{ margin: 0, textAlign: "center", color: "#a1a1aa", fontSize: 13 }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setConfirmMsg(null); }}
            style={{
              background: "none", border: "none", color: "#3aafa9",
              cursor: "pointer", fontSize: 13, textDecoration: "underline",
              padding: 0,
            }}
          >
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </p>
      </form>
    </div>
  );
}
