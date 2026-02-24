import { Router } from "express";
import { executeCode } from "../services/judge0.js";
import { query } from "../db/index.js";

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

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { code, entity_id } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ error: "code is required" });
    }

    const configRes = await query("SELECT key, value FROM configs");
    const config = Object.fromEntries(configRes.rows.map((r) => [r.key, r.value]));

    const baseURL = config.bubble_api_base;
    const token = config.bubble_api_token;

    if (!baseURL || !token) {
      return res.status(400).json({
        error: "Bubble API base and token required. Configure in Setup.",
      });
    }

    const injected =
      BUBBLE_HELPERS.replace("__ENTITY_ID__", JSON.stringify(entity_id || ""))
        .replace("__BUBBLE_BASE__", JSON.stringify(baseURL))
        .replace("__BUBBLE_TOKEN__", JSON.stringify(token))
      + "\n(async function() {\n"
      + code
      + "\n})();";

    const judge0Key = config.judge0_api_key || process.env.JUDGE0_API_KEY;
    const result = await executeCode(injected, "", 63, judge0Key);
    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      compile_output: result.compile_output,
      status: result.status,
      time: result.time,
      memory: result.memory,
    });
  } catch (err) {
    console.error("Execute error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
