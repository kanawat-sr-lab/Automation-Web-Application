"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bell, Building2, Check, ChevronDown, ChevronRight, Clock3, Filter, LayoutDashboard, LogOut, Menu, Pencil, Plus, Search, SlidersHorizontal, Trash2, Wrench, X, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MachineStatus = "Running" | "Stop" | "Alarm" | "Maintenance";
type AlarmStatus = "Open" | "In progress" | "Closed";
type Section = "ภาพรวม" | "เครื่องจักร" | "Alarm" | "งาน PM";

type Machine = {
  id: string;
  name: string;
  type: string;
  location: string;
  status: MachineStatus;
};

type Alarm = {
  id: string;
  machineId: string;
  code: string;
  description: string;
  time: string;
  cause: string;
  status: AlarmStatus;
};

type Maintenance = {
  id: string;
  machineId: string;
  task: string;
  due: string;
  technician: string;
  status: "กำหนดการ" | "กำลังทำ" | "เสร็จสิ้น";
};

const initialMachines: Machine[] = [
  { id: "CNC-001", name: "CNC Milling Center", type: "CNC", location: "Line A · Zone 01", status: "Running" },
  { id: "PMP-014", name: "Cooling Water Pump", type: "Pump", location: "Utility · Zone 02", status: "Alarm" },
  { id: "CMP-003", name: "Air Compressor #3", type: "Compressor", location: "Utility · Zone 01", status: "Maintenance" },
  { id: "ROB-008", name: "Welding Robot Cell", type: "Robot", location: "Line B · Zone 04", status: "Running" },
  { id: "CON-022", name: "Assembly Conveyor", type: "Conveyor", location: "Line C · Zone 02", status: "Stop" },
  { id: "PRS-005", name: "Hydraulic Press", type: "Press", location: "Line A · Zone 03", status: "Running" },
];

const initialAlarms: Alarm[] = [
  { id: "AL-24091", machineId: "PMP-014", code: "E-204", description: "แรงดันขาออกต่ำกว่าค่ากำหนด", time: "27 ก.ย. 2026 · 10:42", cause: "ตรวจพบการรั่วที่ซีลปั๊ม", status: "Open" },
  { id: "AL-24088", machineId: "CNC-001", code: "T-017", description: "อุณหภูมิ Spindle สูง", time: "27 ก.ย. 2026 · 09:18", cause: "ระบบหล่อเย็นทำงานช้า", status: "In progress" },
  { id: "AL-24072", machineId: "CON-022", code: "M-031", description: "มอเตอร์สายพาน Overload", time: "26 ก.ย. 2026 · 16:05", cause: "มีวัสดุติดขัดบริเวณลูกกลิ้ง", status: "Closed" },
];

const initialMaintenance: Maintenance[] = [
  { id: "PM-1082", machineId: "CMP-003", task: "เปลี่ยนไส้กรองอากาศและตรวจเช็คน้ำมัน", due: "วันนี้ · 14:00", technician: "Nattapong S.", status: "กำลังทำ" },
  { id: "PM-1081", machineId: "PMP-014", task: "ตรวจสอบซีลและทดสอบแรงดันปั๊ม", due: "วันนี้ · 15:30", technician: "Krit T.", status: "กำหนดการ" },
  { id: "PM-1078", machineId: "ROB-008", task: "หล่อลื่นข้อต่อแขนกลตามรอบ 500 ชม.", due: "พรุ่งนี้ · 09:00", technician: "Ploy K.", status: "กำหนดการ" },
  { id: "PM-1072", machineId: "CNC-001", task: "สอบเทียบเซนเซอร์และตรวจรางเลื่อน", due: "25 ก.ย. 2026", technician: "Nattapong S.", status: "เสร็จสิ้น" },
];

function titleMachineStatus(status: string): MachineStatus {
  return ({ running: "Running", stop: "Stop", alarm: "Alarm", maintenance: "Maintenance" } as const)[status as "running" | "stop" | "alarm" | "maintenance"] ?? "Stop";
}

function titleAlarmStatus(status: string): AlarmStatus {
  return ({ open: "Open", in_progress: "In progress", closed: "Closed" } as const)[status as "open" | "in_progress" | "closed"] ?? "Open";
}

function titleMaintenanceStatus(status: string): Maintenance["status"] {
  return ({ planned: "กำหนดการ", in_progress: "กำลังทำ", completed: "เสร็จสิ้น" } as const)[status as "planned" | "in_progress" | "completed"] ?? "กำหนดการ";
}

