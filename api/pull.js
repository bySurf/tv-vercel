// /api/pull.js – read JSON file from GitHub with server-held token

function setCors(res) {
  // allow file:// (Origin 'null') and any origin (no cookies used)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function ghHeaders() {
  return {
    "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json"
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST")    return res.status(405).send("Method Not Allowed");

  // shared secret
  if (req.headers["x-admin-key"] !== process.env.ADMIN_API_KEY) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const { owner, repo, path, ref = "main" } = await readBody(req);
    if (!owner || !repo || !path) return res.status(400).send("Missing owner/repo/path");

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`;
    const r = await fetch(url, { headers: ghHeaders() });

    if (r.status === 404) return res.status(404).send("Not found");
    if (!r.ok)            return res.status(r.status).send(await r.text());

    const meta = await r.json();
    const content = meta.content ? Buffer.from(meta.content, "base64").toString("utf8") : "";
    return res.json({ content, sha: meta.sha });
  } catch (e) {
    return res.status(500).send(e.message || "Server error");
  }
}
