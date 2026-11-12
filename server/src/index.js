
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import path from 'node:path';

import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const app = express();
const db = new PrismaClient();
const port = process.env.PORT || 4000;

const BUCKET = 'employee-documents';

const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'CLIENT_ORIGIN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);

const clientOrigin = process.env.CLIENT_ORIGIN.replace(/\/$/, '');

app.set('trust proxy', 1);

app.use(helmet());

app.use(cors({
  origin: clientOrigin,
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  path: '/',
  maxAge: 8 * 60 * 60 * 1000
};

function auth(req, res, next) {
  try {
    const token = req.cookies.session;

    if (!token) {
      throw new Error('Missing session');
    }

    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({
      error: 'Please sign in'
    });
  }
}

function admin(req, res, next) {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Administrator access required'
    });
  }

  next();
}

function handleError(res, error, message = 'Server error') {
  console.error(message, error);

  if (!res.headersSent) {
    res.status(500).json({ error: message });
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5
  },
  fileFilter(req, file, cb) {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only PDF, JPG and PNG files are allowed'));
    }

    cb(null, true);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};

    const user = await db.user.findUnique({
      where: {
        email: String(email || '').trim().toLowerCase()
      }
    });

    if (
      !user ||
      !await bcrypt.compare(String(password || ''), user.passwordHash)
    ) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('session', token, cookieOptions);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    handleError(res, error, 'Login failed');
  }
});

// ACCEPT INVITATION
app.post('/api/auth/accept-invitation', async (req, res) => {
  try {
    const token = String(req.body?.token || '');
    const password = String(req.body?.password || '');

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        error: 'Invalid invitation link'
      });
    }

    if (password.length < 12) {
      return res.status(400).json({
        error: 'Password must be at least 12 characters'
      });
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const invitation = await db.invitation.findUnique({
      where: { tokenHash }
    });

    if (
      !invitation ||
      invitation.usedAt ||
      invitation.expiresAt <= new Date()
    ) {
      return res.status(400).json({
        error: 'Invitation is invalid, expired, or already used'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await db.$transaction(async (tx) => {
      const current = await tx.invitation.findUnique({
        where: { id: invitation.id }
      });

      if (
        !current ||
        current.usedAt ||
        current.expiresAt <= new Date()
      ) {
        throw new Error('Invitation is no longer valid');
      }

      const existing = await tx.user.findUnique({
        where: { email: current.email }
      });

      if (existing) {
        throw new Error('An account already exists for this email');
      }

      const created = await tx.user.create({
        data: {
          email: current.email,
          passwordHash,
          role: 'EMPLOYEE'
        }
      });

      await tx.invitation.update({
        where: { id: current.id },
        data: { usedAt: new Date() }
      });

      return created;
    });

    const session = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('session', session, cookieOptions);

    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Invitation activation failed:', error);

    res.status(400).json({
      error: error.message || 'Invitation activation failed'
    });
  }
});

// LOGOUT
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('session', {
    httpOnly: true,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
    path: '/'
  });

  res.json({ ok: true });
});

// CURRENT USER
app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'User not found'
      });
    }

    res.json({ user });
  } catch (error) {
    handleError(res, error);
  }
});

// CREATE INVITATION
app.post('/api/admin/invitations', auth, admin, async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({
        error: 'Valid email required'
      });
    }

    const token = crypto.randomBytes(32).toString('hex');

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    await db.invitation.create({
      data: {
        email,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 86400000)
      }
    });

    res.json({
      inviteUrl: `${clientOrigin}/?invite=${token}`
    });
  } catch (error) {
    handleError(res, error, 'Invitation creation failed');
  }
});

// EMPLOYEE SUBMISSION WITH SUPABASE STORAGE
app.post(
  '/api/employee/submit',
  auth,
  upload.array('documents', 5),
  async (req, res) => {
    const uploadedPaths = [];

    try {
      let profileData;

      try {
        profileData = JSON.parse(req.body.profile || '{}');
      } catch {
        return res.status(400).json({
          error: 'Invalid profile data'
        });
      }

      const profile = await db.employeeProfile.upsert({
        where: { userId: req.user.id },

        create: {
          userId: req.user.id,
          fullName: profileData.fullName || null,
          phone: profileData.phone || null,
          address: profileData.address || null,
          designation: profileData.designation || null,
          joiningDate: profileData.joiningDate
            ? new Date(profileData.joiningDate)
            : null,
          status: 'SUBMITTED'
        },

        update: {
          fullName: profileData.fullName || null,
          phone: profileData.phone || null,
          address: profileData.address || null,
          designation: profileData.designation || null,
          joiningDate: profileData.joiningDate
            ? new Date(profileData.joiningDate)
            : null,
          status: 'SUBMITTED'
        }
      });

      for (const file of req.files || []) {
        const storageName =
          `${profile.id}/${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(storageName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }

        uploadedPaths.push(storageName);

        await db.document.create({
          data: {
            profileId: profile.id,
            fileName: path.basename(file.originalname),
            mimeType: file.mimetype,
            storageName
          }
        });
      }

      res.json({
        ok: true,
        status: profile.status
      });

    } catch (error) {
      // Remove files uploaded during a failed submission.
      if (uploadedPaths.length) {
        await supabase.storage
          .from(BUCKET)
          .remove(uploadedPaths);
      }

      handleError(res, error, 'Employee submission failed');
    }
  }
);

// ADMIN EMPLOYEE LIST
app.get('/api/admin/employees', auth, admin, async (req, res) => {
  try {
    const employees = await db.employeeProfile.findMany({
      include: {
        user: {
          select: { email: true }
        },
        documents: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    res.json(employees);
  } catch (error) {
    handleError(res, error);
  }
});

// UPDATE EMPLOYEE STATUS
app.patch(
  '/api/admin/employees/:id/status',
  auth,
  admin,
  async (req, res) => {
    try {
      const status = req.body.status;

      if (!['APPROVED', 'CHANGES_REQUESTED'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status'
        });
      }

      const result = await db.employeeProfile.update({
        where: { id: req.params.id },
        data: { status }
      });

      res.json(result);
    } catch (error) {
      handleError(res, error);
    }
  }
);

// ADMIN DOCUMENT DOWNLOAD
app.get(
  '/api/admin/documents/:id',
  auth,
  admin,
  async (req, res) => {
    try {
      const document = await db.document.findUnique({
        where: { id: req.params.id }
      });

      if (!document) {
        return res.sendStatus(404);
      }

      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(document.storageName, 60);

      if (error) {
        throw error;
      }

      res.json({
        downloadUrl: data.signedUrl,
        fileName: document.fileName
      });
    } catch (error) {
      handleError(res, error, 'Document download failed');
    }
  }
);

// ERROR HANDLER
app.use((error, req, res, next) => {
  console.error('Request error:', error);

  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      error: error.message
    });
  }

  res.status(400).json({
    error: error.message || 'Invalid request'
  });
});

// START SERVER
app.listen(port, () => {
  console.log(`API listening on ${port}`);
});

// CLEAN SHUTDOWN
async function shutdown() {
  await db.$disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
