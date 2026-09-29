"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) router.replace("/");
    });
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;

    setBusy(true);
    setErrorMessage("");
    const formData = new FormData(event.currentTarget);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: String(formData.get("email")).trim(),
        password: String(formData.get("password")),
      });
      if (error) {
        setErrorMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน");
        return;
      }

      const requestedPath = new URLSearchParams(window.location.search).get("next");
      const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/";
      router.replace(destination);
      router.refresh();
    } catch {
      setErrorMessage("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-art">
        <div className="login-grid" />
        <div className="login-art-content">
          <Link className="brand login-brand" href="/">
            <span className="brand-mark"><span /><span /><span /><span /></span>
            <span className="brand-name">Auto <span>Care</span><small>PLANT OPERATIONS</small></span>
          </Link>
          <div className="login-message">
            <span className="eyebrow"><span /> NORTH PLANT · OPERATIONS</span>
            <h1>Keep every<br />machine moving.</h1>
            <p>ระบบดูแลเครื่องจักรและแผนบำรุงรักษา<br />สำหรับทีมโรงงานที่ไม่หยุดพัฒนา</p>
          </div>
          <div className="login-art-foot"><span>BUILT FOR THE FLOOR.</span><span>01 / 04</span></div>
        </div>
      </div>

      <section className="login-side">
        <form className="login-form" onSubmit={handleSubmit}>
          <span className="login-kicker">ยินดีต้อนรับกลับ</span>
          <h2>เข้าสู่ระบบ</h2>
          <p>ลงชื่อเข้าใช้เพื่อจัดการงานภายในโรงงาน</p>
          {supabase ? (
            <>
              <label>อีเมล<input name="email" type="email" placeholder="name@company.com" required autoComplete="username" /></label>
              <label>รหัสผ่าน<input name="password" type="password" placeholder="กรอกรหัสผ่าน" required minLength={6} autoComplete="current-password" /></label>
              {errorMessage && <div className="login-error" role="alert">{errorMessage}</div>}
              <button type="submit" className="primary-button login-submit" disabled={busy}>
                {busy ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}<ChevronRight size={15} />
              </button>
              <div className="login-security"><span><Check size={14} /></span>การเชื่อมต่อที่ปลอดภัยด้วย Supabase Auth</div>
            </>
          ) : (
            <div className="login-unconfigured" role="status">
              <strong>ยังไม่ได้ตั้งค่า Supabase</strong>
              <span>ใส่ `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` จาก Supabase Project Settings ใน `.env.local` แล้ว restart server เพื่อเปิดใช้ Login/Logout</span>
              <Link href="/">กลับไปโหมด Demo</Link>
            </div>
          )}
        </form>
        <div className="login-footer">AUTO CARE <i /> NORTH PLANT <span>SECURE WORKSPACE</span></div>
      </section>
    </main>
  );
}