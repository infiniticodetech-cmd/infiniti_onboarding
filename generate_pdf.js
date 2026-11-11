import fs from 'node:fs';

class SimplePDF {
  constructor() {
    this.objects = [];
    this.pages = [];
  }

  addObject(content) {
    this.objects.push(content);
    return this.objects.length; // 1-indexed object id
  }

  buildPDF(pagesContent) {
    // 1: Catalog
    // 2: Pages root
    // 3: Font
    // for each page: Page obj, Content stream obj
    const catalogId = 1;
    const pagesId = 2;
    const fontId = 3;

    let nextId = 4;
    const pageObjIds = [];

    const pageStreams = pagesContent.map(textLines => {
      const pageId = nextId++;
      const streamId = nextId++;
      pageObjIds.push(pageId);
      return { pageId, streamId, textLines };
    });

    const bodyParts = [];
    const offsets = [];

    function addObj(id, str) {
      const offset = bodyParts.join('').length;
      offsets[id] = offset;
      bodyParts.push(`${id} 0 obj\n${str}\nendobj\n`);
    }

    bodyParts.push('%PDF-1.4\n%âãÏÓ\n');

    addObj(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    addObj(pagesId, `<< /Type /Pages /Kids [${pageObjIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`);
    addObj(fontId, `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);

    pageStreams.forEach(({ pageId, streamId, textLines }) => {
      // 595.28 x 841.89 is A4 in points
      let streamContent = 'BT\n/F1 10 Tf\n';
      let y = 800;
      const x = 50;

      textLines.forEach(line => {
        if (line.type === 'h1') {
          streamContent += `ET\nBT\n/F1 18 Tf\n1 0 0 1 ${x} ${y} Tm\n(${escapePdf(line.text)}) Tj\nET\nBT\n/F1 10 Tf\n`;
          y -= 26;
        } else if (line.type === 'h2') {
          y -= 8;
          streamContent += `ET\nBT\n/F1 13 Tf\n1 0 0 1 ${x} ${y} Tm\n(${escapePdf(line.text)}) Tj\nET\nBT\n/F1 10 Tf\n`;
          y -= 20;
        } else if (line.type === 'h3') {
          y -= 4;
          streamContent += `ET\nBT\n/F1 11 Tf\n1 0 0 1 ${x} ${y} Tm\n(${escapePdf(line.text)}) Tj\nET\nBT\n/F1 10 Tf\n`;
          y -= 16;
        } else if (line.type === 'code') {
          streamContent += `ET\nBT\n/F1 9 Tf\n1 0 0 1 ${x + 10} ${y} Tm\n(${escapePdf(line.text)}) Tj\nET\nBT\n/F1 10 Tf\n`;
          y -= 14;
        } else {
          streamContent += `1 0 0 1 ${x} ${y} Tm\n(${escapePdf(line.text)}) Tj\n`;
          y -= 15;
        }
      });
      streamContent += 'ET\n';

      addObj(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`);
      addObj(streamId, `<< /Length ${Buffer.byteLength(streamContent)} >>\nstream\n${streamContent}\nendstream`);
    });

    const startxref = bodyParts.join('').length;
    let xref = `xref\n0 ${nextId}\n0000000000 65535 f \n`;
    for (let i = 1; i < nextId; i++) {
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }

    const trailer = `trailer\n<< /Size ${nextId} /Root ${catalogId} 0 R >>\nstartxref\n${startxref}\n%%EOF\n`;
    return bodyParts.join('') + xref + trailer;
  }
}

