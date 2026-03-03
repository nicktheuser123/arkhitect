import ivm from "isolated-vm";
import { adminClient } from "../db/supabase.js";
import { createBubbleClient } from "./bubbleClient.js";

const ISOLATE_MEMORY_MB = 128;
const EXEC_TIMEOUT_MS = 30_000;

function parseTraceSteps(logs) {
  const steps = [];
  for (const line of logs.split("\n")) {
    if (line.startsWith("__TRACE__")) {
      try {
        steps.push(JSON.parse(line.slice("__TRACE__".length)));
      } catch (_) {
        // skip malformed trace lines
      }
    }
  }
  return steps;
}

async function executeInIsolate(calculatorCode, entityId, config) {
  const isolate = new ivm.Isolate({ memoryLimit: ISOLATE_MEMORY_MB });
  try {
    const context = await isolate.createContext();
    const jail = context.global;

    const logs = [];

    await jail.set(
      "_log",
      new ivm.Callback((...args) => {
        logs.push(
          args
            .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
            .join(" ")
        );
      })
    );

    const bubble = createBubbleClient(
      config.bubble_api_base,
      config.bubble_api_token
    );

    const getThingRef = new ivm.Reference(async function (type, id) {
      try {
        const result = await bubble.getThing(type, id);
        return JSON.parse(JSON.stringify(result));
      } catch (err) {
        const msg = `getThing("${type}", "${id}") failed: ${err.message}`;
        logs.push("__ARKHITECT_EXEC_ERROR__ " + msg);
        return { __error: msg };
      }
    });

    const searchThingsRef = new ivm.Reference(async function (type, constraints, limit) {
      try {
        const result = await bubble.searchThings(
          type,
          constraints || [],
          limit || 100
        );
        return JSON.parse(JSON.stringify(result));
      } catch (err) {
        const msg = `searchThings("${type}") failed: ${err.message}`;
        logs.push("__ARKHITECT_EXEC_ERROR__ " + msg);
        return { __error: msg };
      }
    });

    await jail.set("_getThingRef", getThingRef);
    await jail.set("_searchThingsRef", searchThingsRef);
    await jail.set("ENTITY_ID", entityId);

    await context.eval(`
      var console = {
        log: function() {
          var args = [];
          for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
          _log.apply(undefined, args);
        }
      };
      async function getThing(type, id) {
        var r = await _getThingRef.apply(undefined, [type, id], { result: { promise: true, copy: true } });
        if (r && r.__error) throw new Error(r.__error);
        return r;
      }
      async function searchThings(type, constraints, limit) {
        var r = await _searchThingsRef.apply(undefined, [type, constraints || [], limit || 100], { result: { promise: true, copy: true } });
        if (r && r.__error) throw new Error(r.__error);
        return r;
      }
    `);

    const wrappedCode = `(async function() {
  try {
${calculatorCode}
  } catch(__err) {
    console.log("__ARKHITECT_EXEC_ERROR__ " + (__err && __err.message ? __err.message : String(__err)));
  }
})()`;
    try {
      await context.eval(wrappedCode, {
        timeout: EXEC_TIMEOUT_MS,
        promise: true,
      });
    } catch (evalErr) {
      logs.push("__ARKHITECT_EXEC_ERROR__ " + (evalErr.message || String(evalErr)));
    }

    const stdout = logs.join("\n");
    return { stdout, stderr: "" };
  } finally {
    isolate.dispose();
  }
}

export async function executeTest(runId, suite, entityId, config) {
  try {
    const baseURL = config.bubble_api_base;
    const token = config.bubble_api_token;

    if (!baseURL || !token) {
      await adminClient
        .from("test_runs")
        .update({
          status: "error",
          error_message:
            "Bubble API base and token required. Configure in Setup.",
        })
        .eq("id", runId);
      return;
    }

    const calculatorCode = suite.calculator_code || "";

    if (!calculatorCode.trim()) {
      await adminClient
        .from("test_runs")
        .update({
          status: "error",
          error_message: "Add test logic in Test Editor first.",
        })
        .eq("id", runId);
      return;
    }

    const exec = await executeInIsolate(calculatorCode, entityId, config);
    let logs = [exec.stdout, exec.stderr].filter(Boolean).join("\n");
    const traceSteps = parseTraceSteps(exec.stdout);

    let expected_vs_received = [];
    let passed = 0;
    let failed = 0;
    let status = "error";

    const match = logs.match(/__ARKHITECT_RESULT__\s*(\{[\s\S]*?\})\s*$/);
    const execError = logs.match(/__ARKHITECT_EXEC_ERROR__\s*(.+)/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        expected_vs_received =
          parsed.results || parsed.expected_vs_received || [];
        passed = parsed.passed ?? 0;
        failed = parsed.failed ?? 0;
        status = failed > 0 ? "failed" : "passed";
      } catch (_) {
        status = "error";
      }
    } else if (execError) {
      status = "error";
      logs += `\n__ARKHITECT_ERROR__ Test code threw an error: ${execError[1]}`;
    } else if (exec.stderr) {
      status = "error";
    } else {
      status = "error";
      expected_vs_received = [];
      logs += "\n__ARKHITECT_ERROR__ Test executed but produced no __ARKHITECT_RESULT__ output. The test may be missing its assertion block.";
    }

    await adminClient
      .from("test_runs")
      .update({
        status,
        logs,
        expected_vs_received,
        passed_count: passed,
        failed_count: failed,
        error_message: status === "error" ? logs : null,
        trace_steps: traceSteps,
      })
      .eq("id", runId);
  } catch (err) {
    console.error("executeTest error:", err);
    await adminClient
      .from("test_runs")
      .update({
        status: "error",
        error_message: err.message,
        logs: err.stack,
      })
      .eq("id", runId);
  }
}
