import { useState, useEffect, useCallback } from "react";
import {
  getTestSuites,
  getTestSuite,
  editCode,
  refineCode,
  confirmTestSuite,
} from "../api";
import ValidatorHeader from "./Validator/ValidatorHeader";
import ChatPanel from "./Validator/ChatPanel";
import TestRunner from "./Validator/TestRunner";
import VersionHistory from "./Validator/VersionHistory";

export default function Validator() {
  const [suites, setSuites] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState("");
  const [entityId, setEntityId] = useState(() => {
    return localStorage.getItem("arkhitect_lastEntityId") || "";
  });

  const [suite, setSuite] = useState(null);
  const [hasCode, setHasCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [assumptions, setAssumptions] = useState([]);
  const [confirmedSet, setConfirmedSet] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);

  const [showVersions, setShowVersions] = useState(false);
  const [versionKey, setVersionKey] = useState(0);
  const [displayRun, setDisplayRun] = useState(null);

  useEffect(() => {
    getTestSuites().then(setSuites).catch(() => {});
  }, []);

  useEffect(() => {
    if (entityId) localStorage.setItem("arkhitect_lastEntityId", entityId);
  }, [entityId]);

  useEffect(() => {
    if (!selectedSuite) {
      setSuite(null);
      setHasCode(false);
      setAssumptions([]);
      setConfirmedSet(new Set());
      return;
    }
    setLoading(true);
    getTestSuite(selectedSuite)
      .then((s) => {
        setSuite(s);
        setHasCode(!!(s.calculator_code && s.calculator_code.trim()));
        setAssumptions([]);
        setConfirmedSet(new Set());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedSuite]);

  const handleChatResult = useCallback((result) => {
    if (result.hasCode != null) setHasCode(result.hasCode);
    setAssumptions(result.assumptions || []);
    setConfirmedSet(new Set());
  }, []);

  const handleDisplayRunChange = useCallback((run) => {
    setDisplayRun(run);
  }, []);

  const handleConfirmAssumption = useCallback((id) => {
    setConfirmedSet((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleCorrection = useCallback(async (assumptionId, correctionText) => {
    setError("");
    setRefining(true);
    try {
      const result = await refineCode(selectedSuite, [
        { assumptionId, correction: correctionText },
      ]);
      setAssumptions(result.assumptions || []);
      setConfirmedSet(new Set());
      setHasCode(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setRefining(false);
    }
  }, [selectedSuite]);

  const handleConfirmAll = useCallback(async () => {
    if (!selectedSuite) return;
    setError("");
    try {
      const updated = await confirmTestSuite(selectedSuite, assumptions);
      setSuite(updated);
      setHasCode(!!(updated.calculator_code && updated.calculator_code.trim()));
      setAssumptions([]);
      setConfirmedSet(new Set());
      setVersionKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    }
  }, [selectedSuite, assumptions]);

  const handleTraceFeedback = useCallback(async (feedbackText) => {
    setError("");
    setGenerating(true);
    try {
      const result = await editCode(selectedSuite, feedbackText);
      setAssumptions(result.assumptions || []);
      setConfirmedSet(new Set());
      setHasCode(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [selectedSuite]);

  const handleVersionRestore = useCallback((restoredSuite) => {
    setSuite(restoredSuite);
    setHasCode(!!(restoredSuite.calculator_code && restoredSuite.calculator_code.trim()));
    setAssumptions(restoredSuite.assumptions || []);
    setConfirmedSet(new Set());
    setVersionKey((k) => k + 1);
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

    const testContext = {
      entityId,
      expectedVsReceived: displayRun?.expected_vs_received,
      traceSteps: displayRun?.trace_steps,
    };

    return (
      <>
        <div className="validator-panel" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: 0, flex: 1, overflow: "hidden" }}>
          <ChatPanel
            suiteId={selectedSuite}
            hasCode={hasCode}
            testContext={testContext}
            onResult={handleChatResult}
            onError={setError}
            assumptions={assumptions}
            confirmedSet={confirmedSet}
            confirmedAssumptions={suite?.assumptions || []}
            onConfirm={handleConfirmAssumption}
            onCorrection={handleCorrection}
            onConfirmAll={handleConfirmAll}
            refining={refining}
          />

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

        <div className="validator-panel">
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <TestRunner
              selectedSuite={selectedSuite}
              entityId={entityId}
              suites={suites}
              onFeedback={handleTraceFeedback}
              onDisplayRunChange={handleDisplayRunChange}
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
          gridTemplateColumns: "1fr 1.5fr",
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
