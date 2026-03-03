import { adminClient, createUserClient } from "../db/supabase.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const queryToken = req.query?.token;
  let token;

  if (header && header.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (queryToken) {
    token = queryToken;
  } else {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const { data: { user }, error } = await adminClient.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = user;
    req.supabase = createUserClient(token);
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
}
