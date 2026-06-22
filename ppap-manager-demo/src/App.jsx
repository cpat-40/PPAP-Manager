import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import {
  ClipboardCheck, FileText, LayoutDashboard, FolderKanban, LogOut, ChevronRight,
  CheckCircle2, Circle, Clock, Upload, Plus, Trash2, ArrowLeft, ShieldCheck,
  XCircle, Send, Gauge, AlertTriangle, Factory, UserCircle2, Download, RotateCcw,
  Settings, Lock, BarChart3, MessageSquare, Pencil, Table2,
} from "lucide-react";

/* ================================================================== *
 *  PPAP Manager — demo build
 *  Client-only. All data persists in the visitor's own browser
 *  (localStorage). No backend, no accounts, nothing shared.
 * ================================================================== */

const ELEMENTS = [
  { id: "design_records", name: "Design Records", n: 1, desc: "Part drawings, specifications, and design documents", kind: "upload" },
  { id: "engineering_change_documents", name: "Engineering Change Documents", n: 2, desc: "Authorized engineering change documentation", kind: "upload" },
  { id: "customer_engineering_approval", name: "Customer Engineering Approval", n: 3, desc: "Customer approval of design and specification", kind: "upload" },
  { id: "design_fmea", name: "Design FMEA", n: 4, desc: "Design Failure Mode and Effects Analysis", kind: "fmea" },
  { id: "process_flow_diagram", name: "Process Flow Diagram", n: 5, desc: "Manufacturing sequence flow chart", kind: "flow" },
  { id: "process_fmea", name: "Process FMEA", n: 6, desc: "Process Failure Mode and Effects Analysis", kind: "fmea" },
  { id: "control_plan", name: "Control Plan", n: 7, desc: "Systems for controlling parts and processes", kind: "controlplan" },
  { id: "measurement_system_analysis", name: "Measurement System Analysis", n: 8, desc: "Studies analyzing measurement variation", kind: "msa" },
  { id: "dimensional_results", name: "Dimensional Results", n: 9, desc: "Complete dimensional evaluation of features", kind: "dimensional" },
  { id: "material_performance_results", name: "Material / Performance Test Results", n: 10, desc: "Material and performance testing documentation", kind: "material" },
  { id: "initial_sample_inspection", name: "Initial Process Studies", n: 11, desc: "Statistical studies of process capability", kind: "capability" },
  { id: "qualified_lab_docs", name: "Qualified Laboratory Documentation", n: 12, desc: "External laboratory accreditation records", kind: "upload" },
  { id: "appearance_approval_report", name: "Appearance Approval Report", n: 13, desc: "Documentation for appearance-approval parts", kind: "upload" },
  { id: "sample_production_parts", name: "Sample Production Parts", n: 14, desc: "Parts from production tooling and processes", kind: "upload" },
  { id: "master_sample", name: "Master Sample", n: 15, desc: "Representative sample retained by supplier", kind: "upload" },
  { id: "checking_aids", name: "Checking Aids", n: 16, desc: "Functional gauges and checking fixtures", kind: "upload" },
  { id: "customer_specific_requirements", name: "Customer-Specific Requirements", n: 17, desc: "Compliance with customer requirements", kind: "csr" },
  { id: "part_submission_warrant", name: "Part Submission Warrant", n: 18, desc: "Summary document declaring compliance", kind: "psw" },
];

const LEVEL_NOTE = {
  1: "Warrant only — submitted to customer.",
  2: "Warrant with product samples and limited supporting data.",
  3: "Warrant, samples, and complete supporting data (default).",
  4: "Warrant and customer-defined requirements.",
  5: "Warrant with samples; full data reviewed at the supplier site.",
};

// Submission level → which elements are required.
function requiredFor(level) {
  if (level === 1) return new Set(["part_submission_warrant"]);
  if (level === 2)
    return new Set([
      "design_records", "dimensional_results", "material_performance_results",
      "appearance_approval_report", "sample_production_parts", "part_submission_warrant",
    ]);
  return new Set(ELEMENTS.map((e) => e.id)); // 3, 4, 5 → full set
}

const blueprint = {
  backgroundColor: "#0b1220",
  backgroundImage:
    "linear-gradient(rgba(56,108,179,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(56,108,179,0.12) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

/* --------------------------- persistence --------------------------- */
const STORAGE_KEY = "ppap-demo-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* quota or privacy mode — demo still works in-session */ }
}

function blankElements() {
  const out = {};
  ELEMENTS.forEach((e) => (out[e.id] = { status: "not_started", data: {} }));
  return out;
}

let _id = 100;
const nextId = () => ++_id;

function completedElements() {
  const out = {};
  ELEMENTS.forEach((e) => (out[e.id] = { status: "completed", data: { files: [{ name: `${e.id}_evidence.pdf`, size: 120000 }] } }));
  out.design_fmea = {
    status: "completed",
    data: { rows: [
      { id: 1, item: "Sensor boss", fn: "Retain sensor", mode: "Boss strips", effect: "Sensor loose", sev: 7, cause: "Over-torque", occ: 3, ctrl: "Torque spec + poka-yoke", det: 2 },
      { id: 2, item: "Seal groove", fn: "Seat O-ring", mode: "Groove undersize", effect: "Coolant leak", sev: 8, cause: "Tool wear", occ: 2, ctrl: "SPC on groove width", det: 3 },
    ] },
  };
  out.process_fmea = {
    status: "completed",
    data: { rows: [
      { id: 1, item: "CNC mill op 20", fn: "Machine bore", mode: "Oversize bore", effect: "Loose fit", sev: 6, cause: "Tool offset drift", occ: 3, ctrl: "In-process gauging", det: 2 },
    ] },
  };
  out.dimensional_results = {
    status: "completed",
    data: { rows: [
      { id: 1, feature: "Bore Ø", nominal: "12.00", minus: "0.02", plus: "0.02", actual: "12.005" },
      { id: 2, feature: "Overall length", nominal: "48.0", minus: "0.1", plus: "0.1", actual: "48.03" },
      { id: 3, feature: "Seal groove width", nominal: "2.50", minus: "0.05", plus: "0.05", actual: "2.49" },
    ] },
  };
  out.process_flow_diagram = { status: "completed", data: { steps: [
    { id: 1, name: "Receive raw casting", type: "Operation", desc: "Aluminum housing blank" },
    { id: 2, name: "CNC machine bore", type: "Operation", desc: "Mill op 20" },
    { id: 3, name: "In-process gauging", type: "Inspection", desc: "Bore Ø check" },
    { id: 4, name: "Wash & deburr", type: "Operation", desc: "" },
    { id: 5, name: "Final inspection", type: "Inspection", desc: "Dimensional + visual" },
  ] } };
  out.control_plan = { status: "completed", data: { rows: [
    { id: 1, characteristic: "Bore Ø", spec: "12.0 ±0.02", method: "CMM", freq: "5/shift", reaction: "Quarantine + adjust offset" },
    { id: 2, characteristic: "Seal groove width", spec: "2.50 ±0.05", method: "Optical comparator", freq: "Hourly", reaction: "Replace tool, sort batch" },
  ] } };
  out.measurement_system_analysis = { status: "completed", data: { ev: "0.08", av: "0.05", pv: "1.20", tol: "0.04" } };
  out.initial_sample_inspection = { status: "completed", data: { lsl: "11.98", usl: "12.02", mean: "12.005", sd: "0.004" } };
  out.material_performance_results = { status: "completed", data: { rows: [
    { id: 1, test: "Salt spray", requirement: "≥ 96 h", result: "120 h", verdict: "pass" },
    { id: 2, test: "Tensile strength", requirement: "≥ 240 MPa", result: "268 MPa", verdict: "pass" },
  ] } };
  out.customer_specific_requirements = { status: "completed", data: { items: CSR_DEFAULTS.map((text, i) => ({ id: i + 1, text, met: true, note: "On file" })) } };
  out.part_submission_warrant = { status: "completed", data: { reason: "Initial submission", declared: true } };
  return out;
}

function evt(text, daysAgo = 0) {
  const d = new Date(); d.setDate(d.getDate() - daysAgo);
  return { t: d.toISOString().slice(0, 10), text };
}
function withEvent(project, text) {
  return { ...project, activity: [evt(text), ...(project.activity || [])] };
}

