import { spawn } from "child_process";
import { readFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";
import os from "os";

const sessions = new Map();

const SESSION_TTL_MS = 30 * 60 * 1000;

export function startRecording(bubbleAppUrl) {
  const sessionId = randomUUID();
  const outputFile = path.join(os.tmpdir(), `arkhitect-${sessionId}.js`);

  const session = {
    id: sessionId,
    status: "recording",
    outputFile,
    code: null,
    error: null,
    process: null,
    listeners: [],
    createdAt: Date.now(),
  };

  const proc = spawn("npx", ["playwright", "codegen", "--output", outputFile, bubbleAppUrl], {
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
  });

  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  proc.on("close", async (exitCode) => {
    if (exitCode === 0) {
      try {
        const code = await readFile(outputFile, "utf-8");
        session.code = code;
        session.status = "completed";
      } catch {
        session.status = "error";
        session.error = "Recording completed but output file could not be read.";
      }
    } else {
      session.status = "error";
      session.error = stderr.trim() || `Playwright exited with code ${exitCode}`;
    }

    session.process = null;

    for (const cb of session.listeners) {
      try { cb(session); } catch {}
    }
    session.listeners = [];

    cleanupFile(outputFile);
  });

  proc.on("error", (err) => {
    session.status = "error";
    session.error = err.message;
    session.process = null;

    for (const cb of session.listeners) {
      try { cb(session); } catch {}
    }
    session.listeners = [];
  });

  session.process = proc;
  sessions.set(sessionId, session);

  setTimeout(() => {
    const s = sessions.get(sessionId);
    if (s) {
      if (s.process) {
        s.process.kill("SIGTERM");
      }
      sessions.delete(sessionId);
    }
  }, SESSION_TTL_MS);

  return { sessionId };
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return {
    id: session.id,
    status: session.status,
    code: session.code,
    error: session.error,
  };
}

export function onComplete(sessionId, callback) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  if (session.status !== "recording") {
    callback(session);
    return true;
  }

  session.listeners.push(callback);
  return true;
}

export function removeOnComplete(sessionId, callback) {
  const session = sessions.get(sessionId);
  if (!session) return;
  session.listeners = session.listeners.filter((cb) => cb !== callback);
}

export function stopRecording(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  if (session.process) {
    session.process.kill("SIGTERM");
  }
  return true;
}

export function cleanupSession(sessionId) {
  const session = sessions.get(sessionId);
  if (session) {
    if (session.process) {
      session.process.kill("SIGTERM");
    }
    cleanupFile(session.outputFile);
    sessions.delete(sessionId);
  }
}

async function cleanupFile(filePath) {
  try { await unlink(filePath); } catch {}
}
