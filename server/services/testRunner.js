import { query } from "../db/index.js";
import { executeCode } from "./judge0.js";

const BUBBLE_HELPERS = `
var https = require("https");
var http = require("http");
var urlMod = require("url");

var ENTITY_ID = __ENTITY_ID__;
var BUBBLE_BASE = __BUBBLE_BASE__;
var BUBBLE_TOKEN = __BUBBLE_TOKEN__;

function _httpGetJSON(url, headers) {
  return new Promise(function(resolve, reject) {
    var parsed = urlMod.parse(url);
    var mod = parsed.protocol === "https:" ? https : http;
    var opts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.path,
      method: "GET",
      headers: headers || {}
    };
    var req = mod.request(opts, function(res) {
      var body = "";
      res.on("data", function(chunk) { body += chunk; });
      res.on("end", function() {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error("JSON parse error: " + body.substring(0, 200))); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function getThing(type, id) {
  var url = BUBBLE_BASE + "/" + type + "/" + id;
  return _httpGetJSON(url, { Authorization: "Bearer " + BUBBLE_TOKEN })
    .then(function(d) { return d.response; });
}

function searchThings(type, constraints, limit) {
  limit = limit || 100;
  var all = [];
  function page(cursor) {
    var qs = [];
    if (constraints && constraints.length) qs.push("constraints=" + encodeURIComponent(JSON.stringify(constraints)));
    qs.push("cursor=" + cursor);
    qs.push("limit=" + limit);
    var url = BUBBLE_BASE + "/" + type + "?" + qs.join("&");
    return _httpGetJSON(url, { Authorization: "Bearer " + BUBBLE_TOKEN })
      .then(function(d) {
        var results = (d && d.response && d.response.results) ? d.response.results : [];
        all.push.apply(all, results);
        var remaining = (d && d.response && typeof d.response.remaining !== "undefined") ? d.response.remaining : 0;
        if (remaining > 0 && results.length > 0) return page(cursor + results.length);
        return all;
      });
  }
  return page(0);
}
`;

function parseTraceSteps(logs) {
  if (!logs) return [];
  const steps = [];
  for (const line of logs.split("\n")) {
    if (line.startsWith("__TRACE__")) {
      try {
        steps.push(JSON.parse(line.slice("__TRACE__".length)));
      } catch (e) {
        // skip malformed trace lines
      }
    }
  }
  return steps;
}

export async function executeTest(runId, suite, entityId, config) {
  try {
    const baseURL = config.bubble_api_base;
    const token = config.bubble_api_token;

    if (!baseURL || !token) {
      await query(
        `UPDATE test_runs SET status = 'error', error_message = $2 WHERE id = $1`,
        [runId, "Bubble API base and token required. Configure in Setup."]
      );
      return;
    }

    const calculatorCode = suite.calculator_code || "";

    if (!calculatorCode.trim()) {
      await query(
        `UPDATE test_runs SET status = 'error', error_message = $2 WHERE id = $1`,
        [runId, "Add test logic in Test Editor first."]
      );
      return;
    }

    const injected = BUBBLE_HELPERS
      .replace("__ENTITY_ID__", JSON.stringify(entityId))
      .replace("__BUBBLE_BASE__", JSON.stringify(baseURL))
      .replace("__BUBBLE_TOKEN__", JSON.stringify(token))
      + "\n(async function() {\n"
      + calculatorCode
      + "\n})();";

    const judge0Key = config.judge0_api_key || process.env.JUDGE0_API_KEY;
    const exec = await executeCode(injected, "", 63, judge0Key);
    const logs = [exec.stdout, exec.stderr].filter(Boolean).join("\n");

    const traceSteps = parseTraceSteps(exec.stdout);

    let expected_vs_received = [];
    let passed = 0;
    let failed = 0;
    let status = "error";

    const match = logs.match(/__ARKHITECT_RESULT__\s*(\{[\s\S]*?\})\s*$/);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        expected_vs_received = parsed.results || parsed.expected_vs_received || [];
        passed = parsed.passed ?? 0;
        failed = parsed.failed ?? 0;
        status = failed > 0 ? "failed" : "passed";
      } catch (e) {
        status = "error";
      }
    } else if (exec.stderr) {
      status = "error";
    } else {
      status = "passed";
    }

    await query(
      `UPDATE test_runs SET
        status = $2, logs = $3, expected_vs_received = $4,
        passed_count = $5, failed_count = $6, error_message = $7,
        trace_steps = $8
       WHERE id = $1`,
      [
        runId,
        status,
        logs,
        JSON.stringify(expected_vs_received),
        passed,
        failed,
        status === "error" ? logs : null,
        JSON.stringify(traceSteps),
      ]
    );
  } catch (err) {
    console.error("executeTest error:", err);
    await query(
      `UPDATE test_runs SET status = 'error', error_message = $2, logs = $3 WHERE id = $1`,
      [runId, err.message, err.stack]
    );
  }
}
