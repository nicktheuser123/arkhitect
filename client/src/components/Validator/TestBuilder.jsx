import { useState, useEffect, useCallback } from "react";
import {
  getTestSuite,
  updateTestSuite,
  summarizeCode,
} from "../../api";
import ChatPanel from "./ChatPanel";
import PlanView from "./PlanView";
import DiffSummary from "./DiffSummary";
import VersionHistory from "./VersionHistory";

export default function TestBuilder({ selectedSuite, entityId, suites }) {
  const [suite, setSuite] = useState(null);
  const [code, setCode] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [pendingCode, setPendingCode] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(null);
  const [pendingSummary, setPendingSummary] = useState(null);
  const [isNewGeneration, setIsNewGeneration] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versionKey, setVersionKey] = useState(0);

  useEffect(() => {
    if (!selectedSuite) {
      setSuite(null);
      setCode("");
      setSummary("");
      setChatMessages([]);
      setPendingCode(null);
      setPendingChanges(null);
      setPendingSummary(null);
      return;
    }
    setLoading(true);
    getTestSuite(selectedSuite)
      .then((s) => {
        setSuite(s);
        setCode(s.calculator_code || "");
        setSummary(s.summary || "");
        setChatMessages([]);
        setPendingCode(null);
        setPendingChanges(null);
        setPendingSummary(null);
        if (s.calculator_code && s.calculator_code.trim() && !s.summary) {
          summarizeCode(s.calculator_code)
            .then((r) => setSummary(r.summary))
            .catch(() => {});
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedSuite]);

  const handleAIResponse = useCallback((result, isNew) => {
    setPendingCode(result.code);
    setPendingSummary(result.summary);
    setPendingChanges(result.changeDescription || null);
    setIsNewGeneration(isNew);
  }, []);

  const handleApply = useCallback(async () => {
    if (!pendingCode || !selectedSuite) return;
    setError("");
    try {
      await updateTestSuite(selectedSuite, {
        calculator_code: pendingCode,
        created_by: "ai",
        change_description: pendingChanges || (isNewGeneration ? "Initial generation via chat" : "AI edit"),
        summary: pendingSummary,
      });
      setCode(pendingCode);
      setSummary(pendingSummary || "");
      setSuite((s) => (s ? { ...s, calculator_code: pendingCode } : null));
      setPendingCode(null);
      setPendingChanges(null);
      setPendingSummary(null);
      setVersionKey((k) => k + 1);
      setChatMessages((msgs) => [
        ...msgs,
        { role: "system", content: "Changes applied and saved." },
      ]);
    } catch (e) {
      setError(e.message);
    }
  }, [pendingCode, pendingChanges, pendingSummary, selectedSuite, isNewGeneration]);

  const handleReject = useCallback(() => {
    setPendingCode(null);
    setPendingChanges(null);
    setPendingSummary(null);
    setChatMessages((msgs) => [
      ...msgs,
      { role: "system", content: "Changes discarded." },
    ]);
  }, []);

  const handleVersionRestore = useCallback((restoredSuite) => {
    setCode(restoredSuite.calculator_code || "");
    setSuite(restoredSuite);
    setPendingCode(null);
    setPendingChanges(null);
    setPendingSummary(null);
    setVersionKey((k) => k + 1);
    if (restoredSuite.summary) {
      setSummary(restoredSuite.summary);
    } else if (restoredSuite.calculator_code && restoredSuite.calculator_code.trim()) {
      summarizeCode(restoredSuite.calculator_code)
        .then((r) => setSummary(r.summary))
        .catch(() => {});
    } else {
      setSummary("");
    }
  }, []);

  if (!selectedSuite) {
    return (
      <div style={{ color: "var(--text-muted)", padding: "2rem 0" }}>
        Select a test suite to get started.
      </div>
    );
  }

  if (loading) {
    return <div style={{ color: "var(--text-muted)", padding: "2rem 0" }}>Loading...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 500, margin: 0 }}>
          Test Builder
        </h2>
        <button
          className="btn btn-secondary"
          style={{ fontSize: "12px", padding: "0.35rem 0.75rem" }}
          onClick={() => setShowVersions(!showVersions)}
        >
          {showVersions ? "Hide History" : "Version History"}
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      {showVersions && (
        <VersionHistory
          key={versionKey}
          suiteId={selectedSuite}
          onRestore={handleVersionRestore}
          onClose={() => setShowVersions(false)}
        />
      )}

      {pendingCode && (
        <DiffSummary
          changeDescription={pendingChanges}
          newSummary={pendingSummary}
          isNew={isNewGeneration}
          onApply={handleApply}
          onReject={handleReject}
        />
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "1rem",
        minHeight: "500px",
      }}>
        <ChatPanel
          code={code}
          messages={chatMessages}
          setMessages={setChatMessages}
          onAIResponse={handleAIResponse}
          setError={setError}
        />
        <PlanView
          summary={pendingSummary || summary}
          code={pendingCode || code}
          isPending={!!pendingCode}
        />
      </div>
    </div>
  );
}