const iconComponents: Record<string, LucideIcon> = {
  overview: LayoutDashboard, machine: Building2, alarm: Bell, maintenance: Wrench,
  search: Search, plus: Plus, chevron: ChevronRight, down: ChevronDown,
  close: X, filter: SlidersHorizontal, edit: Pencil, trash: Trash2,
  clock: Clock3, check: Check, menu: Menu, activity: Activity, filterAlt: Filter, logout: LogOut,
};

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const Component = iconComponents[name] ?? LayoutDashboard;
  return <Component size={size} strokeWidth={1.7} aria-hidden="true" />;
}

function Badge({ children, tone = "neutral" }: { children: string; tone?: string }) {
  return <span className={`badge badge-${tone}`}><i />{children}</span>;
}

function statusTone(status: string) {
  if (["Running", "Closed", "เสร็จสิ้น"].includes(status)) return "green";
  if (["Alarm", "Open"].includes(status)) return "red";
  if (["Maintenance", "In progress", "กำลังทำ"].includes(status)) return "amber";
  if (status === "Stop") return "gray";
  return "blue";
}

export default function Home() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [signedIn, setSignedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(Boolean(supabase));
  const [userEmail, setUserEmail] = useState("");
  const [section, setSection] = useState<Section>("ภาพรวม");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [machines, setMachines] = useState(initialMachines);
  const [alarms, setAlarms] = useState(initialAlarms);
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ทั้งหมด");
  const [role, setRole] = useState<"Admin" | "Technician">("Admin");
  const [profiles, setProfiles] = useState<{ id: string; full_name: string; role: "Admin" | "Technician" }[]>([]);
  const [modal, setModal] = useState<"machine" | "alarm" | "maintenance" | null>(null);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const loadWorkspace = async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!mounted) return;
      const user = authData.user;
      setSignedIn(Boolean(user));
      setUserEmail(user?.email ?? "");
      if (!user) {
        setAuthChecking(false);
        router.replace("/login");
        return;
      }

      const [profileResult, machineResult, alarmResult, maintenanceResult] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role"),
        supabase.from("machines").select("machine_id, machine_name, machine_type, location, status").order("machine_id"),
        supabase.from("alarms").select("id, machine_id, alarm_code, description, occurred_at, cause, status").order("occurred_at", { ascending: false }),
        supabase.from("maintenance_records").select("id, machine_id, task_description, scheduled_at, technician_id, status").order("scheduled_at", { ascending: true }),
      ]);
      if (!mounted) return;
      if (profileResult.data) {
        setProfiles(profileResult.data as typeof profiles);
        const profile = profileResult.data.find((entry) => entry.id === user.id);
        if (profile?.role === "Technician" || profile?.role === "Admin") setRole(profile.role);
      }
      if (machineResult.data) setMachines(machineResult.data.map((row) => ({ id: row.machine_id, name: row.machine_name, type: row.machine_type, location: row.location, status: titleMachineStatus(row.status) })));
      if (alarmResult.data) setAlarms(alarmResult.data.map((row) => ({ id: row.id, machineId: row.machine_id, code: row.alarm_code, description: row.description, time: new Date(row.occurred_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }), cause: row.cause ?? "รอตรวจสอบสาเหตุ", status: titleAlarmStatus(row.status) })));
      if (maintenanceResult.data) setMaintenance(maintenanceResult.data.map((row) => ({ id: row.id, machineId: row.machine_id, task: row.task_description, due: new Date(row.scheduled_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }), technician: profileResult.data?.find((profile) => profile.id === row.technician_id)?.full_name ?? "ยังไม่มอบหมาย", status: titleMaintenanceStatus(row.status) })));
      setAuthChecking(false);
    };
    void loadWorkspace();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void loadWorkspace());
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [router, supabase]);

  const machineMap = useMemo(() => new Map(machines.map((machine) => [machine.id, machine.name])), [machines]);
  const filteredMachines = useMemo(() => machines.filter((machine) => {
    const matchesSearch = `${machine.id} ${machine.name} ${machine.type} ${machine.location}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "ทั้งหมด" || machine.status === statusFilter);
  }), [machines, search, statusFilter]);
  const filteredAlarms = useMemo(() => alarms.filter((alarm) => {
    const matchesSearch = `${alarm.id} ${alarm.machineId} ${alarm.code} ${alarm.description}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "ทั้งหมด" || alarm.status === statusFilter);
  }), [alarms, search, statusFilter]);
  const filteredMaintenance = useMemo(() => maintenance.filter((item) => {
    const matchesSearch = `${item.id} ${item.machineId} ${item.task} ${item.technician}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (statusFilter === "ทั้งหมด" || item.status === statusFilter);
  }), [maintenance, search, statusFilter]);
  const counts = useMemo(() => machines.reduce((result, machine) => {
    result[machine.status] = (result[machine.status] ?? 0) + 1;
    return result;
  }, { Running: 0, Stop: 0, Alarm: 0, Maintenance: 0 } as Record<MachineStatus, number>), [machines]);
  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) return showNotice("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง");
    setSignedIn(false);
    setUserEmail("");
    router.replace("/login");
    router.refresh();
  }

  async function saveMachine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const machine: Machine = {
      id: String(formData.get("id")).trim().toUpperCase(),
      name: String(formData.get("name")).trim(),
      type: String(formData.get("type")).trim(),
      location: String(formData.get("location")).trim(),
      status: String(formData.get("status")) as MachineStatus,
    };
    if (!machine.id || !machine.name || !machine.type || !machine.location) return showNotice("กรุณากรอกข้อมูลให้ครบทุกช่อง");
    if (!editingMachine && machines.some((item) => item.id === machine.id)) return showNotice("Machine ID นี้ถูกใช้งานแล้ว");
    if (role !== "Admin") return showNotice("เฉพาะ Admin เท่านั้นที่จัดการทะเบียนเครื่องจักรได้");
    if (supabase) {
      const values = { machine_id: machine.id, machine_name: machine.name, machine_type: machine.type, location: machine.location, status: machine.status.toLowerCase() };
      const { error } = editingMachine
        ? await supabase.from("machines").update(values).eq("machine_id", editingMachine.id)
        : await supabase.from("machines").insert(values);
      if (error) return showNotice(error.code === "23505" ? "Machine ID นี้ถูกใช้งานแล้ว" : "บันทึกไม่สำเร็จ กรุณาตรวจสอบสิทธิ์และข้อมูล");
    }
    if (editingMachine) setMachines((items) => items.map((item) => item.id === editingMachine.id ? machine : item));
    else setMachines((items) => [machine, ...items]);
    setModal(null);
    setEditingMachine(null);
    showNotice(editingMachine ? "บันทึกการแก้ไขแล้ว" : "เพิ่มเครื่องจักรแล้ว");
  }

  async function saveAlarm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const alarm: Alarm = {
      id: `AL-${Date.now().toString().slice(-5)}`,
      machineId: String(formData.get("machineId")),
      code: String(formData.get("code")).trim().toUpperCase(),
      description: String(formData.get("description")).trim(),
      time: new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }),
      cause: String(formData.get("cause")).trim(),
      status: "Open",
    };
    if (!alarm.machineId || !alarm.code || !alarm.description || !alarm.cause) return showNotice("กรุณากรอกข้อมูล Alarm ให้ครบ");
    if (supabase) {
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("alarms").insert({ machine_id: alarm.machineId, alarm_code: alarm.code, description: alarm.description, cause: alarm.cause, status: "open", created_by: auth.user?.id }).select("id").single();
      if (error) return showNotice("บันทึก Alarm ไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
      alarm.id = data.id;
    }
    setAlarms((items) => [alarm, ...items]);
    setMachines((items) => items.map((machine) => machine.id === alarm.machineId && machine.status !== "Maintenance" ? { ...machine, status: "Alarm" } : machine));
    setModal(null);
    showNotice("บันทึก Alarm แล้ว");
  }

  async function saveMaintenance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const item: Maintenance = {
      id: `PM-${Date.now().toString().slice(-4)}`,
      machineId: String(formData.get("machineId")),
      task: String(formData.get("task")).trim(),
      due: String(formData.get("due")),
      technician: String(formData.get("technician")).trim(),
      status: "กำหนดการ",
    };
    if (!item.machineId || !item.task || !item.due || !item.technician) return showNotice("กรุณากรอกข้อมูลงาน PM ให้ครบ");
    if (supabase) {
      const { data: auth } = await supabase.auth.getUser();
      const technicianId = role === "Admin" ? item.technician : auth.user?.id;
      const { data, error } = await supabase.from("maintenance_records").insert({ machine_id: item.machineId, task_description: item.task, scheduled_at: new Date(item.due).toISOString(), technician_id: technicianId || null, created_by: auth.user?.id, status: "planned" }).select("id").single();
      if (error) return showNotice("สร้างแผน PM ไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
      item.id = data.id;
      item.technician = profiles.find((profile) => profile.id === technicianId)?.full_name ?? "ยังไม่มอบหมาย";
    }
    setMaintenance((items) => [item, ...items]);
    setModal(null);
    showNotice("สร้างแผน PM แล้ว");
  }

  async function cycleStatus(id: string) {
    const order: AlarmStatus[] = ["Open", "In progress", "Closed"];
    const alarm = alarms.find((item) => item.id === id);
    if (!alarm) return;
    const status = order[(order.indexOf(alarm.status) + 1) % order.length];
    if (supabase) {
      const { error } = await supabase.from("alarms").update({ status: status === "In progress" ? "in_progress" : status.toLowerCase() }).eq("id", id);
      if (error) return showNotice("สถานะ Alarm เปลี่ยนไม่สำเร็จ");
    }
    setAlarms((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    const hasActiveAlarm = alarms.some((item) => item.id !== id && item.machineId === alarm.machineId && item.status !== "Closed");
    setMachines((items) => items.map((machine) => machine.id === alarm.machineId
      ? { ...machine, status: status !== "Closed" ? "Alarm" : hasActiveAlarm ? "Alarm" : machine.status === "Alarm" ? "Running" : machine.status }
      : machine));
  }

  async function cycleMaintenanceStatus(id: string) {
    const order: Maintenance["status"][] = ["กำหนดการ", "กำลังทำ", "เสร็จสิ้น"];
    const item = maintenance.find((entry) => entry.id === id);
    if (!item) return;
    const status = order[(order.indexOf(item.status) + 1) % order.length];
    if (supabase) {
      const statusValue = status === "กำลังทำ" ? "in_progress" : status === "เสร็จสิ้น" ? "completed" : "planned";
      const { error } = await supabase.from("maintenance_records").update({ status: statusValue, completed_at: status === "เสร็จสิ้น" ? new Date().toISOString() : null }).eq("id", id);
      if (error) return showNotice("อัปเดตงาน PM ไม่สำเร็จ");
    }
    setMaintenance((items) => items.map((entry) => entry.id === id ? { ...entry, status } : entry));
    showNotice("อัปเดตสถานะงาน PM แล้ว");
  }

  async function deleteMachine(id: string) {
    if (role !== "Admin") return showNotice("เฉพาะ Admin เท่านั้นที่ลบเครื่องจักรได้");
    if (supabase) {
      const { error } = await supabase.from("machines").delete().eq("machine_id", id);
      if (error) return showNotice("ลบไม่ได้: มี Alarm หรือประวัติ PM อ้างอิงเครื่องนี้อยู่");
    }
    setMachines((items) => items.filter((item) => item.id !== id));
    showNotice("ลบเครื่องจักรแล้ว");
  }

  const navItems: { label: Section; icon: string }[] = [
    { label: "ภาพรวม", icon: "overview" },
    { label: "เครื่องจักร", icon: "machine" },
    { label: "Alarm", icon: "alarm" },
    { label: "งาน PM", icon: "maintenance" },
  ];
  const activeFilterOptions = section === "เครื่องจักร" ? ["ทั้งหมด", "Running", "Stop", "Alarm", "Maintenance"] : section === "Alarm" ? ["ทั้งหมด", "Open", "In progress", "Closed"] : ["ทั้งหมด", "กำหนดการ", "กำลังทำ", "เสร็จสิ้น"];

  if (supabase && (authChecking || !signedIn)) {
    return <main className="auth-loading" role="status" aria-label="กำลังตรวจสอบสิทธิ์"><span /> กำลังตรวจสอบการเข้าสู่ระบบ...</main>;
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
        <a className="brand" href="#overview" onClick={() => setSection("ภาพรวม")}>
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">Auto <span>Care</span><small>PLANT OPERATIONS</small></span>
        </a>
        <div className="plant-switch"><span className="plant-icon">N</span><span><b>North Plant</b><small>Bangkok · Factory 01</small></span><Icon name="down" size={15} /></div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="side-nav" aria-label="เมนูหลัก">
          {navItems.map((item) => <button key={item.label} aria-label={item.label} title={item.label} className={`nav-link ${section === item.label ? "active" : ""}`} onClick={() => { setSection(item.label); setStatusFilter("ทั้งหมด"); setMobileNavOpen(false); }}><Icon name={item.icon} /><span>{item.label}</span>{item.label === "Alarm" && <em>{alarms.filter((alarm) => alarm.status !== "Closed").length}</em>}</button>)}
        </nav>
        <div className="sidebar-spacer" />
        <div className="shift-card"><div className="shift-heading"><span className="online-dot" /> กะเช้า <b>06:00 — 14:00</b></div><p>ระบบกำลังทำงานปกติ</p><div className="shift-line"><i /></div><small>ตรวจสอบล่าสุด 10:48 น.</small></div>
        <button className="profile-row" aria-label={supabase ? "ออกจากระบบ" : "โหมด Demo: ยังไม่ได้ตั้งค่า Supabase"} disabled={!supabase} onClick={() => void signOut()} title={supabase ? "ออกจากระบบ" : "ตั้งค่า Supabase เพื่อเปิดใช้ Login/Logout"}><span className="avatar">{supabase ? userEmail.slice(0, 2).toUpperCase() : "NS"}</span><span className="profile-copy"><b>{userEmail || "Nattapong S."}</b><small>{role}{supabase ? " · ออกจากระบบ" : " · DEMO"}</small></span><span className="logout-label"><Icon name={supabase ? "logout" : "down"} size={15} /><span>{supabase ? "ออกจากระบบ" : "DEMO"}</span></span></button>
      </aside>

      <section className="main-panel">
        <header className="topbar"><button className="mobile-menu icon-button" aria-label="เมนู" aria-expanded={mobileNavOpen} onClick={() => setMobileNavOpen((open) => !open)}><Icon name="menu" /></button><div className="breadcrumb">Operations <Icon name="chevron" size={14} /><b>{section}</b></div><div className="topbar-right"><span className={`live-status ${supabase ? "" : "demo-status"}`}><i />{supabase ? "LIVE" : "DEMO"}</span><span className="top-date">อาทิตย์ 27 กันยายน 2026</span><button className="top-alarm" aria-label="การแจ้งเตือน" onClick={() => setSection("Alarm")}><Icon name="alarm" /><i /></button><span className="top-avatar">{supabase ? userEmail.slice(0, 2).toUpperCase() : "NS"}</span></div></header>

        <div className="content-area">
          <div className="page-heading"><div><div className="eyebrow"><span /> NORTH PLANT <span className="eyebrow-divider">/</span> OPERATIONS</div><h1>{section === "ภาพรวม" ? "ภาพรวมการผลิต" : section === "เครื่องจักร" ? "ทะเบียนเครื่องจักร" : section === "Alarm" ? "Alarm & Events" : "แผนบำรุงรักษา"}</h1><p>{section === "ภาพรวม" ? "ติดตามสถานะเครื่องจักรและงานบำรุงรักษาแบบเรียลไทม์" : `จัดการ${section === "เครื่องจักร" ? "ข้อมูลเครื่องจักรในโรงงาน" : section === "Alarm" ? "เหตุขัดข้องและติดตามการแก้ไข" : "ตารางบำรุงรักษาเชิงป้องกัน"}`}</p></div><div className="heading-actions"><button className="outline-button" onClick={() => showNotice("อัปเดตข้อมูลล่าสุดแล้ว")}><span className="refresh-glyph">↻</span> อัปเดตล่าสุด <b>10:48</b></button>{section !== "ภาพรวม" && <button className="primary-button" onClick={() => { setEditingMachine(null); setModal(section === "เครื่องจักร" ? "machine" : section === "Alarm" ? "alarm" : "maintenance"); }}><Icon name="plus" size={17} />{section === "เครื่องจักร" ? "เพิ่มเครื่องจักร" : section === "Alarm" ? "บันทึก Alarm" : "สร้างแผน PM"}</button>}</div></div>

          {section === "ภาพรวม" && <>
            <div className="metric-grid">
              <article className="metric-card total-card"><div className="metric-top"><span>เครื่องจักรทั้งหมด</span><span className="metric-icon mint"><Icon name="machine" /></span></div><div className="metric-value">{machines.length}<small> เครื่อง</small></div><div className="metric-foot"><span className="trend-up">+2</span> จากเดือนที่แล้ว</div><div className="metric-watermark">01</div></article>
              <article className="metric-card"><div className="metric-top"><span>กำลังเดินเครื่อง</span><span className="metric-icon green"><i className="pulse-dot" /></span></div><div className="metric-value">{counts.Running}<small> เครื่อง</small></div><div className="metric-foot"><span className="metric-dot green-dot" />{machines.length ? Math.round((counts.Running / machines.length) * 100) : 0}% ของเครื่องจักรทั้งหมด</div></article>
              <article className="metric-card"><div className="metric-top"><span>Alarm ที่ยังเปิดอยู่</span><span className="metric-icon red"><Icon name="alarm" size={17} /></span></div><div className="metric-value">{alarms.filter((alarm) => alarm.status !== "Closed").length}<small> รายการ</small></div><div className="metric-foot"><span className="metric-dot red-dot" />{counts.Alarm} เครื่อง Alarm · {counts.Stop} เครื่องหยุด</div></article>
              <article className="metric-card"><div className="metric-top"><span>งาน PM คงค้าง</span><span className="metric-icon amber"><Icon name="maintenance" size={17} /></span></div><div className="metric-value">{maintenance.filter((item) => item.status !== "เสร็จสิ้น").length}<small> งาน</small></div><div className="metric-foot"><span className="metric-dot amber-dot" />{counts.Maintenance} เครื่องอยู่ระหว่างบำรุงรักษา</div></article>
            </div>

            <div className="overview-grid"><section className="panel machine-panel"><div className="panel-heading"><div><h2>สถานะเครื่องจักร</h2><p>Machine health overview</p></div><button className="text-button" onClick={() => setSection("เครื่องจักร")}>ดูทั้งหมด <Icon name="chevron" size={15} /></button></div><div className="status-summary"><div><i className="summary-dot green-dot" /><span>Running</span><b>{counts.Running}</b></div><div><i className="summary-dot gray-dot" /><span>Stop</span><b>{counts.Stop}</b></div><div><i className="summary-dot red-dot" /><span>Alarm</span><b>{counts.Alarm}</b></div><div><i className="summary-dot amber-dot" /><span>PM</span><b>{counts.Maintenance}</b></div></div><div className="machine-list">{machines.slice(0, 5).map((machine) => <div className="machine-row" key={machine.id}><span className={`machine-type-icon type-${machine.type.toLowerCase()}`}>{machine.type.slice(0, 2).toUpperCase()}</span><span className="machine-info"><b>{machine.name}</b><small>{machine.id} <i /> {machine.location}</small></span><Badge tone={statusTone(machine.status)}>{machine.status}</Badge></div>)}</div></section>
              <section className="panel chart-panel"><div className="panel-heading"><div><h2>ประสิทธิภาพการทำงาน</h2><p>Uptime · 7 วันที่ผ่านมา</p></div><button className="select-compact">สัปดาห์นี้ <Icon name="down" size={13} /></button></div><div className="uptime-number">96.8<span>%</span><small><i>↑ 2.4%</i> จากสัปดาห์ก่อน</small></div><div className="chart" aria-label="กราฟประสิทธิภาพรายวัน"><div className="chart-grid"><span>100%</span><span>75%</span><span>50%</span><span>25%</span></div>{[76, 88, 82, 94, 89, 97, 93].map((height, index) => <div className="bar-column" key={index}><div className="bar-value" style={{ height: `${height}%` }}><i style={{ height: `${Math.max(22, height - (index % 3) * 12)}%` }} /></div><small>{["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."][index]}</small></div>)}</div><div className="chart-legend"><span><i className="legend-bar" /> Uptime รายวัน</span><span>เป้าหมาย 95%</span></div></section></div>

            <div className="lower-grid"><section className="panel alarms-panel"><div className="panel-heading"><div><h2>Alarm ล่าสุด</h2><p>รายการที่ต้องตรวจสอบ</p></div><button className="text-button" onClick={() => setSection("Alarm")}>ดูทั้งหมด <Icon name="chevron" size={15} /></button></div>{alarms.filter((alarm) => alarm.status !== "Closed").slice(0, 3).map((alarm) => <div className="alarm-row" key={alarm.id}><span className="alarm-indicator"><Icon name="alarm" size={16} /></span><div className="alarm-copy"><b>{alarm.description}</b><small>{alarm.machineId} <i /> {alarm.code} <i /> {alarm.time}</small></div><Badge tone={statusTone(alarm.status)}>{alarm.status}</Badge></div>)}{alarms.every((alarm) => alarm.status === "Closed") && <div className="empty-note">ไม่มี Alarm ที่ต้องติดตาม</div>}</section><section className="panel pm-panel"><div className="panel-heading"><div><h2>งาน PM ใกล้ถึงกำหนด</h2><p>Preventive maintenance</p></div><button className="text-button" onClick={() => setSection("งาน PM")}>ตาราง PM <Icon name="chevron" size={15} /></button></div>{maintenance.filter((item) => item.status !== "เสร็จสิ้น").slice(0, 3).map((item) => <div className="pm-row" key={item.id}><span className="pm-date"><b>{item.due.split(" ")[0]}</b><small>{item.due.includes("วันนี้") ? "TODAY" : item.due.includes("พรุ่งนี้") ? "TOMORROW" : "SCHEDULED"}</small></span><span className="pm-copy"><b>{item.task}</b><small>{item.machineId} <i /> {item.technician}</small></span><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>)}</section></div>
          </>}

          {section !== "ภาพรวม" && <section className="panel data-panel"><div className="table-toolbar"><div className="search-box"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหา ID, ชื่อ, รหัส..." aria-label="ค้นหารายการ" /><kbd>⌘ K</kbd></div><label className="filter-control"><Icon name="filter" size={16} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="กรองตามสถานะ">{activeFilterOptions.map((option) => <option key={option}>{option}</option>)}</select><Icon name="down" size={13} /></label><span className="result-count">{section === "เครื่องจักร" ? filteredMachines.length : section === "Alarm" ? filteredAlarms.length : filteredMaintenance.length} รายการ</span></div>
            {section === "เครื่องจักร" && <div className="table-scroll"><table><thead><tr><th>รหัส / เครื่องจักร</th><th>ประเภท</th><th>ตำแหน่ง</th><th>สถานะ</th><th aria-label="การดำเนินการ" /></tr></thead><tbody>{filteredMachines.map((machine) => <tr key={machine.id}><td><div className="table-machine"><span className={`machine-type-icon type-${machine.type.toLowerCase()}`}>{machine.type.slice(0, 2).toUpperCase()}</span><span><b>{machine.name}</b><small>{machine.id}</small></span></div></td><td>{machine.type}</td><td>{machine.location}</td><td><Badge tone={statusTone(machine.status)}>{machine.status}</Badge></td><td><div className="row-actions"><button title="แก้ไข" disabled={role !== "Admin"} onClick={() => { setEditingMachine(machine); setModal("machine"); }}><Icon name="edit" size={16} /></button><button title="ลบ" disabled={role !== "Admin"} onClick={() => void deleteMachine(machine.id)}><Icon name="trash" size={16} /></button></div></td></tr>)}</tbody></table>{filteredMachines.length === 0 && <div className="empty-note">ไม่พบเครื่องจักรที่ตรงกับเงื่อนไข</div>}</div>}
            {section === "Alarm" && <div className="table-scroll"><table><thead><tr><th>Alarm / รายละเอียด</th><th>เครื่องจักร</th><th>เวลา</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{filteredAlarms.map((alarm) => <tr key={alarm.id}><td><div className="alarm-table-cell"><b>{alarm.code} <span>{alarm.id}</span></b><small>{alarm.description}</small></div></td><td><b>{alarm.machineId}</b><small className="cell-subtitle">{machineMap.get(alarm.machineId)}</small></td><td>{alarm.time}</td><td><Badge tone={statusTone(alarm.status)}>{alarm.status}</Badge></td><td><button className="status-action" onClick={() => cycleStatus(alarm.id)}>{alarm.status === "Closed" ? "เปิดใหม่" : "เปลี่ยนสถานะ"}</button></td></tr>)}</tbody></table>{filteredAlarms.length === 0 && <div className="empty-note">ไม่พบ Alarm ที่ตรงกับเงื่อนไข</div>}</div>}
            {section === "งาน PM" && <div className="table-scroll"><table><thead><tr><th>รหัส / รายการบำรุงรักษา</th><th>เครื่องจักร</th><th>กำหนดการ</th><th>ผู้รับผิดชอบ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{filteredMaintenance.map((item) => <tr key={item.id}><td><div className="alarm-table-cell"><b>{item.id}</b><small>{item.task}</small></div></td><td><b>{item.machineId}</b><small className="cell-subtitle">{machineMap.get(item.machineId)}</small></td><td><Icon name="clock" size={14} /> {item.due}</td><td>{item.technician}</td><td><Badge tone={statusTone(item.status)}>{item.status}</Badge></td><td><button className="status-action" onClick={() => void cycleMaintenanceStatus(item.id)}>{item.status === "เสร็จสิ้น" ? "เปิดงานใหม่" : "อัปเดตสถานะ"}</button></td></tr>)}</tbody></table>{filteredMaintenance.length === 0 && <div className="empty-note">ไม่พบงาน PM ที่ตรงกับเงื่อนไข</div>}</div>}
            <div className="table-footer"><span>แสดงข้อมูลตามตัวกรองปัจจุบัน</span><span>North Plant <i /> ซิงก์ล่าสุด 10:48</span></div>
          </section>}
          <footer className="page-footer"><span>AUTO CARE <i /> ระบบจัดการงานซ่อมบำรุง</span><span>Plant operations · เวอร์ชัน 1.0.0</span></footer>
        </div>
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModal(null); setEditingMachine(null); } }}><section className="form-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="modal-kicker">NORTH PLANT · MASTER DATA</span><h2 id="modal-title">{modal === "machine" ? editingMachine ? "แก้ไขเครื่องจักร" : "เพิ่มเครื่องจักร" : modal === "alarm" ? "บันทึก Alarm" : "สร้างแผนบำรุงรักษา"}</h2></div><button className="icon-button" onClick={() => { setModal(null); setEditingMachine(null); }} aria-label="ปิด"><Icon name="close" /></button></div><form onSubmit={modal === "machine" ? saveMachine : modal === "alarm" ? saveAlarm : saveMaintenance}>
        {modal === "machine" && <><label>Machine ID <span>*</span><input name="id" defaultValue={editingMachine?.id} placeholder="เช่น CNC-009" required pattern="[A-Za-z0-9\-]{2,24}" title="ใช้ตัวอักษร ตัวเลข หรือขีดกลาง 2-24 ตัว" disabled={Boolean(editingMachine)} /></label><label>ชื่อเครื่องจักร <span>*</span><input name="name" defaultValue={editingMachine?.name} placeholder="ระบุชื่อเครื่องจักร" required maxLength={80} /></label><div className="form-row"><label>ประเภท <span>*</span><input name="type" defaultValue={editingMachine?.type} placeholder="เช่น CNC" required maxLength={40} /></label><label>สถานะ <span>*</span><select name="status" defaultValue={editingMachine?.status ?? "Running"}>{["Running", "Stop", "Alarm", "Maintenance"].map((status) => <option key={status}>{status}</option>)}</select></label></div><label>ตำแหน่งติดตั้ง <span>*</span><input name="location" defaultValue={editingMachine?.location} placeholder="เช่น Line A · Zone 01" required maxLength={80} /></label></>}
        {modal === "alarm" && <><label>เครื่องจักร <span>*</span><select name="machineId" required defaultValue="">{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.id} · {machine.name}</option>)}</select></label><label>Alarm Code <span>*</span><input name="code" placeholder="เช่น E-204" required maxLength={32} /></label><label>รายละเอียด Alarm <span>*</span><textarea name="description" placeholder="อธิบายอาการที่พบ" required maxLength={300} rows={3} /></label><label>สาเหตุที่พบ / เบื้องต้น <span>*</span><textarea name="cause" placeholder="ระบุสาเหตุหรือสิ่งที่ตรวจพบ" required maxLength={1000} rows={2} /></label></>}
        {modal === "maintenance" && <><label>เครื่องจักร <span>*</span><select name="machineId" required>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.id} · {machine.name}</option>)}</select></label><label>รายละเอียดงาน <span>*</span><textarea name="task" placeholder="ระบุรายการตรวจเช็กหรือบำรุงรักษา" required maxLength={300} rows={3} /></label><div className="form-row"><label>กำหนดวันที่ <span>*</span><input name="due" type="date" required /></label><label>ช่างผู้รับผิดชอบ <span>*</span>{role === "Admin" && supabase ? <select name="technician" defaultValue="" required><option value="" disabled>เลือกช่างผู้รับผิดชอบ</option>{profiles.filter((profile) => profile.role === "Technician").map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</select> : supabase ? <input name="technician" value={userEmail} readOnly /> : <input name="technician" placeholder="ชื่อช่าง" required maxLength={80} />}</label></div></>}
        <div className="modal-actions"><button type="button" className="cancel-button" onClick={() => { setModal(null); setEditingMachine(null); }}>ยกเลิก</button><button type="submit" className="primary-button"><Icon name="check" size={16} /> บันทึกข้อมูล</button></div></form></section></div>}
      {notice && <div className="toast"><span><Icon name="check" size={16} /></span>{notice}</div>}
    </main>
  );
}
