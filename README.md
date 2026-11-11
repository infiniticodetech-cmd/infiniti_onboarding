# Infiniti Code Technologies – Employee Onboarding Portal

A starter full-stack onboarding portal for a single HR administrator and invited employees.

## Stack
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (Prisma ORM)
- Authentication: bcrypt password hashing + JWT in HttpOnly cookies
- File storage: local private storage for development (replace with private object storage before production)

## Important
This is source code, not a hosted/live website. It is a development starter and must be configured, tested, security-reviewed, and deployed before collecting real employee information. Do not use real Aadhaar, PAN, bank, or other sensitive documents until production security and privacy controls have been independently verified.

## Run locally
1. Install Node.js 20+ and PostgreSQL.
2. Copy `server/.env.example` to `server/.env` and set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
3. In `server/` run:
   ```bash
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm run seed
   npm run dev
   ```
4. In `client/` run:
   ```bash
   npm install
   npm run dev
   ```
5. Open the Vite URL shown in the terminal (normally http://localhost:5173).

The seed command creates the first administrator using the credentials in `.env`.

## Before production
- Use managed PostgreSQL with backups and TLS.
- Replace local file storage with a private S3-compatible bucket and short-lived signed downloads.
- Configure HTTPS, secure cookie settings, email provider credentials, password reset, rate limiting, CSRF protection, malware scanning, retention/deletion policy, audit logging, and monitoring.
- Add a privacy notice and collect only information genuinely needed for employment.
- Set CORS and trusted origins to your deployed portal domain.
- Perform security and acceptance testing. Do not expose the local uploads directory publicly.

## Wix domain
After deployment, configure `onboarding.infiniticodetech.com` in Wix DNS using the exact records supplied by your hosting provider. Do not change the existing website's A or `www` records.
