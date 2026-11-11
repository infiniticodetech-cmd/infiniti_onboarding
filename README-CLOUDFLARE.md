# Cloudflare Workers deployment notes

This package is configured to serve the Vite/React frontend using Cloudflare Workers Static Assets.

## Deploy from a local computer / Git repository
1. Upload the contents of this folder to a Git repository.
2. Install Node.js 20+ on your computer.
3. From the project root run `npm install`.
4. Run `npm run build` to create `client/dist`.
5. Run `npx wrangler login` and then `npm run deploy`.
6. In the Cloudflare dashboard, add `onboarding.infiniticodetech.com` as a custom domain for this Worker.

If using a Cloudflare build pipeline, set the repository root to `/`, build command to `npm install && npm run build`, and deploy command to `npx wrangler deploy`.

## Important limitation
This deployment only serves the frontend. API endpoints deliberately return HTTP 503 until the separate Node/Express + PostgreSQL backend is deployed and connected. Employee login, invitations, document upload, and HR review are not production-operational yet. Do not collect real employee documents until the backend, private file storage, access controls, and security review are complete.