function seedProjects() {
  const elements = blankElements();
  elements.design_records = { status: "completed", data: { files: [{ name: "bracket_47829-A_revC.pdf", size: 248000 }], notes: "Released drawing, Rev C." } };
  elements.process_flow_diagram = { status: "completed", data: { files: [{ name: "process_flow_47829.png", size: 96000 }] } };
  elements.control_plan = { status: "in_progress", data: {} };
  elements.customer_engineering_approval = { status: "in_progress", data: { notes: "Design approval requested — awaiting customer sign-off." } };
  elements.design_fmea = {
    status: "in_progress",
    data: { rows: [
      { id: 1, item: "Mounting tab", fn: "Locate bracket", mode: "Tab cracks", effect: "Loss of retention", sev: 8, cause: "Stress concentration", occ: 4, ctrl: "FEA + radius spec", det: 3 },
    ] },
  };
  return [
    {
      id: 1,
      name: "Bracket Assembly — Front Subframe",
      partNumber: "47829-A",
      partName: "Subframe Mounting Bracket",
      customer: "Meridian Motors",
      supplier: "ABC Manufacturing",
      revision: "C",
      level: 3,
      status: "draft",
      submission: null,
      elements,
      activity: [evt("Design records uploaded", 4), evt("Project created", 6)],
    },
    {
      id: 2,
      name: "Sensor Housing — Cooling Module",
      partNumber: "51120-B",
      partName: "Coolant Temp Sensor Housing",
      customer: "Meridian Motors",
      supplier: "ABC Manufacturing",
      revision: "B",
      level: 3,
      status: "approved",
      submission: { status: "approved", comments: "Reviewed and approved. Good capability on the seal groove." },
      elements: completedElements(),
      activity: [evt("Approved by Meridian Motors", 1), evt("Submitted to customer", 3), evt("Project created", 14)],
    },
    {
      id: 3,
      name: "Pump Impeller — Coolant Loop",
      partNumber: "63004-A",
      partName: "Centrifugal Coolant Impeller",
      customer: "Meridian Motors",
      supplier: "ABC Manufacturing",
      revision: "A",
      level: 3,
      status: "submitted",
      submission: { status: "pending", comments: "" },
      elements: completedElements(),
      activity: [evt("Submitted to customer", 1), evt("Customer engineering approval granted", 2), evt("Project created", 10)],
    },
  ];
}

/* ============================== app ============================== */
export default function App() {
  const initial = loadState();
  const [user, setUser] = useState(initial?.user || null);
  const [projects, setProjects] = useState(initial?.projects || seedProjects());
  const [route, setRoute] = useState({ view: "dashboard", projectId: null, elementId: null });

  useEffect(() => {
    saveState({ user, projects });
  }, [user, projects]);

  const updateProject = (id, updater) =>
    setProjects((ps) => ps.map((p) => (p.id === id ? updater(p) : p)));

  const resetDemo = () => {
    if (!confirm("Reset the demo? This clears every project stored in your browser and reloads the sample data.")) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
    setProjects(seedProjects());
    setRoute({ view: "dashboard", projectId: null, elementId: null });
  };

  if (!user) return <Login onLogin={(u) => { setUser(u); setRoute({ view: "dashboard", projectId: null, elementId: null }); }} />;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col text-slate-800">
      <DemoBanner onReset={resetDemo} />
      <div className="flex flex-1 overflow-hidden border-x border-slate-200 bg-slate-50">
        <Sidebar user={user} route={route} setRoute={setRoute} onLogout={() => setUser(null)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} route={route} setRoute={setRoute} onLogout={() => setUser(null)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Content
              user={user}
              projects={projects}
              setProjects={setProjects}
              updateProject={updateProject}
              route={route}
              setRoute={setRoute}
            />
          </main>
        </div>
      </div>
    </div>
  );
}

function TopBar({ user, route, setRoute, onLogout }) {
  const roleColor = user.role === "customer" ? "bg-emerald-100 text-emerald-700"
    : user.role === "admin" ? "bg-violet-100 text-violet-700" : "bg-blue-100 text-blue-700";
  const navItems = [
    { key: "dashboard", label: user.role === "customer" ? "Review" : "Home" },
    { key: "projects", label: "Projects" },
    { key: "analytics", label: "Stats" },
  ];
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
      <span className="hidden text-sm font-medium text-slate-700 sm:inline">PPAP workspace</span>
      <nav className="flex gap-1 sm:hidden">
        {navItems.map((it) => {
          const active = route.view === it.key || (it.key === "projects" && (route.view === "project" || route.view === "element"));
          return (
            <button key={it.key} onClick={() => setRoute({ view: it.key, projectId: null, elementId: null })}
              className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{it.label}</button>
          );
        })}
      </nav>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleColor}`}>{user.role}</span>
        <span className="hidden text-sm text-slate-600 sm:inline">{user.name}</span>
        <button onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <LogOut size={15} /> <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  );
}

function DemoBanner({ onReset }) {
  return (
    <div className="flex items-center justify-between gap-3 border-x border-t border-slate-200 bg-slate-900 px-4 py-2 text-xs text-slate-300">
      <span className="flex items-center gap-2">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Live demo · your data stays in this browser, nothing is sent anywhere
      </span>
      <button onClick={onReset} className="flex items-center gap-1 rounded px-2 py-1 text-slate-400 transition hover:bg-slate-800 hover:text-white">
        <RotateCcw size={12} /> Reset demo
      </button>
    </div>
  );
}

/* ----------------------------- login ----------------------------- */
function Login({ onLogin }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={blueprint}>
      <div className="w-full max-w-md rounded-2xl border border-slate-700/50 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white">
            <ClipboardCheck size={22} />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">PPAP Manager</h1>
            <p className="font-mono text-xs text-slate-400">Production Part Approval Process</p>
          </div>
        </div>
        <p className="mb-5 text-sm text-slate-300">Pick a role to explore the demo. You can switch anytime.</p>
        <div className="space-y-3">
          <RoleButton
            onClick={() => onLogin({ name: "Jane Operator", role: "supplier", company: "ABC Manufacturing" })}
            icon={Factory} accent="blue" title="Sign in as Supplier"
            sub="Build & submit packages · ABC Manufacturing"
          />
          <RoleButton
            onClick={() => onLogin({ name: "Sam Reviewer", role: "customer", company: "Meridian Motors" })}
            icon={ShieldCheck} accent="emerald" title="Sign in as Customer"
            sub="Review & approve submissions · Meridian Motors"
          />
          <RoleButton
            onClick={() => onLogin({ name: "Alex Admin", role: "admin", company: "PPAP System" })}
            icon={Settings} accent="violet" title="Sign in as Admin"
            sub="Full access — build, review, and approve"
          />
        </div>
        <p className="mt-6 text-center font-mono text-[11px] text-slate-500">no signup · no backend · data stays in your browser</p>
      </div>
    </div>
  );
}
function RoleButton({ onClick, icon: Icon, accent, title, sub }) {
  const ring = accent === "blue" ? "hover:border-blue-500 focus-visible:ring-blue-500"
    : accent === "violet" ? "hover:border-violet-500 focus-visible:ring-violet-500"
    : "hover:border-emerald-500 focus-visible:ring-emerald-500";
  const ic = accent === "blue" ? "text-blue-400" : accent === "violet" ? "text-violet-400" : "text-emerald-400";
  return (
    <button onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3 text-left transition hover:bg-slate-800 focus:outline-none focus-visible:ring-2 ${ring}`}>
      <span className="flex items-center gap-3">
        <Icon size={18} className={ic} />
        <span>
          <span className="block text-sm font-medium text-white">{title}</span>
          <span className="block text-xs text-slate-400">{sub}</span>
        </span>
      </span>
      <ChevronRight size={16} className="text-slate-500 transition group-hover:translate-x-0.5" />
    </button>
  );
}

