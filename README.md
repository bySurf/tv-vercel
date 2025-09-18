# bySurf Admin Backend (Vercel)
Serverless backend for your admin HTML. No token in the browser.

## Deploy
1. Create a new GitHub repo and add this folder's files.
2. In Vercel, **Import Project** from that repo.
3. Set Environment Variable: `GITHUB_TOKEN` (fine-grained PAT for your JSON repo).
4. Deploy. Your endpoints will be:
   - `https://YOUR-PROJECT.vercel.app/api/pull`
   - `https://YOUR-PROJECT.vercel.app/api/push`
5. In the admin HTML, click **Set backend** and paste the base URL (without `/api/...`).

## Test
```
curl -X POST https://YOUR-PROJECT.vercel.app/api/pull \
  -H "Content-Type: application/json" \
  -d '{"owner":"OWNER","repo":"REPO","path":"path/to/library.json","ref":"main"}'
```
