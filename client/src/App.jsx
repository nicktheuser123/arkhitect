import { useState } from "react";
import "./App.css";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Auth from "./components/Auth";
import Layout from "./components/Layout";
import Setup from "./components/Setup";
import Validator from "./components/Validator";

function AppContent() {
  const { user, loading, signOut } = useAuth();
  const [mainTab, setMainTab] = useState("setup");

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: "100vh", background: "#0e0e10", color: "#888",
      }}>
        Loading...
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <Layout>
      <div className="tabs" style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
        <button
          className={mainTab === "setup" ? "active" : ""}
          onClick={() => setMainTab("setup")}
        >
          Setup
        </button>
        <button
          className={mainTab === "validator" ? "active" : ""}
          onClick={() => setMainTab("validator")}
        >
          Validator
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ color: "#888", fontSize: 12, marginRight: 8 }}>
          {user.email}
        </span>
        <button
          onClick={signOut}
          style={{
            background: "none", border: "1px solid #444", color: "#aaa",
            borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12,
          }}
        >
          Sign Out
        </button>
      </div>

      <div className="layout-content" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {mainTab === "setup" && <Setup />}
        {mainTab === "validator" && <Validator />}
      </div>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
