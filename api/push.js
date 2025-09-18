// /api/push.js – commit JSON directly to main (no PR)

function setCors(res) {
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

const validKeys = [
  process.env.ADMIN_API_KEY,
  process.env.ADMIN_KEY_SIL,
  process.env.ADMIN_KEY_FILIP,
  process.env.ADMIN_KEY_ARDA
].filter(Boolean);

if (!validKeys.includes(req.headers["x-admin-key"])) {
  return res.status(401).send("Unauthorized");
}

  try {
    const { owner, repo, path, branch = "main", message, content } = await readBody(req);
    if (!owner || !repo || !path || !content) {
      return res.status(400).send("Missing owner/repo/path/content");
    }

    // get current sha (if the file already exists)
    let existingSha = null;
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const getRes = await fetch(getUrl, { headers: ghHeaders() });
    if (getRes.ok) {
      const fileJson = await getRes.json();
      existingSha = fileJson.sha;
    }

    // put new content
    const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
    const putRes = await fetch(putUrl, {
      method: "PUT",
      headers: { ...ghHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message || `bySurf admin: update ${path} (${new Date().toISOString()})`,
        content: Buffer.from(content, "utf8").toString("base64"),
        branch,
        ...(existingSha ? { sha: existingSha } : {})
      })
    });

    if (!putRes.ok) return res.status(putRes.status).send(await putRes.text());

    const json = await putRes.json();
    return res.json({ ok: true, commit: json.commit });
  } catch (e) {
    return res.status(500).send(e.message || "Server error");
  }
}
