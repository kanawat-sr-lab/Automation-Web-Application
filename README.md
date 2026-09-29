# Auto Care

ระบบจัดการเครื่องจักร Alarm และบำรุงรักษาเชิงป้องกันสำหรับโรงงาน พัฒนาด้วย Next.js App Router, TypeScript, Tailwind CSS และ Supabase

## ความสามารถ

- Dashboard สรุปจำนวนเครื่องจักรตามสถานะ, Alarm ที่ยังเปิด, งาน PM คงค้าง และแนวโน้ม uptime
- Machine master: สร้าง อ่าน แก้ไข และลบ พร้อมตรวจรูปแบบและ Machine ID ซ้ำ
- Alarm: บันทึก อ่าน ค้นหา/กรอง และเปลี่ยนสถานะ Open, In progress, Closed
- Maintenance: สร้าง อ่าน ค้นหา/กรอง มอบหมาย Technician และอัปเดตสถานะงาน
- Supabase Auth: เข้าสู่ระบบ/ออกจากระบบ และ profile role Admin หรือ Technician
- Supabase Row Level Security (RLS) บังคับสิทธิ์ซ้ำที่ฐานข้อมูล
- ถ้ายังไม่กำหนด Supabase environment แอปจะแสดงข้อมูลตัวอย่างสำหรับทดลองหน้าจอ การเปลี่ยนแปลงในโหมดนี้ไม่ถูกบันทึกหลัง reload

## เริ่มต้นใช้งาน

ต้องติดตั้ง Node.js รุ่นที่รองรับ Next.js 16 และ npm

1. สร้าง Supabase project แล้วคัดลอก `.env.example` เป็น `.env.local`
2. กำหนด `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ใช้ publishable/anon key เท่านั้น)
3. เปิด SQL Editor ใน Supabase แล้วรันไฟล์ `supabase/migrations/202609270001_initial_schema.sql`
4. สร้างผู้ใช้จาก Supabase Authentication ก่อน จากนั้นเลื่อนบัญชีที่เชื่อถือได้เป็น Admin ด้วย SQL ใน SQL Editor:

```sql
update public.profiles
set role = 'Admin'
where id = (select id from auth.users where email = 'admin@company.com');
```

แทน `admin@company.com` ด้วยอีเมลบัญชีจริง บัญชีใหม่ที่สมัครภายหลังจะได้ role `Technician` โดยอัตโนมัติ ห้ามให้ client ส่งหรือแก้ role ของตนเอง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000` ในเบราว์เซอร์ ตรวจ `npm run lint` และ `npm run build` ก่อน deploy

## เผยแพร่แบบทำงานต่อเนื่อง

อย่าใช้ `next dev` หรือ Quick Tunnel เป็น production hosting เพราะทั้งคู่หยุดได้เมื่อปิดเครื่อง/terminal และ Quick Tunnel เปลี่ยน URL ได้ ให้ deploy โปรเจกต์ไปยัง hosting สำหรับ Next.js เช่น Vercel ผ่าน Git integration แล้วกำหนด `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ใน Production Environment Variables ของ hosting ก่อน deploy การอัปเดตแต่ละครั้งทำผ่าน Git push ได้ URL production จะคงที่ตาม project/domain ที่ตั้งไว้

การ deploy ต้องใช้บัญชี hosting และ Supabase project ของผู้ดูแล ซึ่งไม่ได้อยู่ใน workspace นี้; อย่าใส่ service role key ใน frontend หรือ `NEXT_PUBLIC_*` variables หากต้องการ public app ที่ใช้งานข้อมูลจริง ต้องรัน migration และสร้าง Admin account ใน Supabase ก่อนด้วย

## ความปลอดภัย

- `.env.local` ถูกละเว้นโดย Git; ห้าม commit secrets
- Browser ใช้ Supabase publishable/anon key ซึ่งถูกออกแบบให้ใช้กับ client ร่วมกับ RLS
- ห้ามนำ `service_role` key หรือ secret key ไปไว้ใน `NEXT_PUBLIC_*`, browser bundle หรือ source code ฝั่ง client
- การกำหนด Admin ทำใน Supabase SQL Editor โดยผู้ดูแลที่เชื่อถือได้เท่านั้น
- ลบ Machine ที่ยังมี Alarm หรือประวัติ PM อ้างอิงไม่ได้ เพื่อรักษาความสัมพันธ์ข้อมูล

## หมายเหตุการใช้งาน

Migration สร้างตาราง `profiles`, `machines`, `alarms`, `maintenance_records`, foreign keys, checks, indexes, timestamps, profile trigger และ RLS policies ให้แล้ว ปิด public sign-up ใน Supabase หากต้องการให้ผู้ดูแลเป็นผู้สร้างบัญชีเท่านั้นThis is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
