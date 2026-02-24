import { useState, useEffect, useCallback } from "react";
import {
  getTestSuites,
  getTestSuite,
  updateTestSuite,
  generateCode,
  editCode,
  refineCode,
} from "../api";
import ValidatorHeader from "./Validator/ValidatorHeader";
import PromptPanel from "./Validator/PromptPanel";
import AssumptionChecklist from "./Validator/AssumptionChecklist";
import TestRunner from "./Validator/TestRunner";
import VersionHistory from "./Validator/VersionHistory";

export default function Validator() {
  const [suites, setSuites] = useState([]);
  const [selectedSuite, setSelectedSuite] = useState("");
  const [entityId, setEntityId] = useState("");

  const [suite, setSuite] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [assumptions, setAssumptions] = useState([]);
  const [confirmedSet, setConfirmedSet] = useState(new Set());
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);

  const [showVersions, setShowVersions] = useState(false);
  const [versionKey, setVersionKey] = useState(0);

  useEffect(() => {
    getTestSuites().then(setSuites).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSuite) {
      setSuite(null);
      setCode("");
      setAssumptions([]);
      setConfirmedSet(new Set());
      return;
    }
    setLoading(true);
    getTestSuite(selectedSuite)
      .then((s) => {
        setSuite(s);
        setCode(s.calculator_code || "");
        setAssumptions(s.assumptions || []);
        setConfirmedSet(new Set());
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selectedSuite]);

  const handleGenerate = useCallback(async (prompt) => {
    setError("");
    setGenerating(true);
    try {
      const hasCode = code && code.trim();
      let result;
      if (hasCode) {
        result = await editCode(code, prompt);
      } else {
        result = await generateCode(prompt);
      }
      setCode(result.code);
      setAssumptions(result.assumptions || []);
      setConfirmedSet(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [code]);

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
      const result = await refineCode(code, [
        { assumptionId, correction: correctionText },
      ]);
      setCode(result.code);
      setAssumptions(result.assumptions || []);
      setConfirmedSet(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setRefining(false);
    }
  }, [code]);

  const handleConfirmAll = useCallback(async () => {
    if (!selectedSuite || !code) return;
    setError("");
    try {
      const updated = await updateTestSuite(selectedSuite, {
        calculator_code: code,
        assumptions,
        created_by: "ai",
        change_description: "Confirmed assumptions and saved",
      });
      setSuite(updated);
      setVersionKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    }
  }, [selectedSuite, code, assumptions]);

  const handleTraceFeedback = useCallback(async (feedbackText) => {
    setError("");
    setGenerating(true);
    try {
      const result = await editCode(code, feedbackText);
      setCode(result.code);
      setAssumptions(result.assumptions || []);
      setConfirmedSet(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }, [code]);

  const handleVersionRestore = useCallback((restoredSuite) => {
    setCode(restoredSuite.calculator_code || "");
    setSuite(restoredSuite);
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

    return (
      <>
        <div className="validator-panel" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <PromptPanel
            onGenerate={handleGenerate}
            generating={generating}
            hasCode={!!(code && code.trim())}
          />

          {assumptions.length > 0 && (
            <AssumptionChecklist
              assumptions={assumptions}
              confirmedSet={confirmedSet}
              onConfirm={handleConfirmAssumption}
              onCorrection={handleCorrection}
              onConfirmAll={handleConfirmAll}
              refining={refining}
            />
          )}

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
