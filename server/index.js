import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import configRouter from "./routes/config.js";
import testSuitesRouter from "./routes/testSuites.js";
import testRunsRouter from "./routes/testRuns.js";
import executeRouter from "./routes/execute.js";
import aiRouter from "./routes/ai.js";
import codeVersionsRouter from "./routes/codeVersions.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/config", configRouter);
app.use("/api/test-suites", testSuitesRouter);
app.use("/api/test-runs", testRunsRouter);
app.use("/api/execute", executeRouter);
app.use("/api/ai", aiRouter);
app.use("/api/test-suites", codeVersionsRouter);

// Serve static frontend in production (when dist exists)
const clientDist = path.join(__dirname, "..", "client", "dist");
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Arkhitect server running on http://localhost:${PORT}`);
});
