import { useState, useEffect, useCallback } from "react";
import {
  getTestSuites,
  getTestSuite,
  updateTestSuite,
  summarizeCode,
} from "../api";
import ValidatorHeader from "./Validator/ValidatorHeader";
import ChatPanel from "./Validator/ChatPanel";
import PlanView from "./Validator/PlanView";
import TestRunner from "./Validator/TestRunner";
import DiffSummary from "./Validator/DiffSummary";
import VersionHistory from "./Validator/VersionHistory";

export default function Validator() {
  const [suites, setSuites] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState("");
  const [entityId, setEntityId] = useState("");

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
    getTestSuites().then(setSuites).catch(() => {});
  }, []);

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

  const renderContent = () => {
    if (!selectedSuite) {
      return (
        <div style={{ color: "var(--text-muted)", padding: "2rem 0", gridColumn: "1 / -1" }}>
          Select a test suite to get started.
        </div>
      );
    }

    if (loading) {
      return (
        <div style={{ color: "var(--text-muted)", padding: "2rem 0", gridColumn: "1 / -1" }}>
          Loading...
        </div>
      );
    }

    return (
      <>
        <div className="validator-panel">
          <ChatPanel
            code={code}
            messages={chatMessages}
            setMessages={setChatMessages}
            onAIResponse={handleAIResponse}
            setError={setError}
          />
        </div>
        <div className="validator-panel">
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, gap: "0.5rem" }}>
            {pendingCode && (
              <DiffSummary
                changeDescription={pendingChanges}
                newSummary={pendingSummary}
                isNew={isNewGeneration}
                onApply={handleApply}
                onReject={handleReject}
              />
            )}
            <div style={{ flex: 1, minHeight: 0 }}>
              <PlanView
                summary={pendingSummary || summary}
                code={pendingCode || code}
                isPending={!!pendingCode}
              />
            </div>
            <div style={{ flexShrink: 0 }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: "12px", padding: "0.35rem 0.75rem", width: "100%" }}
                onClick={() => setShowVersions(!showVersions)}
              >
                {showVersions ? "Hide History" : "Version History"}
              </button>
              {showVersions && (
                <VersionHistory
                  key={versionKey}
                  suiteId={selectedSuite}
                  onRestore={handleVersionRestore}
                  onClose={() => setShowVersions(false)}
                />
              )}
            </div>
          </div>
        </div>
        <div className="validator-panel">
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <TestRunner
              selectedSuite={selectedSuite}
              entityId={entityId}
              suites={suites}
            />
          </div>
        </div>
      </>
    );
  };

  return (
    <section style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      minHeight: 0,
      overflow: "hidden",
    }}>
      <div style={{ flexShrink: 0 }}>
        <ValidatorHeader
          selectedSuite={selectedSuite}
        setSelectedSuite={setSelectedSuite}
        entityId={entityId}
        setEntityId={setEntityId}
        suites={suites}
        setSuites={setSuites}
        />
      </div>

      {error && (
        <p style={{ color: "var(--error)", fontSize: "13px", marginBottom: "1rem", flexShrink: 0 }}>
          {error}
        </p>
      )}

      <div
        className="validator-three-panel"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 2fr 1fr",
          gap: "1rem",
          flex: 1,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {renderContent()}
      </div>
    </section>
  );
}
