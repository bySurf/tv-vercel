// api/push.js — direct commit to main (no PR)
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    setCors(res); return res.status(204).end();
  }
  if (req.method !== "POST") {
    setCors(res); return res.status(405).send("Method Not Allowed");
  }
  try {
    const { owner, repo, path, branch = "main", message, content } = await readJson(req);
    if (!owner || !repo || !path || !content) {
      setCors(res); return res.status(400).send("Missing owner/repo/path/content");
    }
    // get current sha (if file exists) so GitHub treats it as an update not a create
    let existingSha = null;
    const fileRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
      { headers: ghHeaders() }
    );
    if (fileRes.ok) {
      const fileJson = await fileRes.json();
      existingSha = fileJson.sha;
    }

    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
      {
        method: "PUT",
        headers: { ...ghHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || `bySurf admin: update ${path} (${new Date().toISOString()})`,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
          ...(existingSha ? { sha: existingSha } : {})
        })
      }
    );

    if (!putRes.ok) {
      const txt = await putRes.text();
      setCors(res); return res.status(putRes.status).send(txt);
    }
    const json = await putRes.json();
    setCors(res); return res.json({ ok: true, commit: json.commit });
  } catch (e) {
    setCors(res); return res.status(500).send(e.message);
  }
}

function ghHeaders() {
  return {
    "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
    "Accept": "application/vnd.github+json"
  };
}
function setCors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
async function readJson(req){
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}
