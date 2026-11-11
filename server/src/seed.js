import 'dotenv/config';import bcrypt from 'bcryptjs';import {PrismaClient} from '@prisma/client';const db=new PrismaClient();
const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD;if(!email||!password||password.length<12)throw Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters) in .env');
await db.user.upsert({where:{email:email.toLowerCase()},create:{email:email.toLowerCase(),passwordHash:await bcrypt.hash(password,12),role:'ADMIN'},update:{passwordHash:await bcrypt.hash(password,12),role:'ADMIN'}});
console.log('Admin account created/updated');await db.$disconnect();
