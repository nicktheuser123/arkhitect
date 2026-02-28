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
      minHeight: "100vh", background: "#0e0e10",
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "#1a1a2e", borderRadius: 12, padding: 32,
        width: 360, display: "flex", flexDirection: "column", gap: 16,
        border: "1px solid #2a2a3e",
      }}>
        <h2 style={{ margin: 0, color: "#e0e0e0", textAlign: "center" }}>
          {isSignUp ? "Create Account" : "Sign In"}
        </h2>

        {error && (
          <div style={{
            background: "#3a1a1a", color: "#ff6b6b", padding: "8px 12px",
            borderRadius: 6, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {confirmMsg && (
          <div style={{
            background: "#1a3a2a", color: "#6bffb8", padding: "8px 12px",
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
            padding: "10px 12px", borderRadius: 6, border: "1px solid #333",
            background: "#121220", color: "#e0e0e0", fontSize: 14,
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
            padding: "10px 12px", borderRadius: 6, border: "1px solid #333",
            background: "#121220", color: "#e0e0e0", fontSize: 14,
            outline: "none",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "10px 0", borderRadius: 6, border: "none",
            background: loading ? "#444" : "#5b5fc7", color: "#fff",
            fontSize: 14, fontWeight: 600, cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>

        <p style={{ margin: 0, textAlign: "center", color: "#888", fontSize: 13 }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(null); setConfirmMsg(null); }}
            style={{
              background: "none", border: "none", color: "#7b7fc7",
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
