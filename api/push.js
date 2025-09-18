// api/push.js - Vercel Serverless Function
// Creates a branch + commit + PR with updated JSON content.
// Set env var: GITHUB_TOKEN

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
    const { owner, repo, path, branch, message, content } = body || {};
    if (!owner || !repo || !path || !content) {
      setCors(res);
      return res.status(400).send("Missing fields");
    }
    const GH = "https://api.github.com";
    const baseBranch = branch || "main";
    const timeTag = new Date().toISOString().replace(/[:.]/g, "-");
    const newBranch = `bysurf-admin/${timeTag}-${cryptoRandom(6)}`;

    // 1) Get base branch SHA
    const baseRef = await (await gh(`${GH}/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`)).json();
    const baseSha = baseRef.object.sha;

    // 2) Create new branch from base
    await gh(`${GH}/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${newBranch}`, sha: baseSha }),
    });

    // 3) Read existing file sha (if exists)
    let existingSha = null;
    const fileRes = await fetch(`${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(baseBranch)}`, {
      headers: { "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`, "Accept": "application/vnd.github+json" },
    });
    if (fileRes.ok) {
      const fileJson = await fileRes.json();
      existingSha = fileJson.sha;
    }

    // 4) Commit file on new branch
    await gh(`${GH}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message || `bySurf admin update (${new Date().toISOString()})`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch: newBranch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    // 5) Open PR
    const pr = await (await gh(`${GH}/repos/${owner}/${repo}/pulls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: message || `bySurf admin update`,
        head: newBranch,
        base: baseBranch,
        body: "Automated change from bySurf Admin.",
      }),
    })).json();

    setCors(res);
    return res.json({ ok: true, pr });
  } catch (e) {
    setCors(res);
    return res.status(500).send(e.message);
  }
}

function setCors(res) {
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

function cryptoRandom(bytes) {
  // Small helper for branch suffix
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
