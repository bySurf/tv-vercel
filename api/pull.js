// api/pull.js - Vercel Serverless Function
// Reads a JSON file from a GitHub repo using a server-held token.
// Set env var: GITHUB_TOKEN

function setCors(res) {
  // allow file:// (origin "null") and anything else (we aren't using credentials)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  res.setHeader("Access-Control-Max-Age", "86400"); // cache preflight
}

export default async function handler(req, res) {
  setCors(res);

  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  // Shared-secret check
  if (req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY) {
    return res.status(401).send("Unauthorized");
  }

  // --- Your endpoint-specific logic goes here ---
  // For /api/pull: read owner/repo/path/ref from body and GET from GitHub.
  // For /api/push: read owner/repo/path/branch/message/content and PUT to GitHub.

  // Example body reader:
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  const body = raw ? JSON.parse(raw) : {};
  
  // ... do GitHub fetches ...
  // return res.json(result);
}


if (req.headers['x-admin-key'] !== process.env.ADMIN_API_KEY) {
  setCors(res);
  return res.status(401).send('Unauthorized');
}


export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res);
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    setCors(res);
    return res.status(405).send("Method Not Allowed");
  }
  try {
    const body = await readJson(req);
    const { owner, repo, path, ref } = body || {};
    if (!owner || !repo || !path) {
      setCors(res);
      return res.status(400).send("Missing owner/repo/path");
    }
    const GH = "https://api.github.com";
    const url = `${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref || "main")}`;
    const r = await gh(url);
    const meta = await r.json();
    if (!meta.content) {
      setCors(res);
      return res.status(404).send("Not found");
    }
    const buf = Buffer.from(meta.content, "base64").toString("utf8");
    setCors(res);
    return res.json({ content: buf, sha: meta.sha });
  } catch (e) {
    setCors(res);
    return res.status(500).send(e.message);
  }
}

function setCors(res) {
  // Allow file:// origin (shows as "null")
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function gh(url, opts = {}) {
  const TOKEN = process.env.GITHUB_TOKEN;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Accept": "application/vnd.github+json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