function escapePdf(str) {
  return str.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Generate the pages content
const page1 = [
  { type: 'h1', text: 'Infiniti Code Technologies - Onboarding Portal' },
  { type: 'text', text: 'Production Deployment Guide (Supabase + Cloudflare + Render)' },
  { type: 'h2', text: '1. Architecture Overview' },
  { type: 'text', text: '- Database: Managed PostgreSQL on Supabase for relational employee records.' },
  { type: 'text', text: '- Storage: Private Supabase Storage bucket (onboarding-docs) for documents.' },
  { type: 'text', text: '- Backend API: Express / Node.js service hosted on Render PaaS.' },
  { type: 'text', text: '- Frontend: Vite + React SPA served via Cloudflare Workers.' },
  { type: 'text', text: '- Domain: onboarding.infiniticodetech.com pointed via CNAME on Wix DNS.' },
  { type: 'h2', text: '2. Step 1: Set up Supabase Project' },
  { type: 'text', text: '1. Go to supabase.com and create a new project named infiniti-onboarding.' },
  { type: 'text', text: '2. Save the database password securely.' },
  { type: 'text', text: '3. Copy the Connection Pooling PostgreSQL URI from Settings -> Database.' },
  { type: 'code', text: 'postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?sslmode=require' },
  { type: 'text', text: '4. In Storage -> Buckets -> Create new private bucket named: onboarding-docs' },
  { type: 'text', text: '5. In Project Settings -> API -> copy Project URL and service_role secret key.' },
  { type: 'h2', text: '3. Step 2: Configure Environment Variables' },
  { type: 'text', text: 'In server/.env configure the following keys:' },
  { type: 'code', text: 'PORT=4000' },
  { type: 'code', text: 'DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require"' },
  { type: 'code', text: 'JWT_SECRET="[long-random-secret-generated-by-openssl-rand-hex-32]"' },
  { type: 'code', text: 'ADMIN_EMAIL="admin@infiniticodetech.com"' },
  { type: 'code', text: 'ADMIN_PASSWORD="[Minimum 12 character strong password]"' },
  { type: 'code', text: 'CLIENT_ORIGIN="https://onboarding.infiniticodetech.com"' },
  { type: 'code', text: 'COOKIE_SECURE=true' },
  { type: 'code', text: 'SUPABASE_URL="https://[PROJECT-REF].supabase.co"' },
  { type: 'code', text: 'SUPABASE_SERVICE_ROLE_KEY="[service_role_secret_key]"' },
];

const page2 = [
  { type: 'h2', text: '4. Step 3: Run Prisma Migrations and Seed' },
  { type: 'text', text: 'From the project root on your machine, initialize the Supabase schema:' },
  { type: 'code', text: 'cd server' },
  { type: 'code', text: 'npx prisma migrate dev --name init' },
  { type: 'code', text: 'npm run seed' },
  { type: 'text', text: 'This creates the User, EmployeeProfile, Document, and Invitation tables in Supabase.' },
  { type: 'h2', text: '5. Step 4: Deploy the Backend API to Render' },
  { type: 'text', text: '1. Push this repository to GitHub.' },
  { type: 'text', text: '2. On render.com, click New + -> Web Service and select your repo.' },
  { type: 'text', text: '3. Set Root Directory to: server' },
  { type: 'text', text: '4. Set Build Command to: npm install && npx prisma generate' },
  { type: 'text', text: '5. Set Start Command to: npx prisma migrate deploy && node src/index.js' },
  { type: 'text', text: '6. Add the environment variables from server/.env into the Render dashboard.' },
  { type: 'text', text: '7. Deploy the service and copy your public HTTPS URL (e.g. https://api.onrender.com).' },
  { type: 'h2', text: '6. Step 5: Configure Cloudflare Worker Proxy' },
  { type: 'text', text: 'Update worker/index.js to proxy /api/* to your Render backend URL.' },
  { type: 'text', text: 'In wrangler.jsonc, set vars.BACKEND_URL to your Render URL.' },
  { type: 'text', text: 'Run the deployment commands:' },
  { type: 'code', text: 'npx wrangler login' },
  { type: 'code', text: 'npm run build' },
  { type: 'code', text: 'npm run deploy' },
  { type: 'h2', text: '7. Step 6: Connect Domain in Wix DNS' },
  { type: 'text', text: '1. In Cloudflare Worker -> Settings -> Domains -> add onboarding.infiniticodetech.com' },
  { type: 'text', text: '2. In Wix DNS Manager, add a CNAME record with host "onboarding" pointing to Cloudflare.' },
  { type: 'text', text: '3. Do not modify the existing root @ or www records on Wix.' }
];

const pdf = new SimplePDF();
const pdfData = pdf.buildPDF([page1, page2]);
fs.writeFileSync('d:\\infiniti_onboarding_cloudflare_worker_fix\\deployment_steps_supabase.pdf', pdfData, 'binary');
console.log('PDF successfully generated at d:\\infiniti_onboarding_cloudflare_worker_fix\\deployment_steps_supabase.pdf');