/* ----------------------------- chrome ----------------------------- */
function Sidebar({ user, route, setRoute, onLogout }) {
  const items = [
    { key: "dashboard", label: user.role === "customer" ? "Review queue" : "Dashboard", icon: LayoutDashboard },
    { key: "projects", label: "Projects", icon: FolderKanban },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];
  return (
    <aside className="hidden w-56 shrink-0 flex-col text-slate-300 sm:flex" style={blueprint}>
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white">
          <ClipboardCheck size={18} />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">PPAP Manager</span>
      </div>
      <nav className="flex-1 px-3 py-2">
        {items.map(({ key, label, icon: Icon }) => {
          const active = route.view === key || (key === "projects" && (route.view === "project" || route.view === "element"));
          return (
            <button key={key} onClick={() => setRoute({ view: key, projectId: null, elementId: null })}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                active ? "bg-blue-600/90 text-white" : "text-slate-300 hover:bg-slate-800/70"}`}>
              <Icon size={17} /> {label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-slate-800 p-3">
        <div className="mb-2 flex items-center gap-2 px-2">
          <UserCircle2 size={28} className="text-slate-500" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate font-mono text-[11px] capitalize text-slate-400">{user.role} · {user.company}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-slate-800/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

/* ----------------------------- router ----------------------------- */
function Content({ user, projects, setProjects, updateProject, route, setRoute }) {
  const project = projects.find((p) => p.id === route.projectId);

  if (route.view === "element" && project) {
    return <ElementEditor user={user} project={project} updateProject={updateProject} elementId={route.elementId}
      back={() => setRoute({ view: "project", projectId: project.id, elementId: null })} />;
  }
  if (route.view === "project" && project) {
    return <ProjectView user={user} project={project} updateProject={updateProject}
      openElement={(id) => setRoute({ view: "element", projectId: project.id, elementId: id })}
      back={() => setRoute({ view: "projects", projectId: null, elementId: null })} />;
  }
  if (route.view === "projects") {
    return <ProjectsList user={user} projects={projects} setProjects={setProjects}
      open={(id) => setRoute({ view: "project", projectId: id, elementId: null })} />;
  }
  if (route.view === "analytics") return <AnalyticsView projects={projects} />;
  if (user.role === "admin")
    return <AdminDashboard projects={projects} updateProject={updateProject}
      open={(id) => setRoute({ view: "project", projectId: id, elementId: null })}
      goProjects={() => setRoute({ view: "projects", projectId: null, elementId: null })} />;
  return user.role === "supplier"
    ? <SupplierDashboard projects={projects} open={(id) => setRoute({ view: "project", projectId: id, elementId: null })}
        goProjects={() => setRoute({ view: "projects", projectId: null, elementId: null })} />
    : <CustomerDashboard projects={projects} updateProject={updateProject}
        open={(id) => setRoute({ view: "project", projectId: id, elementId: null })} />;
}

/* --------------------------- helpers --------------------------- */
function progressOf(project) {
  const req = requiredFor(project.level);
  const reqIds = ELEMENTS.filter((e) => req.has(e.id));
  const done = reqIds.filter((e) => project.elements[e.id].status === "completed").length;
  return { done, total: reqIds.length, pct: Math.round((done / reqIds.length) * 100) };
}

/* --------------------------- dashboards --------------------------- */
function SupplierDashboard({ projects, open, goProjects }) {
  const mine = projects;
  const totals = mine.reduce((acc, p) => {
    const s = p.status;
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">Your PPAP packages at a glance.</p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Projects" value={mine.length} />
        <Stat label="Draft" value={totals.draft || 0} />
        <Stat label="Awaiting review" value={totals.submitted || 0} accent="amber" />
        <Stat label="Approved" value={totals.approved || 0} accent="emerald" />
      </div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Recent projects</h2>
        <button onClick={goProjects} className="text-sm text-blue-600 hover:underline">View all →</button>
      </div>
      <div className="space-y-2.5">
        {mine.slice(0, 4).map((p) => <ProjectRow key={p.id} project={p} onClick={() => open(p.id)} />)}
      </div>
    </div>
  );
}

function AnalyticsView({ projects }) {
  const statusOrder = [["draft", "Draft", "bg-slate-400"], ["submitted", "Awaiting review", "bg-amber-400"], ["approved", "Approved", "bg-emerald-500"], ["rejected", "Returned", "bg-rose-500"]];
  const counts = projects.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
  const maxCount = Math.max(1, ...statusOrder.map(([k]) => counts[k] || 0));

  // overall element completion across all projects (required only)
  let reqTotal = 0, reqDone = 0;
  projects.forEach((p) => {
    const req = requiredFor(p.level);
    ELEMENTS.forEach((e) => { if (req.has(e.id)) { reqTotal++; if (p.elements[e.id].status === "completed") reqDone++; } });
  });
  const completionPct = reqTotal ? Math.round((reqDone / reqTotal) * 100) : 0;

  // top FMEA risks across all projects
  const risks = [];
  projects.forEach((p) => ["design_fmea", "process_fmea"].forEach((id) => {
    (p.elements[id]?.data?.rows || []).forEach((r) => risks.push({ rpn: r.sev * r.occ * r.det, item: r.item || "—", mode: r.mode || "—", project: p.name }));
  }));
  risks.sort((a, b) => b.rpn - a.rpn);
  const topRisks = risks.slice(0, 5);

  // capability summary
  const caps = [];
  projects.forEach((p) => {
    const d = p.elements.initial_sample_inspection?.data;
    if (d?.usl) { const usl = +d.usl, lsl = +d.lsl, mean = +d.mean, sd = +d.sd; if (sd > 0) caps.push({ project: p.name, cpk: Math.min((usl - mean) / (3 * sd), (mean - lsl) / (3 * sd)) }); }
  });

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Analytics</h1>
      <p className="mb-6 text-sm text-slate-500">Roll-up across all {projects.length} project{projects.length === 1 ? "" : "s"} in this workspace.</p>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Projects by status</h2>
          <div className="space-y-3">
            {statusOrder.map(([k, label, color]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-slate-500">{label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
                  <div className={`h-full ${color}`} style={{ width: `${((counts[k] || 0) / maxCount) * 100}%` }} />
                </div>
                <span className="w-6 text-right font-mono text-sm text-slate-700">{counts[k] || 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Overall element completion</h2>
          <p className="mb-3 font-mono text-3xl font-semibold text-slate-900">{completionPct}%</p>
          <ProgressBar pct={completionPct} />
          <p className="mt-2 text-xs text-slate-500">{reqDone} of {reqTotal} required elements complete across all packages.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><AlertTriangle size={15} className="text-amber-500" /> Highest FMEA risks</h2>
          {topRisks.length === 0 ? <p className="text-sm text-slate-400">No FMEA data yet.</p> : (
            <ol className="space-y-2">
              {topRisks.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-slate-600">{r.item} — <span className="text-slate-400">{r.mode}</span></span>
                  <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs font-semibold ${r.rpn >= 200 ? "bg-rose-100 text-rose-700" : r.rpn >= 100 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{r.rpn}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Gauge size={15} className="text-blue-500" /> Process capability (Cpk)</h2>
          {caps.length === 0 ? <p className="text-sm text-slate-400">No capability studies yet.</p> : (
            <ul className="space-y-2">
              {caps.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-slate-600">{c.project}</span>
                  <span className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs font-semibold ${c.cpk >= 1.33 ? "bg-emerald-100 text-emerald-700" : c.cpk >= 1.0 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>{c.cpk.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ projects, updateProject, open, goProjects }) {
  const pending = projects.filter((p) => p.submission && p.submission.status === "pending");
  const totals = projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Admin overview</h1>
      <p className="mb-6 text-sm text-slate-500">Full access — you can build, review, and approve.</p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Awaiting review" value={totals.submitted || 0} accent="amber" />
        <Stat label="Approved" value={totals.approved || 0} accent="emerald" />
        <Stat label="Returned" value={totals.rejected || 0} />
      </div>
      {pending.length > 0 && (
        <>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Awaiting your review</h2>
          <div className="mb-6 space-y-4">
            {pending.map((p) => <ReviewCard key={p.id} project={p} updateProject={updateProject} open={() => open(p.id)} />)}
          </div>
        </>
      )}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">All projects</h2>
        <button onClick={goProjects} className="text-sm text-blue-600 hover:underline">View all →</button>
      </div>
      <div className="space-y-2.5">{projects.map((p) => <ProjectRow key={p.id} project={p} onClick={() => open(p.id)} />)}</div>
    </div>
  );
}

function CustomerDashboard({ projects, updateProject, open }) {
  const pending = projects.filter((p) => p.submission && p.submission.status === "pending");
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Review queue</h1>
      <p className="mb-6 text-sm text-slate-500">Submissions awaiting your engineering approval.</p>
      {pending.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Nothing to review"
          body="When a supplier submits a package, it appears here for approval. Sign in as Supplier to create and submit one." />
      ) : (
        <div className="space-y-4">
          {pending.map((p) => <ReviewCard key={p.id} project={p} updateProject={updateProject} open={() => open(p.id)} />)}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ project, updateProject, open }) {
  const [comments, setComments] = useState("");
  const p = progressOf(project);
  const decide = (status) =>
    updateProject(project.id, (pr) => ({ ...pr, status, submission: { ...pr.submission, status, comments } }));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-900">{project.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-slate-500">{project.partNumber} · Rev {project.revision} · from {project.supplier}</p>
        </div>
        <StatusPill status="submitted" />
      </div>
      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
        <span className="font-mono">{p.done}/{p.total}</span> required elements complete · Submission Level {project.level}
        <button onClick={open} className="ml-2 text-blue-600 hover:underline">View package →</button>
      </div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Review comments</label>
      <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2}
        placeholder="Notes for the supplier (required to return the package)…"
        className="mb-3 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <div className="flex gap-2">
        <button onClick={() => decide("approved")}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <CheckCircle2 size={16} /> Approve
        </button>
        <button onClick={() => comments.trim() && decide("rejected")} disabled={!comments.trim()}
          title={!comments.trim() ? "Add a comment to return the package" : ""}
          className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-40">
          <XCircle size={16} /> Return for changes
        </button>
      </div>
    </div>
  );
}

/* --------------------------- projects list --------------------------- */
function ProjectsList({ user, projects, setProjects, open }) {
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const isSupplier = user.role === "supplier" || user.role === "admin";

  const create = (form) => {
    const proj = {
      id: nextId(),
      name: form.name,
      partNumber: form.partNumber,
      partName: form.partName,
      customer: form.customer,
      supplier: user.company,
      revision: form.revision || "A",
      level: Number(form.level) || 3,
      status: "draft",
      submission: null,
      elements: blankElements(),
      activity: [evt("Project created")],
    };
    setProjects((ps) => [proj, ...ps]);
    setCreating(false);
    open(proj.id);
  };

  const del = (id) => {
    if (confirm("Delete this project? This can't be undone.")) setProjects((ps) => ps.filter((p) => p.id !== id));
  };

  const term = q.trim().toLowerCase();
  const shown = projects.filter((p) => {
    const matchQ = !term || [p.name, p.partNumber, p.partName, p.customer].some((v) => v.toLowerCase().includes(term));
    const matchF = filter === "all" || p.status === filter;
    return matchQ && matchF;
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Projects</h1>
          <p className="mt-0.5 text-sm text-slate-500">{projects.length} package{projects.length === 1 ? "" : "s"}</p>
        </div>
        {isSupplier && (
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Plus size={16} /> New project
          </button>
        )}
      </div>
      {creating && <CreateProject onCreate={create} onCancel={() => setCreating(false)} />}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, part number, or customer…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Awaiting review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Returned</option>
        </select>
      </div>
      <div className="space-y-2.5">
        {shown.map((p) => <ProjectRow key={p.id} project={p} onClick={() => open(p.id)} onDelete={isSupplier ? () => del(p.id) : null} />)}
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No projects yet" body="Create your first PPAP package to get started." />
        ) : shown.length === 0 ? (
          <EmptyState icon={FolderKanban} title="No matches" body="No projects match your search or filter." />
        ) : null}
      </div>
    </div>
  );
}

function CreateProject({ onCreate, onCancel }) {
  const [form, setForm] = useState({ name: "", partNumber: "", partName: "", customer: "", revision: "A", level: 3 });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.name && form.partNumber && form.partName && form.customer;
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">New PPAP project</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledInput label="Project name" value={form.name} onChange={set("name")} placeholder="e.g. Bracket Assembly" />
        <LabeledInput label="Customer" value={form.customer} onChange={set("customer")} placeholder="e.g. Meridian Motors" />
        <LabeledInput label="Part number" value={form.partNumber} onChange={set("partNumber")} placeholder="e.g. 47829-A" />
        <LabeledInput label="Part name" value={form.partName} onChange={set("partName")} placeholder="e.g. Mounting Bracket" />
        <LabeledInput label="Revision" value={form.revision} onChange={set("revision")} placeholder="A" />
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Submission level</span>
          <select value={form.level} onChange={set("level")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
            {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}</option>)}
          </select>
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => valid && onCreate(form)} disabled={!valid}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
          Create project
        </button>
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}

function ProjectEditForm({ project, onSave, onCancel }) {
  const [form, setForm] = useState({ name: project.name, partNumber: project.partNumber, partName: project.partName, customer: project.customer, revision: project.revision });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.name && form.partNumber && form.partName && form.customer;
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Edit project details</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <LabeledInput label="Project name" value={form.name} onChange={set("name")} />
        <LabeledInput label="Customer" value={form.customer} onChange={set("customer")} />
        <LabeledInput label="Part number" value={form.partNumber} onChange={set("partNumber")} />
        <LabeledInput label="Part name" value={form.partName} onChange={set("partName")} />
        <LabeledInput label="Revision" value={form.revision} onChange={set("revision")} />
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={() => valid && onSave(form)} disabled={!valid} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Save changes</button>
        <button onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
      </div>
    </div>
  );
}

function ProjectRow({ project, onClick, onDelete }) {
  const p = progressOf(project);
  return (
    <div className="group rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow">
      <button onClick={onClick}
        className="block w-full rounded-t-xl p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{project.name}</h3>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{project.partNumber} · Rev {project.revision} · {project.customer}</p>
          </div>
          <StatusPill status={project.status} />
        </div>
        <ProgressBar pct={p.pct} />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span className="font-mono">{p.done}/{p.total} required · Level {project.level}</span>
          <span className="flex items-center gap-1 text-blue-600 group-hover:underline">Open <ChevronRight size={13} /></span>
        </div>
      </button>
      {onDelete && (
        <div className="border-t border-slate-100 px-4 py-2 text-right">
          <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-rose-600">
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* --------------------------- project view --------------------------- */
function ProjectView({ user, project, updateProject, openElement, back }) {
  const req = requiredFor(project.level);
  const p = progressOf(project);
  const allDone = p.done === p.total;
  const supplierLike = user.role === "supplier" || user.role === "admin";
  const customerLike = user.role === "customer" || user.role === "admin";
  const locked = project.status === "submitted" || project.status === "approved";
  const [reviewNote, setReviewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const saveEdits = (form) => { updateProject(project.id, (pr) => withEvent({ ...pr, ...form }, "Project details updated")); setEditing(false); };

  const submit = () => updateProject(project.id, (pr) => withEvent({ ...pr, status: "submitted", submission: { status: "pending", comments: "" } }, "Submitted to customer"));
  const decide = (status) => updateProject(project.id, (pr) => withEvent({ ...pr, status, submission: { ...(pr.submission || {}), status, comments: reviewNote } }, status === "approved" ? "Approved by customer" : "Returned for changes"));
  const reopen = () => updateProject(project.id, (pr) => withEvent({ ...pr, status: "draft" }, "Reopened for edits"));

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={back} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> All projects
      </button>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
            {supplierLike && !locked && <button onClick={() => setEditing(true)} title="Edit details" className="text-slate-400 transition hover:text-blue-600"><Pencil size={15} /></button>}
          </div>
          <p className="mt-0.5 font-mono text-xs text-slate-500">P/N {project.partNumber} · Rev {project.revision} · {project.customer}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportPackage(project)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
            <Download size={15} /> Package
          </button>
          <button onClick={() => exportCSV(project)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
            <Table2 size={15} /> Excel
          </button>
          <button onClick={() => exportPSW(project)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
            <FileText size={15} /> PSW
          </button>
          <StatusPill status={project.status} />
        </div>
      </div>

      {editing && <ProjectEditForm project={project} onSave={saveEdits} onCancel={() => setEditing(false)} />}

      <StageStepper status={project.status} />

      <div className="mb-3 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Submission level
          <select value={project.level} disabled={!supplierLike || locked}
            onChange={(e) => updateProject(project.id, (pr) => ({ ...pr, level: Number(e.target.value) }))}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60">
            {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}</option>)}
          </select>
        </label>
      </div>
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-xs text-blue-800">
        <span className="font-medium">Level {project.level}:</span> {LEVEL_NOTE[project.level]} The checklist shows only what this level requires.
      </div>

      <div className="mb-6"><ProgressBar pct={p.pct} /></div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {ELEMENTS.map((el) => {
          const state = project.elements[el.id];
          const required = req.has(el.id);
          const needsCustomer = el.id === "customer_engineering_approval" && state.status !== "completed";
          return (
            <button key={el.id} onClick={() => required && openElement(el.id)} disabled={!required}
              className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                required ? "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm" : "border-dashed border-slate-200 bg-slate-50 opacity-60"}`}>
              <StatusIcon status={required ? state.status : "n/a"} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400">{String(el.n).padStart(2, "0")}</span>
                  <span className="truncate text-sm font-medium text-slate-800">{el.name}</span>
                  {required && needsCustomer && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"><Lock size={9} /> customer</span>
                  )}
                  {required && state.comments?.length > 0 && (
                    <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-slate-400"><MessageSquare size={9} /> {state.comments.length}</span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500">{required ? el.desc : "Not required at this level"}</p>
              </div>
              {required && <ChevronRight size={15} className="shrink-0 text-slate-300" />}
            </button>
          );
        })}
      </div>

      {/* Build & submit (supplier / admin) */}
      {(project.status === "draft" || project.status === "rejected") && supplierLike && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">
            {project.status === "rejected" ? (
              <span className="flex items-center gap-1.5 text-rose-600"><AlertTriangle size={15} /> Returned: “{project.submission?.comments}”</span>
            ) : allDone ? "All required elements complete — ready to submit." :
              `Complete all ${p.total} required elements to enable submission. The Customer Engineering Approval step needs customer sign-off.`}
          </div>
          <div className="flex gap-2">
            {project.status === "rejected" && (
              <button onClick={reopen} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Reopen</button>
            )}
            <button onClick={submit} disabled={!allDone}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
              <Send size={15} /> Submit to customer
            </button>
          </div>
        </div>
      )}

      {/* Customer review gate */}
      {project.status === "submitted" && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          {customerLike ? (
            <>
              <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-amber-800"><ShieldCheck size={15} /> This package needs your decision.</p>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2}
                placeholder="Review comments (required to return the package)…"
                className="mb-3 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <div className="flex gap-2">
                <button onClick={() => decide("approved")}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  <CheckCircle2 size={16} /> Approve
                </button>
                <button onClick={() => reviewNote.trim() && decide("rejected")} disabled={!reviewNote.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40">
                  <XCircle size={16} /> Return for changes
                </button>
              </div>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-sm text-amber-800">
              <Lock size={15} /> Submitted and locked. You can't proceed until {project.customer} reviews and approves it.
            </p>
          )}
        </div>
      )}

      {/* Approved */}
      {project.status === "approved" && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 size={15} /> Approved by {project.customer}. {project.submission?.comments}</span>
          {supplierLike && <button onClick={() => exportPSW(project)} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100">Export PSW</button>}
        </div>
      )}
      {project.activity && project.activity.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Clock size={15} className="text-slate-400" /> Activity</h3>
          <ol className="space-y-2">
            {project.activity.map((a, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-xs text-slate-400">{a.t}</span>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                <span className="text-slate-600">{a.text}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function StageStepper({ status }) {
  const idx = status === "approved" ? 2 : status === "submitted" ? 1 : 0;
  const steps = ["Build", "Customer review", "Approved"];
  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center">
        {steps.map((label, i) => {
          const state = status === "approved" ? "done" : i < idx ? "done" : i === idx ? "current" : "todo";
          const isCustomerStep = i === 1;
          return (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  state === "done" ? "bg-emerald-500 text-white"
                    : state === "current" ? (isCustomerStep ? "bg-amber-500 text-white" : "bg-blue-600 text-white")
                    : "bg-slate-200 text-slate-500"}`}>
                  {state === "done" ? <CheckCircle2 size={16} /> : (isCustomerStep && state === "current") ? <Lock size={13} /> : i + 1}
                </span>
                <span className={`text-sm ${state === "todo" ? "text-slate-400" : "font-medium text-slate-700"}`}>{label}</span>
              </div>
              {i < steps.length - 1 && <div className={`mx-3 h-px flex-1 ${i < idx || status === "approved" ? "bg-emerald-400" : "bg-slate-200"}`} />}
            </React.Fragment>
          );
        })}
      </div>
      {status === "submitted" && <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700"><Lock size={12} /> Locked at customer review — the supplier can't proceed until the customer approves.</p>}
      {status === "rejected" && <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-700"><AlertTriangle size={12} /> Returned to the supplier for changes.</p>}
    </div>
  );
}

/* --------------------------- element editor --------------------------- */
function ElementEditor({ user, project, updateProject, elementId, back }) {
  const el = ELEMENTS.find((e) => e.id === elementId);
  const state = project.elements[elementId];
  const isCEA = el.id === "customer_engineering_approval";
  const supplierLike = user.role === "supplier" || user.role === "admin";
  const customerLike = user.role === "customer" || user.role === "admin";
  const projectLocked = project.status === "submitted" || project.status === "approved";
  const fieldsReadOnly = !(supplierLike && !projectLocked); // only supplier/admin edit fields, and only before submission

  const setData = (data) =>
    updateProject(project.id, (p) => ({ ...p, elements: { ...p.elements, [elementId]: { ...p.elements[elementId], data } } }));
  const setStatus = (status) =>
    updateProject(project.id, (p) => ({ ...p, elements: { ...p.elements, [elementId]: { ...p.elements[elementId], status } } }));

  const [draft, setDraft] = useState("");
  const comments = state.comments || [];
  const addComment = () => {
    if (!draft.trim()) return;
    updateProject(project.id, (p) => ({
      ...p,
      elements: { ...p.elements, [elementId]: { ...p.elements[elementId], comments: [...(p.elements[elementId].comments || []), { by: user.name, role: user.role, text: draft.trim(), t: new Date().toISOString().slice(0, 10) }] } },
    }));
    setDraft("");
  };
  const roleDot = (role) => role === "customer" ? "bg-emerald-500" : role === "admin" ? "bg-violet-500" : "bg-blue-500";

  return (
    <div className="mx-auto max-w-4xl">
      <button onClick={back} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Back to elements
      </button>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-slate-400">{String(el.n).padStart(2, "0")}</span>
            <h1 className="text-xl font-semibold text-slate-900">{el.name}</h1>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{el.desc}</p>
        </div>
        <StatusIcon status={state.status} large />
      </div>

      {isCEA && (
        <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <Lock size={13} /> Customer-gated step: the supplier prepares it, but only the customer can grant engineering approval.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {el.kind === "fmea" && <FmeaEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "dimensional" && <DimensionalEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "psw" && <PswEditor project={project} data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "flow" && <ProcessFlowEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "controlplan" && <ControlPlanEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "msa" && <MsaEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "capability" && <CapabilityEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "material" && <MaterialEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "csr" && <CsrEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "upload" && <UploadEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
      </div>

      {isCEA ? (
        <div className="mt-4">
          {state.status === "completed" ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} /> Customer engineering approval granted.</span>
              {customerLike && <button onClick={() => setStatus("in_progress")} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100">Withdraw</button>}
            </div>
          ) : customerLike ? (
            <div className="flex justify-end">
              <button onClick={() => setStatus("completed")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <ShieldCheck size={16} /> Approve engineering sign-off
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Clock size={15} /> Awaiting customer engineering sign-off — sign in as Customer (or Admin) to approve.
            </div>
          )}
        </div>
      ) : (
        !fieldsReadOnly && (
          <div className="mt-4 flex justify-end gap-2">
            {state.status !== "completed" ? (
              <button onClick={() => setStatus("completed")}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <CheckCircle2 size={16} /> Mark complete
              </button>
            ) : (
              <button onClick={() => setStatus("in_progress")} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Reopen</button>
            )}
          </div>
        )
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><MessageSquare size={15} className="text-slate-400" /> Discussion {comments.length > 0 && <span className="text-xs font-normal text-slate-400">({comments.length})</span>}</h3>
        <div className="mb-3 space-y-3">
          {comments.map((c, i) => (
            <div key={i} className="flex gap-2.5">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${roleDot(c.role)}`} />
              <div>
                <p className="text-xs text-slate-500"><span className="font-medium text-slate-700">{c.by}</span> <span className="capitalize">· {c.role}</span> · {c.t}</p>
                <p className="text-sm text-slate-700">{c.text}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-slate-400">No comments yet. Supplier and customer can discuss this element here.</p>}
        </div>
        <div className="flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComment()}
            placeholder="Add a comment…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <button onClick={addComment} disabled={!draft.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Post</button>
        </div>
      </div>
    </div>
  );
}

function rpnColor(rpn) {
  if (rpn >= 200) return "bg-rose-100 text-rose-700";
  if (rpn >= 100) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}
function FmeaEditor({ data, setData, readOnly }) {
  const rows = data.rows || [];
  const update = (id, key, val) => setData({ ...data, rows: rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)) });
  const addRow = () => setData({ ...data, rows: [...rows, { id: Date.now(), item: "", fn: "", mode: "", effect: "", sev: 5, cause: "", occ: 5, ctrl: "", det: 5 }] });
  const removeRow = (id) => setData({ ...data, rows: rows.filter((r) => r.id !== id) });
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
        <Gauge size={16} className="text-blue-500" />
        Risk Priority Number recalculates live as you change Severity, Occurrence, and Detection.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Item / Function</th><th className="px-2 py-2">Failure mode</th><th className="px-2 py-2">Effect</th>
              <th className="px-2 py-2 text-center">Sev</th><th className="px-2 py-2 text-center">Occ</th><th className="px-2 py-2 text-center">Det</th>
              <th className="px-2 py-2 text-center">RPN</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const rpn = r.sev * r.occ * r.det;
              return (
                <tr key={r.id} className="border-b border-slate-100 align-top">
                  <td className="px-2 py-2">
                    <div className="mb-1"><CellInput value={r.item} onChange={(e) => update(r.id, "item", e.target.value)} disabled={readOnly} placeholder="Item" w="w-36" /></div>
                    <CellInput value={r.fn} onChange={(e) => update(r.id, "fn", e.target.value)} disabled={readOnly} placeholder="Function" w="w-36" small />
                  </td>
                  <td className="px-2 py-2"><CellInput value={r.mode} onChange={(e) => update(r.id, "mode", e.target.value)} disabled={readOnly} placeholder="Mode" /></td>
                  <td className="px-2 py-2"><CellInput value={r.effect} onChange={(e) => update(r.id, "effect", e.target.value)} disabled={readOnly} placeholder="Effect" /></td>
                  <td className="px-2 py-2 text-center"><ScoreSelect value={r.sev} onChange={(e) => update(r.id, "sev", Number(e.target.value))} disabled={readOnly} /></td>
                  <td className="px-2 py-2 text-center"><ScoreSelect value={r.occ} onChange={(e) => update(r.id, "occ", Number(e.target.value))} disabled={readOnly} /></td>
                  <td className="px-2 py-2 text-center"><ScoreSelect value={r.det} onChange={(e) => update(r.id, "det", Number(e.target.value))} disabled={readOnly} /></td>
                  <td className="px-2 py-2 text-center"><span className={`inline-block min-w-[2.5rem] rounded px-2 py-1 font-mono text-sm font-semibold ${rpnColor(rpn)}`}>{rpn}</span></td>
                  {!readOnly && <td className="px-2 py-2 text-center"><button onClick={() => removeRow(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={8} className="px-2 py-6 text-center text-sm text-slate-400">No failure modes yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {!readOnly && <button onClick={addRow} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Add failure mode</button>}
    </div>
  );
}

function DimensionalEditor({ data, setData, readOnly }) {
  const rows = data.rows || [];
  const update = (id, key, val) => setData({ ...data, rows: rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)) });
  const addRow = () => setData({ ...data, rows: [...rows, { id: Date.now(), feature: "", nominal: "", minus: "", plus: "", actual: "" }] });
  const removeRow = (id) => setData({ ...data, rows: rows.filter((r) => r.id !== id) });
  const verdict = (r) => {
    const nom = parseFloat(r.nominal), minus = parseFloat(r.minus), plus = parseFloat(r.plus), act = parseFloat(r.actual);
    if ([nom, minus, plus, act].some((v) => isNaN(v))) return null;
    return act >= nom - Math.abs(minus) && act <= nom + Math.abs(plus);
  };
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
        <Gauge size={16} className="text-blue-500" /> Enter the measured value; pass/fail is flagged against the tolerance band automatically.
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Feature</th><th className="px-2 py-2 text-center">Nominal</th><th className="px-2 py-2 text-center">− Tol</th>
              <th className="px-2 py-2 text-center">+ Tol</th><th className="px-2 py-2 text-center">Actual</th><th className="px-2 py-2 text-center">Result</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = verdict(r);
              return (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="px-2 py-2"><CellInput value={r.feature} onChange={(e) => update(r.id, "feature", e.target.value)} disabled={readOnly} placeholder="e.g. Bore Ø" w="w-40" /></td>
                  <td className="px-2 py-2 text-center"><NumCell value={r.nominal} onChange={(e) => update(r.id, "nominal", e.target.value)} disabled={readOnly} /></td>
                  <td className="px-2 py-2 text-center"><NumCell value={r.minus} onChange={(e) => update(r.id, "minus", e.target.value)} disabled={readOnly} w="w-16" /></td>
                  <td className="px-2 py-2 text-center"><NumCell value={r.plus} onChange={(e) => update(r.id, "plus", e.target.value)} disabled={readOnly} w="w-16" /></td>
                  <td className="px-2 py-2 text-center"><NumCell value={r.actual} onChange={(e) => update(r.id, "actual", e.target.value)} disabled={readOnly} /></td>
                  <td className="px-2 py-2 text-center">
                    {v === null ? <span className="text-xs text-slate-300">—</span> :
                      v ? <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">PASS</span>
                        : <span className="rounded bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">FAIL</span>}
                  </td>
                  {!readOnly && <td className="px-2 py-2 text-center"><button onClick={() => removeRow(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></td>}
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-sm text-slate-400">No features measured yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {!readOnly && <button onClick={addRow} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Add feature</button>}
    </div>
  );
}

function PswEditor({ project, data, setData, readOnly }) {
  const field = (label, value) => (
    <div><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="font-mono text-sm text-slate-800">{value}</p></div>
  );
  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
        {field("Part number", project.partNumber)}{field("Part name", project.partName)}{field("Revision", project.revision)}
        {field("Supplier", project.supplier)}{field("Customer", project.customer)}{field("Submission level", project.level)}
      </div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Reason for submission</label>
      <select disabled={readOnly} value={data.reason || ""} onChange={(e) => setData({ ...data, reason: e.target.value })}
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50">
        <option value="">Select…</option><option>Initial submission</option><option>Engineering change</option>
        <option>Tooling transfer / change</option><option>Correction of discrepancy</option>
      </select>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" disabled={readOnly} checked={!!data.declared} onChange={(e) => setData({ ...data, declared: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        I affirm the samples represent parts made from production tooling and processes, and that results meet all drawing and specification requirements.
      </label>
    </div>
  );
}

function UploadEditor({ data, setData, readOnly }) {
  const files = data.files || [];
  const onPick = (e) => {
    const picked = Array.from(e.target.files || []).map((f) => ({ name: f.name, size: f.size }));
    if (picked.length) setData({ ...data, files: [...files, ...picked] });
    e.target.value = "";
  };
  const removeFile = (i) => setData({ ...data, files: files.filter((_, idx) => idx !== i) });
  const kb = (n) => (n ? `${Math.max(1, Math.round(n / 1024))} KB` : "");
  return (
    <div>
      {!readOnly && (
        <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 py-8 text-slate-500 transition hover:border-blue-400 hover:text-blue-600">
          <Upload size={22} />
          <span className="text-sm font-medium">Click to attach a document</span>
          <span className="text-xs text-slate-400">PDF, DXF, XLSX, JPG — recorded for this demo</span>
          <input type="file" multiple className="hidden" onChange={onPick} />
        </label>
      )}
      <div className="space-y-2">
        {files.map((f, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-slate-700"><FileText size={16} className="text-blue-500" /><span className="font-mono">{f.name}</span><span className="text-xs text-slate-400">{kb(f.size)}</span></span>
            {!readOnly && <button onClick={() => removeFile(i)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>}
          </div>
        ))}
        {files.length === 0 && <p className="text-center text-sm text-slate-400">No documents attached yet.</p>}
      </div>
      <textarea disabled={readOnly} value={data.notes || ""} onChange={(e) => setData({ ...data, notes: e.target.value })} rows={2} placeholder="Notes (optional)…"
        className="mt-4 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50" />
    </div>
  );
}

/* -------- additional element editors (Process Flow, Control Plan, MSA, ---------
 * Cp/Cpk capability, Material/Performance results, Customer-Specific Reqs) ----- */

function ProcessFlowEditor({ data, setData, readOnly }) {
  const steps = data.steps || [];
  const update = (id, key, val) => setData({ ...data, steps: steps.map((s) => (s.id === id ? { ...s, [key]: val } : s)) });
  const add = () => setData({ ...data, steps: [...steps, { id: Date.now(), name: "", type: "Operation", desc: "" }] });
  const remove = (id) => setData({ ...data, steps: steps.filter((s) => s.id !== id) });
  const move = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= steps.length) return;
    const next = [...steps]; [next[i], next[j]] = [next[j], next[i]]; setData({ ...data, steps: next });
  };
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Ordered manufacturing sequence. Each step is typed (operation, inspection, transport, storage).</p>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5">
            <span className="mt-1 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex-1 space-y-1.5">
              <div className="flex gap-2">
                <CellInput value={s.name} onChange={(e) => update(s.id, "name", e.target.value)} disabled={readOnly} placeholder="Step name" w="w-48" />
                <select value={s.type} onChange={(e) => update(s.id, "type", e.target.value)} disabled={readOnly}
                  className="rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50">
                  {["Operation", "Inspection", "Transport", "Storage", "Delay"].map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <CellInput value={s.desc} onChange={(e) => update(s.id, "desc", e.target.value)} disabled={readOnly} placeholder="Description" w="w-full" small />
            </div>
            {!readOnly && (
              <div className="flex flex-col">
                <button onClick={() => move(i, -1)} className="text-slate-300 hover:text-slate-600">↑</button>
                <button onClick={() => move(i, 1)} className="text-slate-300 hover:text-slate-600">↓</button>
                <button onClick={() => remove(s.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        ))}
        {steps.length === 0 && <p className="text-center text-sm text-slate-400">No process steps yet.</p>}
      </div>
      {!readOnly && <button onClick={add} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Add step</button>}
    </div>
  );
}

function ControlPlanEditor({ data, setData, readOnly }) {
  const rows = data.rows || [];
  const update = (id, key, val) => setData({ ...data, rows: rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)) });
  const add = () => setData({ ...data, rows: [...rows, { id: Date.now(), characteristic: "", spec: "", method: "", freq: "", reaction: "" }] });
  const remove = (id) => setData({ ...data, rows: rows.filter((r) => r.id !== id) });
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">How each characteristic is controlled, measured, and what happens when it's out of spec.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Characteristic</th><th className="px-2 py-2">Specification</th><th className="px-2 py-2">Method</th>
              <th className="px-2 py-2">Frequency</th><th className="px-2 py-2">Reaction plan</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-2 py-2"><CellInput value={r.characteristic} onChange={(e) => update(r.id, "characteristic", e.target.value)} disabled={readOnly} placeholder="e.g. Bore Ø" w="w-32" /></td>
                <td className="px-2 py-2"><CellInput value={r.spec} onChange={(e) => update(r.id, "spec", e.target.value)} disabled={readOnly} placeholder="12.0 ±0.02" w="w-28" /></td>
                <td className="px-2 py-2"><CellInput value={r.method} onChange={(e) => update(r.id, "method", e.target.value)} disabled={readOnly} placeholder="CMM / gauge" w="w-28" /></td>
                <td className="px-2 py-2"><CellInput value={r.freq} onChange={(e) => update(r.id, "freq", e.target.value)} disabled={readOnly} placeholder="5/shift" w="w-24" /></td>
                <td className="px-2 py-2"><CellInput value={r.reaction} onChange={(e) => update(r.id, "reaction", e.target.value)} disabled={readOnly} placeholder="Quarantine + notify" w="w-40" /></td>
                {!readOnly && <td className="px-2 py-2 text-center"><button onClick={() => remove(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} className="px-2 py-6 text-center text-sm text-slate-400">No control items yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {!readOnly && <button onClick={add} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Add control item</button>}
    </div>
  );
}

function MsaEditor({ data, setData, readOnly }) {
  const set = (k) => (e) => setData({ ...data, [k]: e.target.value });
  const ev = parseFloat(data.ev), av = parseFloat(data.av), pv = parseFloat(data.pv), tol = parseFloat(data.tol);
  const valid = !isNaN(ev) && !isNaN(av) && !isNaN(pv);
  const grr = valid ? Math.sqrt(ev * ev + av * av) : null;
  const tv = valid ? Math.sqrt(grr * grr + pv * pv) : null;
  const pctTV = valid && tv > 0 ? (grr / tv) * 100 : null;
  const pctTol = grr != null && !isNaN(tol) && tol > 0 ? ((6 * grr) / tol) * 100 : null;
  const ndc = valid && grr > 0 ? Math.floor(1.41 * (pv / grr)) : null;
  const verdict = pctTV == null ? null : pctTV < 10 ? ["Acceptable", "text-emerald-700 bg-emerald-100"] : pctTV <= 30 ? ["Marginal", "text-amber-700 bg-amber-100"] : ["Unacceptable", "text-rose-700 bg-rose-100"];
  const Inp = ({ k, label, hint }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <NumCell value={data[k] || ""} onChange={set(k)} disabled={readOnly} w="w-full" />
      {hint && <span className="mt-0.5 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Gauge size={16} className="text-blue-500" /> Gage R&R from variation estimates — %GRR and distinct categories compute automatically.</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Inp k="ev" label="Repeatability (EV)" hint="equipment σ" />
        <Inp k="av" label="Reproducibility (AV)" hint="appraiser σ" />
        <Inp k="pv" label="Part variation (PV)" hint="part σ" />
        <Inp k="tol" label="Tolerance (opt.)" hint="USL − LSL" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="GRR" value={grr != null ? grr.toFixed(3) : "—"} />
        <Metric label="% GRR (of TV)" value={pctTV != null ? pctTV.toFixed(1) + "%" : "—"} />
        <Metric label="% GRR (of tol.)" value={pctTol != null ? pctTol.toFixed(1) + "%" : "—"} />
        <Metric label="Distinct categories" value={ndc != null ? ndc : "—"} />
      </div>
      {verdict && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-slate-500">Measurement system:</span>
          <span className={`rounded px-2 py-1 text-xs font-semibold ${verdict[1]}`}>{verdict[0]}</span>
          <span className="text-xs text-slate-400">(&lt;10% acceptable · 10–30% marginal · &gt;30% reject)</span>
        </div>
      )}
    </div>
  );
}

function CapabilityEditor({ data, setData, readOnly }) {
  const set = (k) => (e) => setData({ ...data, [k]: e.target.value });
  const usl = parseFloat(data.usl), lsl = parseFloat(data.lsl), mean = parseFloat(data.mean), sd = parseFloat(data.sd);
  const ok = [usl, lsl, mean, sd].every((v) => !isNaN(v)) && sd > 0;
  const cp = ok ? (usl - lsl) / (6 * sd) : null;
  const cpk = ok ? Math.min((usl - mean) / (3 * sd), (mean - lsl) / (3 * sd)) : null;
  const verdict = cpk == null ? null : cpk >= 1.67 ? ["Excellent", "text-emerald-700 bg-emerald-100"] : cpk >= 1.33 ? ["Capable", "text-emerald-700 bg-emerald-100"] : cpk >= 1.0 ? ["Marginal", "text-amber-700 bg-amber-100"] : ["Not capable", "text-rose-700 bg-rose-100"];
  const Inp = ({ k, label }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <NumCell value={data[k] || ""} onChange={set(k)} disabled={readOnly} w="w-full" />
    </label>
  );
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Gauge size={16} className="text-blue-500" /> Initial process capability — Cp and Cpk compute from the spec limits and process statistics.</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Inp k="lsl" label="Lower spec (LSL)" />
        <Inp k="usl" label="Upper spec (USL)" />
        <Inp k="mean" label="Process mean (x̄)" />
        <Inp k="sd" label="Std dev (σ)" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric label="Cp" value={cp != null ? cp.toFixed(2) : "—"} />
        <Metric label="Cpk" value={cpk != null ? cpk.toFixed(2) : "—"} />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Verdict</p>
          {verdict ? <span className={`mt-1 inline-block rounded px-2 py-1 text-sm font-semibold ${verdict[1]}`}>{verdict[0]}</span> : <p className="text-slate-300">—</p>}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-400">Cpk ≥ 1.33 is the common automotive threshold for a capable process.</p>
    </div>
  );
}

function MaterialEditor({ data, setData, readOnly }) {
  const rows = data.rows || [];
  const update = (id, key, val) => setData({ ...data, rows: rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)) });
  const add = () => setData({ ...data, rows: [...rows, { id: Date.now(), test: "", requirement: "", result: "", verdict: "pass" }] });
  const remove = (id) => setData({ ...data, rows: rows.filter((r) => r.id !== id) });
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Material and performance test results against their requirements.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Test</th><th className="px-2 py-2">Requirement</th><th className="px-2 py-2">Result</th><th className="px-2 py-2 text-center">Status</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                <td className="px-2 py-2"><CellInput value={r.test} onChange={(e) => update(r.id, "test", e.target.value)} disabled={readOnly} placeholder="Salt spray" w="w-36" /></td>
                <td className="px-2 py-2"><CellInput value={r.requirement} onChange={(e) => update(r.id, "requirement", e.target.value)} disabled={readOnly} placeholder="≥ 96 h" w="w-28" /></td>
                <td className="px-2 py-2"><CellInput value={r.result} onChange={(e) => update(r.id, "result", e.target.value)} disabled={readOnly} placeholder="120 h" w="w-28" /></td>
                <td className="px-2 py-2 text-center">
                  <select value={r.verdict} onChange={(e) => update(r.id, "verdict", e.target.value)} disabled={readOnly}
                    className={`rounded px-2 py-1 text-xs font-semibold focus:outline-none disabled:opacity-100 ${r.verdict === "pass" ? "bg-emerald-100 text-emerald-700" : r.verdict === "fail" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                    <option value="pass">PASS</option><option value="fail">FAIL</option><option value="na">N/A</option>
                  </select>
                </td>
                {!readOnly && <td className="px-2 py-2 text-center"><button onClick={() => remove(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center text-sm text-slate-400">No test results yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {!readOnly && <button onClick={add} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Add test</button>}
    </div>
  );
}

const CSR_DEFAULTS = [
  "Labeling and barcode per customer standard",
  "IMDS material data submitted",
  "Packaging specification acknowledged",
  "Sub-supplier PPAPs on file",
];
function CsrEditor({ data, setData, readOnly }) {
  const items = data.items || CSR_DEFAULTS.map((text, i) => ({ id: i + 1, text, met: false, note: "" }));
  const sync = (next) => setData({ ...data, items: next });
  const update = (id, key, val) => sync(items.map((it) => (it.id === id ? { ...it, [key]: val } : it)));
  const add = () => sync([...items, { id: Date.now(), text: "", met: false, note: "" }]);
  const remove = (id) => sync(items.filter((it) => it.id !== id));
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Customer-specific requirements checklist. Defaults shown; edit to match the OEM's manual.</p>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
            <input type="checkbox" checked={it.met} disabled={readOnly} onChange={(e) => update(it.id, "met", e.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <div className="flex-1 space-y-1.5">
              <CellInput value={it.text} onChange={(e) => update(it.id, "text", e.target.value)} disabled={readOnly} placeholder="Requirement" w="w-full" />
              <CellInput value={it.note} onChange={(e) => update(it.id, "note", e.target.value)} disabled={readOnly} placeholder="Evidence / note" w="w-full" small />
            </div>
            {!readOnly && <button onClick={() => remove(it.id)} className="mt-1 text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button>}
          </div>
        ))}
      </div>
      {!readOnly && <button onClick={add} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Add requirement</button>}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

/* --------------------------- PSW PDF export --------------------------- */
function exportPSW(project) {
  const doc = new jsPDF();
  const left = 16;
  let y = 20;
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("Part Submission Warrant", left, y);
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
  doc.text("Production Part Approval Process — demo export", left, y + 6);
  doc.setTextColor(0);
  y += 18;

  const row = (label, value) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(label, left, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value ?? "—"), left + 55, y);
    y += 7;
  };
  row("Part name:", project.partName);
  row("Part number:", project.partNumber);
  row("Revision:", project.revision);
  row("Supplier:", project.supplier);
  row("Customer:", project.customer);
  row("Submission level:", project.level);
  row("Status:", project.status);

  y += 6;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Element completion", left, y); y += 7;
  doc.setFontSize(9);
  const req = requiredFor(project.level);
  ELEMENTS.forEach((el) => {
    if (!req.has(el.id)) return;
    const st = project.elements[el.id].status.replace("_", " ");
    doc.setFont("helvetica", "normal");
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`${String(el.n).padStart(2, "0")}. ${el.name}`, left, y);
    doc.text(st, left + 120, y);
    y += 6;
  });

  doc.save(`PSW_${project.partNumber || "part"}.pdf`);
}

function elementSummary(kind, data) {
  if (!data) return "";
  if (kind === "fmea" && data.rows?.length) {
    const max = Math.max(...data.rows.map((r) => r.sev * r.occ * r.det));
    return `${data.rows.length} failure mode(s), max RPN ${max}`;
  }
  if (kind === "dimensional" && data.rows?.length) {
    let pass = 0, fail = 0;
    data.rows.forEach((r) => {
      const nom = parseFloat(r.nominal), m = parseFloat(r.minus), p = parseFloat(r.plus), a = parseFloat(r.actual);
      if ([nom, m, p, a].some(isNaN)) return;
      (a >= nom - Math.abs(m) && a <= nom + Math.abs(p)) ? pass++ : fail++;
    });
    return `${data.rows.length} feature(s): ${pass} pass, ${fail} fail`;
  }
  if (kind === "controlplan" && data.rows?.length) return `${data.rows.length} control item(s)`;
  if (kind === "flow" && data.steps?.length) return `${data.steps.length} process step(s)`;
  if (kind === "material" && data.rows?.length) return `${data.rows.length} test(s)`;
  if (kind === "csr" && data.items?.length) return `${data.items.filter((i) => i.met).length}/${data.items.length} requirements met`;
  if (kind === "msa" && data.ev) {
    const ev = +data.ev, av = +data.av, pv = +data.pv, grr = Math.sqrt(ev * ev + av * av), tv = Math.sqrt(grr * grr + pv * pv);
    return tv > 0 ? `%GRR ${((grr / tv) * 100).toFixed(1)}%` : "";
  }
  if (kind === "capability" && data.usl) {
    const usl = +data.usl, lsl = +data.lsl, mean = +data.mean, sd = +data.sd;
    if (sd > 0) return `Cpk ${Math.min((usl - mean) / (3 * sd), (mean - lsl) / (3 * sd)).toFixed(2)}`;
  }
  if (kind === "psw" && data.reason) return data.reason;
  if (data.files?.length) return `${data.files.length} document(s)`;
  return "";
}

function exportPackage(project) {
  const doc = new jsPDF();
  const left = 16;
  let y = 20;
  doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("PPAP Package Summary", left, y); y += 8;
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(110);
  doc.text(`${project.name}`, left, y); y += 5;
  doc.text(`P/N ${project.partNumber} · Rev ${project.revision} · ${project.supplier} → ${project.customer}`, left, y);
  doc.setTextColor(0); y += 5;
  const pr = (() => { const req = requiredFor(project.level); const ids = ELEMENTS.filter((e) => req.has(e.id)); const done = ids.filter((e) => project.elements[e.id].status === "completed").length; return { done, total: ids.length }; })();
  doc.text(`Level ${project.level} · ${pr.done}/${pr.total} required complete · Status: ${project.status}`, left, y); y += 10;

  const req = requiredFor(project.level);
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text("Elements", left, y); y += 7;
  doc.setFontSize(9);
  ELEMENTS.forEach((el) => {
    if (!req.has(el.id)) return;
    if (y > 275) { doc.addPage(); y = 20; }
    const st = project.elements[el.id];
    doc.setFont("helvetica", "bold");
    doc.text(`${String(el.n).padStart(2, "0")}. ${el.name}`, left, y);
    doc.setFont("helvetica", "normal");
    doc.text(st.status.replace("_", " "), left + 95, y);
    const sum = elementSummary(el.kind, st.data);
    if (sum) { doc.setTextColor(110); doc.text(sum, left + 130, y); doc.setTextColor(0); }
    y += 6;
  });
  doc.save(`PPAP_${project.partNumber || "package"}.pdf`);
}

function exportCSV(project) {
  const req = requiredFor(project.level);
  const rows = [
    ["PPAP Package", project.name],
    ["Part number", project.partNumber],
    ["Part name", project.partName],
    ["Revision", project.revision],
    ["Customer", project.customer],
    ["Supplier", project.supplier],
    ["Submission level", project.level],
    ["Status", project.status],
    [],
    ["#", "Element", "Status", "Summary"],
    ...ELEMENTS.filter((e) => req.has(e.id)).map((e) => [
      e.n, e.name, project.elements[e.id].status.replace("_", " "), elementSummary(e.kind, project.elements[e.id].data),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `PPAP_${project.partNumber || "package"}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

/* ------------------ stable form inputs (module scope) ------------------ *
 * Defined here, NOT inside render functions, so React keeps them mounted
 * across keystrokes and inputs don't lose focus.
 * --------------------------------------------------------------------- */
function LabeledInput({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input value={value} onChange={onChange} placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </label>
  );
}
function CellInput({ value, onChange, disabled, placeholder, w = "w-32", small }) {
  return (
    <input value={value} onChange={onChange} disabled={disabled} placeholder={placeholder}
      className={`${w} rounded border border-slate-200 px-2 py-1 ${small ? "text-xs text-slate-500" : "text-sm"} focus:border-blue-500 focus:outline-none disabled:bg-slate-50`} />
  );
}
function ScoreSelect({ value, onChange, disabled }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}
      className="w-14 rounded border border-slate-300 px-1 py-1 text-center text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}
function NumCell({ value, onChange, disabled, w = "w-20" }) {
  return (
    <input value={value} onChange={onChange} disabled={disabled} inputMode="decimal"
      className={`${w} rounded border border-slate-200 px-2 py-1 text-center font-mono text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50`} />
  );
}

/* ----------------------------- bits ----------------------------- */
function Stat({ label, value, accent }) {
  const color = accent === "amber" ? "text-amber-600" : accent === "emerald" ? "text-emerald-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{label}</p>
    </div>
  );
}
function ProgressBar({ pct }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
function StatusIcon({ status, large }) {
  const sz = large ? 26 : 18;
  if (status === "completed") return <CheckCircle2 size={sz} className="shrink-0 text-emerald-500" />;
  if (status === "in_progress") return <Clock size={sz} className="shrink-0 text-amber-500" />;
  if (status === "n/a") return <Circle size={sz} className="shrink-0 text-slate-200" />;
  return <Circle size={sz} className="shrink-0 text-slate-300" />;
}
function StatusPill({ status }) {
  const map = {
    draft: ["Draft", "bg-slate-100 text-slate-600"],
    submitted: ["Awaiting review", "bg-amber-100 text-amber-700"],
    approved: ["Approved", "bg-emerald-100 text-emerald-700"],
    rejected: ["Returned", "bg-rose-100 text-rose-700"],
  };
  const [label, cls] = map[status] || map.draft;
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}
function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
      <Icon size={32} className="mx-auto mb-3 text-slate-300" />
      <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{body}</p>
    </div>
  );
}
