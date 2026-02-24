import { useState } from "react";
import "./App.css";
import Layout from "./components/Layout";
import Setup from "./components/Setup";
import Validator from "./components/Validator";

function App() {
  const [mainTab, setMainTab] = useState("setup");

  return (
    <Layout>
      <div className="tabs" style={{ flexShrink: 0 }}>
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
      </div>

      <div className="layout-content" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {mainTab === "setup" && <Setup />}
        {mainTab === "validator" && <Validator />}
      </div>
    </Layout>
  );
}

export default App;
