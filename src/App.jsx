import React, { useState, useEffect } from "react";
import { jsPDF } from "jspdf";
import {
  ClipboardCheck, FileText, LayoutDashboard, FolderKanban, LogOut, ChevronRight,
  CheckCircle2, Circle, Clock, Upload, Plus, Trash2, ArrowLeft, ShieldCheck,
  XCircle, Send, Gauge, AlertTriangle, Factory, Download, RotateCcw,
  Settings, Lock, BarChart3, MessageSquare, Pencil, Table2, Bell, Zap, MoreVertical, Users, Mail, UserPlus, Workflow, PenLine, Inbox,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";

/* ================================================================== *
 *  PPAP Manager - demo build
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
  1: "Warrant only - submitted to customer.",
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

function BrandMark({ px = 36, variant = "blue" }) {
  if (variant === "light") {
    return (
      <span className="flex shrink-0 items-center justify-center rounded-md bg-white text-blue-700"
        style={{ width: px, height: px }}>
        <ClipboardCheck size={Math.round(px * 0.52)} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-md bg-blue-700 text-white"
      style={{ width: px, height: px }}>
      <ClipboardCheck size={Math.round(px * 0.52)} strokeWidth={2.2} />
    </span>
  );
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}
function relTime(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return "";
  if (d === 0) return "today";
  if (d > 0) return `in ${d}d`;
  return `${-d}d ago`;
}
function dueIn(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length);
}

/* ---- lightweight toast + confirm dialog (no extra deps) ---- */
let toastListeners = [];
let toastSeq = 0;
function toast(message, tone = "success") {
  const t = { id: ++toastSeq, message, tone };
  toastListeners.forEach((fn) => fn(t));
}

/* ---- simulated email outbox (real email needs a backend; see Resend note) ---- */
let outboxItems = [
  { id: 1, at: "2026-06-22 09:14", to: "anna.lee@meridianmotors.com", tag: "Submitted", subject: "PPAP submitted for approval: Sensor Housing", body: "SH-2045-A Rev A from Apex Components is ready for review at Submission Level 3 (18/18 required elements complete)." },
  { id: 2, at: "2026-06-21 11:30", to: "jane.roe@apexcomponents.com", tag: "Returned", subject: "PPAP returned for changes: Brake Assembly", body: "BR-3302-C was returned by Anna Lee. Notes: Cpk on the bore is below 1.33. Please re-run the capability study after the tooling change and resubmit." },
  { id: 3, at: "2026-06-20 16:02", to: "john.doe@apexcomponents.com", tag: "Approved", subject: "PPAP approved: Cooling Module", body: "CM-8871-B was approved by Anna Lee. Notes: Reviewed and approved. Strong capability on the seal groove." },
];
let outboxListeners = [];
function sendEmail(email) {
  const item = { id: Date.now() + Math.random(), at: new Date().toISOString().slice(0, 16).replace("T", " "), ...email };
  outboxItems = [item, ...outboxItems];
  outboxListeners.forEach((fn) => fn(outboxItems));
  if (email.to) toast(`Email sent to ${email.to}`, "info");
}
function notifyStatus(project, status, extra = {}) {
  const byName = (n) => USERS.find((u) => u.name === n);
  const supplierEmail = (byName(project.owner)?.email) || USERS.find((u) => u.role === "supplier_admin")?.email;
  const customerEmail = USERS.find((u) => u.role === "customer_admin")?.email;
  const prog = progressOf(project);
  if (status === "submitted")
    sendEmail({ to: customerEmail, tag: "Submitted", subject: `PPAP submitted for approval: ${project.name}`, body: `${project.partNumber} Rev ${project.revision} from ${project.supplier} is ready for review at Submission Level ${project.level} (${prog.done}/${prog.total} required elements complete).` });
  else if (status === "approved")
    sendEmail({ to: supplierEmail, tag: "Approved", subject: `PPAP approved: ${project.name}`, body: `${project.partNumber} was approved by ${extra.by || project.customer}.${extra.comments ? " Notes: " + extra.comments : ""}` });
  else if (status === "rejected")
    sendEmail({ to: supplierEmail, tag: "Returned", subject: `PPAP returned for changes: ${project.name}`, body: `${project.partNumber} was returned by ${extra.by || project.customer}.${extra.comments ? " Notes: " + extra.comments : ""}` });
}
function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const add = (t) => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 2600);
    };
    toastListeners.push(add);
    return () => { toastListeners = toastListeners.filter((fn) => fn !== add); };
  }, []);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <div key={t.id}
          className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            t.tone === "error" ? "bg-rose-600" : t.tone === "info" ? "bg-slate-800" : "bg-emerald-600"}`}>
          {t.tone === "error" ? <XCircle size={16} /> : t.tone === "info" ? <Bell size={16} /> : <CheckCircle2 size={16} />}
          {t.message}
        </div>
      ))}
    </div>
  );
}

let confirmListener = null;
function confirmDialog(opts) {
  return new Promise((resolve) => {
    if (confirmListener) confirmListener({ ...opts, resolve });
    else resolve(false);
  });
}
function ConfirmHost() {
  const [state, setState] = useState(null);
  useEffect(() => {
    confirmListener = (s) => setState(s);
    return () => { confirmListener = null; };
  }, []);
  if (!state) return null;
  const close = (val) => { state.resolve(val); setState(null); };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => close(false)}>
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900">{state.title}</h3>
        <p className="mt-1 text-sm text-slate-600">{state.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => close(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={() => close(true)}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${state.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-blue-600 hover:bg-blue-700"}`}>{state.confirmLabel || "Confirm"}</button>
        </div>
      </div>
    </div>
  );
}

const ROLES = {
  supplier_admin: { label: "Supplier Admin", org: "supplier" },
  supplier_member: { label: "Supplier Member", org: "supplier" },
  customer_admin: { label: "Customer Admin", org: "customer" },
  customer_member: { label: "Customer Member", org: "customer" },
};
const roleLabel = (r) => (ROLES[r] ? ROLES[r].label : r);
const roleOrg = (r) => (ROLES[r] ? ROLES[r].org : "supplier");
const isSupplier = (u) => !!u && roleOrg(u.role) === "supplier";
const isCustomer = (u) => !!u && roleOrg(u.role) === "customer";
const canManageUsers = (u) => !!u && u.role.endsWith("_admin");

const SUPPLIER_CO = "Apex Components";
const CUSTOMER_CO = "Meridian Motors";
const USERS = [
  { id: 1, name: "John Doe", email: "john.doe@apexcomponents.com", company: SUPPLIER_CO, role: "supplier_admin", title: "Quality Lead" },
  { id: 2, name: "Jane Roe", email: "jane.roe@apexcomponents.com", company: SUPPLIER_CO, role: "supplier_member", title: "Supplier Engineer" },
  { id: 3, name: "Mike Smith", email: "mike.smith@apexcomponents.com", company: SUPPLIER_CO, role: "supplier_member", title: "Manufacturing Engineer" },
  { id: 4, name: "Anna Lee", email: "anna.lee@meridianmotors.com", company: CUSTOMER_CO, role: "customer_admin", title: "Quality Manager" },
  { id: 5, name: "Sam Carter", email: "sam.carter@meridianmotors.com", company: CUSTOMER_CO, role: "customer_member", title: "Customer Quality Engineer" },
];

function Avatar({ name, role, size = 30 }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const bg = roleOrg(role) === "customer" ? "bg-emerald-500" : "bg-blue-500";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${bg}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>
  );
}

/* --------------------------- persistence --------------------------- */
const STORAGE_KEY = "ppap-demo-v1";
const DATA_VERSION = 3;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === DATA_VERSION) return parsed;
    localStorage.removeItem(STORAGE_KEY); // saved data is from an older version - reseed
  } catch (e) { /* ignore */ }
  return null;
}
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: DATA_VERSION, ...state }));
  } catch (e) { /* quota or privacy mode - demo still works in-session */ }
}

function blankElements() {
  const out = {};
  ELEMENTS.forEach((e) => (out[e.id] = { status: "not_started", data: {} }));
  return out;
}

let _id = 100;
const nextId = () => ++_id;

function spcSample() {
  return {
    lsl: "11.98", usl: "12.02", target: "12.00",
    readings: [12.004, 12.007, 12.002, 12.006, 12.009, 12.003, 12.005, 12.008, 12.001, 12.006, 12.004, 12.010, 12.005, 12.003, 12.007, 12.002, 12.006, 12.004, 12.008, 12.005, 12.003, 12.006, 12.009, 12.004, 12.005],
  };
}
function parseReadings(v) {
  if (Array.isArray(v)) return v.filter((x) => typeof x === "number" && !isNaN(x));
  if (typeof v === "string") return v.split(/[\s,]+/).map(Number).filter((x) => !isNaN(x));
  return [];
}
function spcStats(data) {
  if (!data) return null;
  const xs = parseReadings(data.readings);
  const lsl = parseFloat(data.lsl), usl = parseFloat(data.usl);
  if (xs.length >= 2 && !isNaN(lsl) && !isNaN(usl)) {
    const n = xs.length;
    const mean = xs.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1));
    let mr = 0; for (let i = 1; i < n; i++) mr += Math.abs(xs[i] - xs[i - 1]);
    const mrBar = mr / (n - 1);
    const sigmaHat = mrBar / 1.128 || sd;
    const cp = (usl - lsl) / (6 * sd);
    const cpk = Math.min((usl - mean) / (3 * sd), (mean - lsl) / (3 * sd));
    return { n, mean, sd, cp, cpk, ucl: mean + 3 * sigmaHat, lcl: mean - 3 * sigmaHat, sigmaHat, xs, lsl, usl };
  }
  // fallback to summary statistics if no readings
  const mean = parseFloat(data.mean), sd = parseFloat(data.sd);
  if ([usl, lsl, mean, sd].every((v) => !isNaN(v)) && sd > 0) {
    return { n: 0, mean, sd, cp: (usl - lsl) / (6 * sd), cpk: Math.min((usl - mean) / (3 * sd), (mean - lsl) / (3 * sd)), ucl: mean + 3 * sd, lcl: mean - 3 * sd, sigmaHat: sd, xs: [], lsl, usl };
  }
  return null;
}

function completedElements() {
  const out = {};
  ELEMENTS.forEach((e) => (out[e.id] = { status: "completed", data: { files: [{ name: `${e.id}_evidence.pdf`, size: 120000, version: 1, at: "2026-06-10", by: "Jane Roe" }] } }));
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
      { id: 1, item: "CNC mill op 20", fn: "Machine bore", mode: "Oversize bore", effect: "Loose fit", sev: 6, cause: "Tool offset drift", occ: 3, ctrl: "In-process gauging", det: 2, stepId: 2 },
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
    { id: 1, characteristic: "Bore Ø", spec: "12.0 ±0.02", method: "CMM", freq: "5/shift", reaction: "Quarantine + adjust offset", stepId: 2 },
    { id: 2, characteristic: "Seal groove width", spec: "2.50 ±0.05", method: "Optical comparator", freq: "Hourly", reaction: "Replace tool, sort batch", stepId: 5 },
  ] } };
  out.measurement_system_analysis = { status: "completed", data: { ev: "0.08", av: "0.05", pv: "1.20", tol: "0.04" } };
  out.initial_sample_inspection = { status: "completed", data: { ...spcSample(), files: [{ name: "initial_sample_inspection_evidence.pdf", size: 120000, version: 1, at: "2026-06-10", by: "Jane Roe" }] } };
  out.material_performance_results = { status: "completed", data: { rows: [
    { id: 1, test: "Salt spray", requirement: "≥ 96 h", result: "120 h", verdict: "pass" },
    { id: 2, test: "Tensile strength", requirement: "≥ 240 MPa", result: "268 MPa", verdict: "pass" },
  ] } };
  out.customer_specific_requirements = { status: "completed", data: { items: CSR_DEFAULTS.map((text, i) => ({ id: i + 1, text, met: true, note: "On file" })) } };
  out.part_submission_warrant = { status: "completed", data: { reason: "Initial submission", declared: true, supplierSign: { name: "John Doe", date: "2026-06-09" } } };
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
  const draftEls = blankElements();
  draftEls.design_records = { status: "completed", data: { files: [{ name: "SB-1180-A_drawing_revA.pdf", size: 248000, by: "Mike Smith", at: "2026-06-08", version: 2 }], notes: "Released drawing, Rev A." } };
  draftEls.process_flow_diagram = { status: "completed", data: { steps: [
    { id: 1, name: "Receive blank", type: "Operation", desc: "Steel stamping" },
    { id: 2, name: "Form bracket", type: "Operation", desc: "Press op 10" },
    { id: 3, name: "Inspect form", type: "Inspection", desc: "Go/no-go" },
  ] } };
  draftEls.design_fmea = { status: "in_progress", data: { rows: [
    { id: 1, item: "Mounting arm", fn: "Locate bracket", mode: "Arm cracks", effect: "Loss of retention", sev: 8, cause: "Stress concentration", occ: 4, ctrl: "FEA + radius spec", det: 3 },
  ] } };

  const lowCpk = () => { const e = completedElements(); e.initial_sample_inspection = { status: "completed", data: { lsl: "11.98", usl: "12.02", mean: "12.006", sd: "0.007" } }; return e; };

  return [
    {
      id: 1, name: "Sensor Housing", partNumber: "SH-2045-A", partName: "Coolant Temp Sensor Housing",
      customer: CUSTOMER_CO, supplier: SUPPLIER_CO, revision: "A", level: 3,
      status: "submitted", submission: { status: "pending", comments: "" },
      owner: "Jane Roe", elements: completedElements(), due: dueIn(4),
      activity: [evt("Submitted for approval", 1), evt("Customer engineering approval granted", 2), evt("Created by Jane Roe", 9)],
    },
    {
      id: 2, name: "Cooling Module", partNumber: "CM-8871-B", partName: "Radiator Cooling Module",
      customer: CUSTOMER_CO, supplier: SUPPLIER_CO, revision: "B", level: 3,
      status: "approved", submission: { status: "approved", comments: "Reviewed and approved. Strong capability on the seal groove.", by: "Anna Lee", signedAt: "2026-06-20" },
      owner: "John Doe", elements: completedElements(), due: dueIn(-6),
      activity: [evt("Approved by Anna Lee", 2), evt("Submitted for approval", 5), evt("Created by John Doe", 18)],
    },
    {
      id: 3, name: "Brake Assembly", partNumber: "BR-3302-C", partName: "Front Brake Caliper Assembly",
      customer: CUSTOMER_CO, supplier: SUPPLIER_CO, revision: "C", level: 3,
      status: "rejected", submission: { status: "rejected", comments: "Cpk on the bore is below 1.33. Please re-run the capability study after the tooling change and resubmit.", by: "Anna Lee" },
      owner: "Jane Roe", elements: lowCpk(), due: dueIn(6),
      activity: [evt("Returned for changes by Anna Lee", 1), evt("Submitted for approval", 2), evt("Created by Jane Roe", 12)],
    },
    {
      id: 4, name: "Steering Bracket", partNumber: "SB-1180-A", partName: "Steering Column Bracket",
      customer: CUSTOMER_CO, supplier: SUPPLIER_CO, revision: "A", level: 3,
      status: "draft", submission: null,
      owner: "Mike Smith", elements: draftEls, due: dueIn(14),
      activity: [evt("Design records uploaded by Mike Smith", 3), evt("Created by Mike Smith", 5)],
    },
    {
      id: 5, name: "Battery Mount", partNumber: "BM-4420-A", partName: "HV Battery Mounting Frame",
      customer: CUSTOMER_CO, supplier: SUPPLIER_CO, revision: "A", level: 3,
      status: "submitted", submission: { status: "pending", comments: "" },
      owner: "John Doe", elements: completedElements(), due: dueIn(2),
      activity: [evt("Submitted for approval", 1), evt("Created by John Doe", 8)],
    },
    {
      id: 6, name: "Coolant Pump", partNumber: "CP-7763-A", partName: "Electric Coolant Pump Body",
      customer: CUSTOMER_CO, supplier: SUPPLIER_CO, revision: "A", level: 1,
      status: "draft", submission: null,
      owner: "Mike Smith", elements: blankElements(), due: dueIn(21),
      activity: [evt("Created by Mike Smith", 1)],
    },
  ];
}

/* ============================== app ============================== */
export default function App() {
  const initial = loadState();
  const [user, setUser] = useState(initial?.user || null);
  const [projects, setProjects] = useState(initial?.projects || seedProjects());
  const [route, setRoute] = useState({ view: "dashboard", projectId: null, elementId: null });
  const [guideOpen, setGuideOpen] = useState(true);
  const [users, setUsers] = useState(initial?.users || USERS);

  useEffect(() => {
    saveState({ user, projects, users });
  }, [user, projects, users]);

  const updateProject = (id, updater) =>
    setProjects((ps) => ps.map((p) => (p.id === id ? updater(p) : p)));

  const resetDemo = async () => {
    if (await confirmDialog({ title: "Reset the demo?", body: "This reloads the sample data and discards your changes.", confirmLabel: "Reset", danger: true })) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      setProjects(seedProjects());
      setRoute({ view: "dashboard", projectId: null, elementId: null });
      toast("Demo reset to sample data", "info");
    }
  };

  if (!user) return <Login onLogin={(u) => { setUser(u); setRoute({ view: "dashboard", projectId: null, elementId: null }); }} />;

  return (
    <div className="flex min-h-screen flex-col text-slate-800">
      <DemoBanner onReset={resetDemo} />
      <div className="flex flex-1 overflow-hidden bg-slate-50">
        <Sidebar user={user} route={route} setRoute={setRoute} onLogout={() => setUser(null)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} route={route} setRoute={setRoute} projects={projects} onLogout={() => setUser(null)} />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            {route.view === "dashboard" && guideOpen && (
              <DemoGuide role={user.role} projects={projects} onDismiss={() => setGuideOpen(false)}
                open={(id) => setRoute({ view: "project", projectId: id, elementId: null })}
                goProjects={() => setRoute({ view: "projects", projectId: null, elementId: null })}
                goAnalytics={() => setRoute({ view: "analytics", projectId: null, elementId: null })} />
            )}
            <Content
              user={user}
              projects={projects}
              setProjects={setProjects}
              updateProject={updateProject}
              users={users}
              setUsers={setUsers}
              route={route}
              setRoute={setRoute}
            />
          </main>
        </div>
      </div>
      <Toaster />
      <ConfirmHost />
      <SignHost />
    </div>
  );
}

function TopBar({ user, route, setRoute, projects, onLogout }) {
  const roleColor = isCustomer(user) ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700";
  const navItems = [
    { key: "dashboard", label: "Home" },
    { key: "projects", label: "Packages" },
    { key: "analytics", label: "Stats" },
  ];
  const [bellOpen, setBellOpen] = useState(false);
  const notes = isSupplier(user)
    ? projects.filter((p) => p.status === "rejected").map((p) => ({ p, text: "Returned for changes", tone: "rose" }))
    : projects.filter((p) => p.submission?.status === "pending").map((p) => ({ p, text: "Awaiting your review", tone: "amber" }));
  const pending = notes.length;
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
        <div className="relative">
          <button onClick={() => setBellOpen((o) => !o)}
            title={pending > 0 ? `${pending} item${pending === 1 ? "" : "s"} need attention` : "No notifications"}
            className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
            <Bell size={18} />
            {pending > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">{pending}</span>
            )}
          </button>
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                  <span className="text-sm font-semibold text-slate-700">Notifications</span>
                  {pending > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">{pending} new</span>}
                </div>
                {notes.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <CheckCircle2 size={22} className="mx-auto mb-1.5 text-emerald-400" />
                    <p className="text-sm text-slate-400">You're all caught up.</p>
                  </div>
                ) : (
                  <ul className="max-h-80 overflow-y-auto py-1">
                    {notes.map(({ p, text, tone }) => (
                      <li key={p.id}>
                        <button onClick={() => { setRoute({ view: "project", projectId: p.id, elementId: null }); setBellOpen(false); }}
                          className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition hover:bg-slate-50">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${tone === "rose" ? "bg-rose-500" : "bg-amber-500"}`} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">{p.name}</span>
                            <span className="block font-mono text-xs text-slate-500">{text} · {p.partNumber}</span>
                          </span>
                          <ChevronRight size={15} className="mt-0.5 shrink-0 text-slate-300" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColor}`}>{roleLabel(user.role)}</span>
        <Avatar name={user.name} role={user.role} size={28} />
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
    <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-800">
      <span className="flex items-center gap-2">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
        Demo environment. Data is stored in this browser only.
      </span>
      <button onClick={onReset} className="flex items-center gap-1 rounded px-2 py-1 text-blue-600 transition hover:bg-blue-100 hover:text-blue-800">
        <RotateCcw size={12} /> Reset demo
      </button>
    </div>
  );
}

/* ----------------------------- login ----------------------------- */
function DemoGuide({ role, projects, open, goProjects, goAnalytics, onDismiss }) {
  const [done, setDone] = useState([]);
  const mark = (i, run) => { setDone((d) => (d.includes(i) ? d : [...d, i])); run(); };
  const cust = roleOrg(role) === "customer";
  const pendings = projects.filter((p) => p.submission && p.submission.status === "pending");
  const first = projects[0];

  const scenario = cust
    ? `You are a quality engineer at ${CUSTOMER_CO}. ${pendings.length === 1 ? "One supplier package is" : `${pendings.length} supplier packages are`} awaiting your approval.`
    : `You are a quality engineer at ${SUPPLIER_CO}. Prepare a PPAP package and submit it to ${CUSTOMER_CO} for approval.`;

  const steps = cust
    ? [
        { label: "Open a submission and review its 18 elements", run: () => (pendings[0] ? open(pendings[0].id) : goProjects()) },
        { label: "Approve it, or return it with a comment", run: () => (pendings[0] ? open(pendings[0].id) : goProjects()) },
        { label: "Check the analytics: cycle time and approval rate", run: goAnalytics },
      ]
    : [
        { label: "Open a package and fill an element (Cpk and RPN calculate live)", run: () => (first ? open(first.id) : goProjects()) },
        { label: "Switch the packages view to the pipeline board", run: goProjects },
        { label: "Check the analytics: status mix and supplier performance", run: goAnalytics },
      ];

  return (
    <div className="relative mb-6 rounded-md border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-blue-600">Guided demo</p>
          <p className="mt-0.5 text-sm text-slate-700">{scenario}</p>
        </div>
        <button onClick={onDismiss} title="Dismiss" className="ml-4 shrink-0 rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"><XCircle size={18} /></button>
      </div>
      <div className="px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-slate-500">Try these</p>
          <p className="text-xs text-slate-400">{done.length} of {steps.length} explored</p>
        </div>
        <div className="space-y-1.5">
          {steps.map((s, i) => {
            const ok = done.includes(i);
            return (
              <button key={i} onClick={() => mark(i, s.run)}
                className="group flex w-full items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-left text-sm transition hover:border-blue-400 hover:bg-blue-50/40">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${ok ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700"}`}>
                  {ok ? <CheckCircle2 size={13} /> : i + 1}
                </span>
                <span className={ok ? "text-slate-400 line-through" : "text-slate-700"}>{s.label}</span>
                <ChevronRight size={15} className="ml-auto shrink-0 text-slate-300" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const roles = [
    { role: "supplier_admin", user: USERS[0], icon: Factory, accent: "blue", desc: "Create, edit, submit packages and manage your team" },
    { role: "supplier_member", user: USERS[1], icon: ClipboardCheck, accent: "blue", desc: "Build and submit PPAP packages" },
    { role: "customer_admin", user: USERS[3], icon: ShieldCheck, accent: "emerald", desc: "Review, approve, return and manage your team" },
    { role: "customer_member", user: USERS[4], icon: ShieldCheck, accent: "emerald", desc: "Review submissions and leave comments" },
  ];
  const capabilities = [
    "18-element PPAP packages, scoped to submission level",
    "FMEA, Cpk and Gage R&R calculated inline",
    "Supplier-to-customer submission and approval workflow",
    "PSW and full-package export, with activity history",
  ];
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <BrandMark px={30} />
            <span className="text-sm font-semibold tracking-tight text-slate-900">PPAP Manager</span>
          </div>
          <span className="text-xs text-slate-400">Internal demo environment</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 items-center px-6 py-10">
        <div className="grid w-full overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm md:grid-cols-[1.1fr_1fr]">
          <div className="flex flex-col justify-between bg-blue-800 p-8 text-blue-50">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-blue-300">Production Part Approval Process</p>
              <h1 className="mt-3 text-2xl font-semibold leading-snug text-white">
                Prepare, submit and approve PPAP packages in one place.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-blue-100">
                Shared between supplier and customer quality teams. Replaces the email-and-spreadsheet handoff for production part approval.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-blue-100">
                {capabilities.map((c) => (
                  <li key={c} className="flex gap-2.5">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-blue-300" />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-8 text-xs text-blue-300">AIAG PPAP 4th edition reference. Not affiliated with AIAG.</p>
          </div>

          <div className="flex flex-col justify-center p-8">
            <h2 className="text-sm font-semibold text-slate-900">Sign in</h2>
            <p className="mb-4 mt-1 text-xs text-slate-500">Select an account to continue.</p>
            <div className="space-y-2">
              {roles.map(({ role, user, icon, accent, desc }) => (
                <RoleButton key={role} icon={icon} accent={accent}
                  title={`${roleLabel(role)}`}
                  sub={`${user.name}, ${user.company}`}
                  hint={desc}
                  onClick={() => onLogin({ name: user.name, role, company: user.company, email: user.email, title: user.title })} />
              ))}
            </div>
            <p className="mt-4 text-[11px] text-slate-400">Demo accounts. Data is kept in this browser only.</p>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-5 text-xs text-slate-400">
        PPAP Manager. Product demo by Chaitanya Patwardhan.
      </footer>
    </div>
  );
}
function RoleButton({ onClick, icon: Icon, accent, title, sub, hint }) {
  const ic = accent === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600";
  return (
    <button onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-blue-400 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded ${ic}`}><Icon size={16} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-900">{title}</span>
        <span className="block truncate text-xs text-slate-500">{sub}</span>
      </span>
      <ChevronRight size={15} className="shrink-0 text-slate-300" />
    </button>
  );
}

/* ----------------------------- chrome ----------------------------- */
function Sidebar({ user, route, setRoute, onLogout }) {
  const items = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "projects", label: "Packages", icon: FolderKanban },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "outbox", label: "Notifications", icon: Inbox },
    ...(canManageUsers(user) ? [{ key: "members", label: "Members", icon: Users }] : []),
  ];
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-blue-800 text-blue-100 sm:flex">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <BrandMark px={34} variant="light" />
        <div className="leading-tight">
          <span className="block text-sm font-semibold tracking-tight text-white">PPAP Manager</span>
          <span className="block text-[10px] text-blue-200/80">PPAP 4th edition</span>
        </div>
      </div>
      <div className="border-b border-white/10 px-4 py-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-300/80">{isCustomer(user) ? "Customer" : "Supplier"}</p>
        <p className="text-sm font-medium text-white">{user.company}</p>
      </div>
      <nav className="flex-1 px-3 py-3">
        {items.map(({ key, label, icon: Icon }) => {
          const active = route.view === key || (key === "projects" && (route.view === "project" || route.view === "element"));
          return (
            <button key={key} onClick={() => setRoute({ view: key, projectId: null, elementId: null })}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                active ? "bg-white font-medium text-blue-800 shadow-sm" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
              <Icon size={17} className={active ? "text-blue-700" : "text-blue-200"} /> {label}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2.5 px-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
            {user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-[11px] text-blue-200/80">{roleLabel(user.role)}</p>
          </div>
        </div>
        <button onClick={onLogout}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-blue-100 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  );
}

/* ----------------------------- router ----------------------------- */
function Content({ user, projects, setProjects, updateProject, users, setUsers, route, setRoute }) {
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
    return <ProjectsList user={user} projects={projects} setProjects={setProjects} updateProject={updateProject}
      open={(id) => setRoute({ view: "project", projectId: id, elementId: null })} />;
  }
  if (route.view === "analytics") return <AnalyticsView projects={projects} users={users} />;
  if (route.view === "members") return <Members user={user} users={users} setUsers={setUsers} />;
  if (route.view === "outbox") return <Outbox />;
  return <Dashboard user={user} projects={projects} updateProject={updateProject}
    open={(id) => setRoute({ view: "project", projectId: id, elementId: null })}
    goProjects={() => setRoute({ view: "projects", projectId: null, elementId: null })} />;
}

/* --------------------------- helpers --------------------------- */
function progressOf(project) {
  const req = requiredFor(project.level);
  const reqIds = ELEMENTS.filter((e) => req.has(e.id));
  const done = reqIds.filter((e) => project.elements[e.id].status === "completed").length;
  return { done, total: reqIds.length, pct: Math.round((done / reqIds.length) * 100) };
}
function latestFile(project) {
  let best = null;
  ELEMENTS.forEach((e) => {
    (project.elements[e.id]?.data?.files || []).forEach((f) => {
      if (!best || (f.at || "") >= (best.at || "")) best = { ...f, element: e.name };
    });
  });
  return best;
}
function lastUpdated(project) {
  return project.activity && project.activity.length ? project.activity[0].t : null;
}
const STATUS_FLOW = [
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Awaiting Approval" },
  { key: "rejected", label: "Returned" },
  { key: "approved", label: "Approved" },
];

/* --------------------------- dashboards --------------------------- */
function Dashboard({ user, projects, updateProject, open, goProjects }) {
  const totals = projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
  const overdue = projects.filter((p) => p.status !== "approved" && daysUntil(p.due) < 0).length;
  const queue = projects.filter((p) => p.submission && p.submission.status === "pending");
  const upcoming = projects.filter((p) => p.status !== "approved" && p.due).sort((a, b) => new Date(a.due) - new Date(b.due)).slice(0, 5);
  const recent = [...projects].sort((a, b) => (lastUpdated(b) || "").localeCompare(lastUpdated(a) || "")).slice(0, 5);
  const feed = [];
  projects.forEach((p) => (p.activity || []).forEach((a) => feed.push({ ...a, project: p.name, id: p.id })));
  feed.sort((a, b) => (b.t || "").localeCompare(a.t || ""));
  const cust = isCustomer(user);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mb-6 text-sm text-slate-500">{user.company} · {roleLabel(user.role)}</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Total Packages" value={projects.length} accent="blue" />
        <Stat label="Draft" value={totals.draft || 0} />
        <Stat label="Awaiting Approval" value={totals.submitted || 0} accent="amber" />
        <Stat label="Returned" value={totals.rejected || 0} />
        <Stat label="Approved" value={totals.approved || 0} accent="emerald" />
        <Stat label="Overdue" value={overdue} accent={overdue > 0 ? "amber" : undefined} />
      </div>

      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Bell size={15} className="text-amber-500" /> Approval Queue</h2>
          <span className="text-xs text-slate-400">{queue.length} awaiting approval</span>
        </div>
        {queue.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">Nothing is awaiting approval right now.</div>
        ) : cust ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {queue.map((p) => <ReviewCard key={p.id} project={p} user={user} updateProject={updateProject} open={() => open(p.id)} />)}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {queue.map((p) => (
              <button key={p.id} onClick={() => open(p.id)} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50">
                <span><span className="text-sm font-medium text-slate-800">{p.name}</span> <span className="font-mono text-xs text-slate-400">{p.partNumber}</span></span>
                <span className="flex items-center gap-2 text-xs text-slate-500">Awaiting {p.customer} <ChevronRight size={14} /></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Clock size={15} className="text-slate-400" /> Upcoming Due Dates</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {upcoming.length === 0 ? <p className="px-4 py-6 text-center text-sm text-slate-400">Nothing scheduled.</p> : upcoming.map((p) => {
              const d = daysUntil(p.due);
              return (
                <button key={p.id} onClick={() => open(p.id)} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50">
                  <span><span className="text-sm text-slate-700">{p.name}</span> <span className="font-mono text-xs text-slate-400">{p.partNumber}</span></span>
                  <span className={`text-xs ${d < 0 ? "font-medium text-rose-600" : d <= 3 ? "text-amber-600" : "text-slate-500"}`}>{d < 0 ? `${-d}d overdue` : `Due in ${d}d`}</span>
                </button>
              );
            })}
          </div>

          <h2 className="mb-3 mt-6 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><FolderKanban size={15} className="text-slate-400" /> Recently Updated</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {recent.map((p) => {
              const pr = progressOf(p);
              return (
                <button key={p.id} onClick={() => open(p.id)} className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2.5 text-left last:border-0 hover:bg-slate-50">
                  <span className="min-w-0"><span className="text-sm text-slate-700">{p.name}</span> <span className="font-mono text-xs text-slate-400">{lastUpdated(p)}</span></span>
                  <span className="flex items-center gap-2"><span className="font-mono text-xs text-slate-400">{pr.pct}%</span><StatusPill status={p.status} /></span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Zap size={15} className="text-slate-400" /> Recent Activity</h2>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <ol className="space-y-3">
              {feed.slice(0, 9).map((a, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-16 shrink-0 font-mono text-xs text-slate-400">{a.t}</span>
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                  <span className="text-slate-600"><span className="font-medium text-slate-700">{a.project}</span>: {a.text}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

const CHART_BLUE = "#2563eb";
const STATUS_COLORS = { draft: "#94a3b8", submitted: "#f59e0b", rejected: "#ef4444", approved: "#10b981" };

function AnalyticsView({ projects, users }) {
  const counts = projects.reduce((a, p) => { a[p.status] = (a[p.status] || 0) + 1; return a; }, {});
  const statusData = STATUS_FLOW.map((s) => ({ name: s.label, key: s.key, value: counts[s.key] || 0 }));

  // cycle time: days from submit to approve, from activity dates
  const cycleRows = [];
  projects.forEach((p) => {
    const sub = (p.activity || []).find((a) => /Submitted/.test(a.text));
    const app = (p.activity || []).find((a) => /Approved/.test(a.text));
    if (sub && app) { const days = Math.max(1, Math.round((new Date(sub.t) - new Date(app.t)) / 86400000)); cycleRows.push({ project: p.name, days }); }
  });
  const avgCycle = cycleRows.length ? Math.round(cycleRows.reduce((s, r) => s + r.days, 0) / cycleRows.length) : 0;

  // demo monthly series (approvals + cycle time) for a realistic trend
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const monthly = months.map((m, i) => ({ month: m, approvals: [3, 4, 5, 4, 6, (counts.approved || 0) + 4][i], cycle: [9, 8, 7, 7, 6, Math.max(5, avgCycle || 6)][i] }));

  const supplierPerf = [
    { name: SUPPLIER_CO, onTime: 92, approvals: (counts.approved || 0) + 6 },
    { name: "Forge Industrial", onTime: 84, approvals: 7 },
    { name: "Delta Precision", onTime: 78, approvals: 5 },
    { name: "Nova Castings", onTime: 70, approvals: 3 },
  ];

  const completionTrend = months.map((m, i) => ({ month: m, completion: [62, 68, 71, 75, 79, 83][i] }));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-1 text-xl font-semibold text-slate-900">Analytics</h1>
      <p className="mb-6 text-sm text-slate-500">Performance across all packages, suppliers, and customers.</p>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Avg. Cycle Time" value={`${avgCycle || 7}d`} accent="blue" />
        <Stat label="Approval Rate" value={`${Math.round(((counts.approved || 0) / Math.max(1, projects.length)) * 100)}%`} accent="emerald" />
        <Stat label="Returned" value={counts.rejected || 0} accent="amber" />
        <Stat label="Overdue" value={projects.filter((p) => p.status !== "approved" && daysUntil(p.due) < 0).length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Packages by Status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusData.map((d) => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Approvals">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="approvals" fill={CHART_BLUE} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Approval Cycle Time (days)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="cycle" stroke={CHART_BLUE} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Supplier Performance (on-time %)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={supplierPerf} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="onTime" fill={CHART_BLUE} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Top Suppliers</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-1.5">Supplier</th><th className="py-1.5">On-time</th><th className="py-1.5">Approved</th></tr></thead>
            <tbody>
              {supplierPerf.map((s) => (
                <tr key={s.name} className="border-t border-slate-100"><td className="py-2 text-slate-700">{s.name}</td><td className="py-2 text-slate-600">{s.onTime}%</td><td className="py-2 text-slate-600">{s.approvals}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Recently Approved</h3>
          {projects.filter((p) => p.status === "approved").length === 0 ? <p className="text-sm text-slate-400">None yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-1.5">Package</th><th className="py-1.5">Part</th><th className="py-1.5">Approved by</th></tr></thead>
              <tbody>
                {projects.filter((p) => p.status === "approved").map((p) => (
                  <tr key={p.id} className="border-t border-slate-100"><td className="py-2 text-slate-700">{p.name}</td><td className="py-2 font-mono text-xs text-slate-500">{p.partNumber}</td><td className="py-2 text-slate-600">{p.submission?.by || p.customer}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
function ChartCard({ title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Outbox() {
  const [items, setItems] = useState(outboxItems);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    const fn = (next) => setItems([...next]);
    outboxListeners.push(fn);
    return () => { outboxListeners = outboxListeners.filter((f) => f !== fn); };
  }, []);
  const tagColor = (t) => t === "Approved" ? "bg-emerald-100 text-emerald-700" : t === "Returned" ? "bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-700";
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
      <p className="mb-2 mt-0.5 text-sm text-slate-500">Emails the system sends on submit, approve, and return.</p>
      <div className="mb-4 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Mail size={13} /> Simulated outbox for the demo. With a backend (e.g. Resend) these send as real email.
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">No notifications yet. Submit or approve a package to generate one.</p>
        ) : items.map((m) => (
          <div key={m.id} className="border-b border-slate-100 last:border-0">
            <button onClick={() => setOpen(open === m.id ? null : m.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Mail size={15} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{m.subject}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${tagColor(m.tag)}`}>{m.tag}</span>
                </span>
                <span className="block truncate text-xs text-slate-400">To {m.to} · {m.at}</span>
              </span>
              <ChevronRight size={15} className={`shrink-0 text-slate-300 transition ${open === m.id ? "rotate-90" : ""}`} />
            </button>
            {open === m.id && (
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="mb-1 text-xs text-slate-400">To: {m.to}</p>
                <p className="mb-2 font-medium text-slate-700">{m.subject}</p>
                <p>{m.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Members({ user, users, setUsers }) {
  const canManage = canManageUsers(user);
  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", company: user.company, role: isCustomer(user) ? "customer_member" : "supplier_member" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const valid = form.name.trim() && /\S+@\S+\.\S+/.test(form.email);
  const invite = () => {
    setUsers((us) => [...us, { id: Date.now(), name: form.name.trim(), email: form.email.trim(), company: form.company, role: form.role, title: "Invited member" }]);
    toast(`Invitation sent to ${form.name.trim()}`);
    setForm({ name: "", email: "", company: user.company, role: isCustomer(user) ? "customer_member" : "supplier_member" });
    setInviting(false);
  };
  const orgs = [SUPPLIER_CO, CUSTOMER_CO];
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Members</h1>
          <p className="mt-0.5 text-sm text-slate-500">{users.length} people across {SUPPLIER_CO} and {CUSTOMER_CO}</p>
        </div>
        {canManage && (
          <button onClick={() => setInviting(true)} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <UserPlus size={16} /> Invite member
          </button>
        )}
      </div>

      {inviting && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Invite a member</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <LabeledInput label="Name" value={form.name} onChange={set("name")} placeholder="Full name" />
            <LabeledInput label="Email" value={form.email} onChange={set("email")} placeholder="name@company.com" />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Company</span>
              <select value={form.company} onChange={set("company")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {orgs.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Role</span>
              <select value={form.role} onChange={set("role")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                {Object.keys(ROLES).map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => valid && invite()} disabled={!valid} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Mail size={15} /> Send invitation</button>
            <button onClick={() => setInviting(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      )}

      {orgs.map((org) => (
        <div key={org} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">{org}</h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {users.filter((u) => u.company === org).map((u) => (
              <div key={u.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} role={u.role} size={32} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{u.name}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleOrg(u.role) === "customer" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{roleLabel(u.role)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ project, updateProject, open, user }) {
  const [comments, setComments] = useState("");
  const p = progressOf(project);
  const by = user ? user.name : "Customer";
  const decide = (status, sign) => {
    const signedBy = sign?.name || by;
    updateProject(project.id, (pr) => withEvent({ ...pr, status, submission: { ...pr.submission, status, comments, by: signedBy, signature: sign?.dataUrl, signedAt: sign?.date } }, status === "approved" ? `Approved by ${signedBy}` : `Returned for changes by ${signedBy}`));
    toast(status === "approved" ? "Package approved" : "Returned to supplier", status === "approved" ? "success" : "info");
    notifyStatus(project, status, { by: signedBy, comments });
  };
  const approve = async () => {
    const s = await requestSignature({ title: "Sign to approve", subtitle: `Approve ${project.name} on behalf of ${project.customer}.`, confirmLabel: "Sign & approve", defaultName: by });
    if (s) decide("approved", s);
  };
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
        <button onClick={open} className="ml-2 text-blue-600 hover:underline">View package</button>
      </div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Review comments</label>
      <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={2}
        placeholder="Notes for the supplier (required to return the package)"
        className="mb-3 w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      <div className="flex gap-2">
        <button onClick={approve}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <PenLine size={16} /> Sign &amp; approve
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
function ProjectsList({ user, projects, setProjects, updateProject, open }) {
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("table");
  const csvRef = React.useRef(null);
  const canBuild = isSupplier(user);

  const create = (form) => {
    const proj = {
      id: nextId(),
      name: form.name,
      partNumber: form.partNumber,
      partName: form.partName,
      customer: form.customer || CUSTOMER_CO,
      supplier: user.company,
      revision: form.revision || "A",
      level: Number(form.level) || 3,
      status: "draft",
      submission: null,
      owner: user.name,
      elements: blankElements(),
      due: dueIn(30),
      activity: [evt(`Created by ${user.name}`)],
    };
    setProjects((ps) => [proj, ...ps]);
    setCreating(false);
    toast("Package created");
    open(proj.id);
  };

  const importCSV = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result));
        if (!rows.length) { toast("No rows found in the file", "error"); return; }
        const header = rows[0].map((h) => h.trim().toLowerCase());
        const idx = (names) => names.map((n) => header.indexOf(n)).find((i) => i >= 0);
        const ci = { name: idx(["name", "package", "package name"]), partNumber: idx(["partnumber", "part number", "part no", "part no."]), partName: idx(["partname", "part name"]), customer: idx(["customer"]), revision: idx(["revision", "rev"]), level: idx(["level", "submission level"]) };
        if (ci.name == null && ci.partNumber == null) { toast("CSV needs at least a name or part number column", "error"); return; }
        const made = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r]; if (!row || row.every((c) => !c.trim())) continue;
          const g = (k) => (ci[k] != null && ci[k] >= 0 ? (row[ci[k]] || "").trim() : "");
          const name = g("name") || g("partNumber") || `Package ${r}`;
          made.push({
            id: nextId(), name, partNumber: g("partNumber") || "TBD", partName: g("partName") || name,
            customer: g("customer") || CUSTOMER_CO, supplier: user.company, revision: g("revision") || "A",
            level: Number(g("level")) || 3, status: "draft", submission: null, owner: user.name,
            elements: blankElements(), due: dueIn(30), activity: [evt(`Imported from CSV by ${user.name}`)],
          });
        }
        if (!made.length) { toast("No valid rows to import", "error"); return; }
        setProjects((ps) => [...made, ...ps]);
        toast(`Imported ${made.length} package${made.length === 1 ? "" : "s"}`);
      } catch (err) { toast("Could not read that CSV file", "error"); }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = "Name,Part Number,Part Name,Customer,Revision,Level\nFront Bracket,FB-1001-A,Front mounting bracket,Meridian Motors,A,3\nOil Cap,OC-2050-B,Oil filler cap,Meridian Motors,B,3\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ppap_import_template.csv"; document.body.appendChild(a); a.click(); a.remove();
  };

  const del = async (id) => {
    if (await confirmDialog({ title: "Delete PPAP package", body: "Are you sure you want to delete this PPAP package?", confirmLabel: "Delete", danger: true })) {
      setProjects((ps) => ps.filter((p) => p.id !== id));
      toast("Package deleted", "info");
    }
  };

  const submit = (p) => { updateProject(p.id, (pr) => withEvent({ ...pr, status: "submitted", submission: { status: "pending", comments: "" } }, "Submitted for approval")); toast("Submitted to customer"); notifyStatus(p, "submitted"); };
  const moveStatus = (id, status) => {
    const p = projects.find((x) => x.id === id);
    updateProject(id, (pr) => withEvent({
      ...pr, status,
      submission: status === "submitted" ? { status: "pending", comments: "" } : status === "approved" ? { ...(pr.submission || {}), status: "approved" } : status === "rejected" ? { ...(pr.submission || {}), status: "rejected" } : null,
    }, `Moved to ${STATUS_FLOW.find((s) => s.key === status)?.label || status}`));
    if (p && ["submitted", "approved", "rejected"].includes(status)) notifyStatus(p, status, { by: user.name });
  };

  const term = q.trim().toLowerCase();
  const shown = projects.filter((p) => {
    const matchQ = !term || [p.name, p.partNumber, p.partName, p.customer, p.owner].some((v) => (v || "").toLowerCase().includes(term));
    const matchF = filter === "all" || p.status === filter;
    return matchQ && matchF;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Packages</h1>
          <p className="mt-0.5 text-sm text-slate-500">{projects.length} package{projects.length === 1 ? "" : "s"} across {SUPPLIER_CO} and {CUSTOMER_CO}</p>
        </div>
        {canBuild && (
          <div className="flex items-center gap-2">
            <button onClick={downloadTemplate} title="Download CSV template" className="hidden items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50 sm:flex">
              <Download size={15} /> Template
            </button>
            <button onClick={() => csvRef.current?.click()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
              <Upload size={15} /> Import CSV
            </button>
            <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { importCSV(e.target.files[0]); e.target.value = ""; }} />
            <button onClick={() => setCreating(true)}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Plus size={16} /> New package
            </button>
          </div>
        )}
      </div>
      {creating && <CreateProject onCreate={create} onCancel={() => setCreating(false)} />}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, part number, customer, or owner"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="submitted">Awaiting Approval</option>
          <option value="rejected">Returned</option>
          <option value="approved">Approved</option>
        </select>
        <div className="flex rounded-lg border border-slate-300 p-0.5">
          <button onClick={() => setView("table")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${view === "table" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            <Table2 size={15} /> Table
          </button>
          <button onClick={() => setView("board")} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition ${view === "board" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
            <FolderKanban size={15} /> Board
          </button>
        </div>
      </div>

      {shown.length === 0 ? (
        projects.length === 0
          ? <EmptyState icon={FolderKanban} title="No packages yet" body="Create your first PPAP package to get started." />
          : <EmptyState icon={FolderKanban} title="No matches" body="No packages match your search or filter." />
      ) : view === "table" ? (
        <PackagesTable rows={shown} user={user} canBuild={canBuild} open={open} submit={submit} del={del} />
      ) : (
        <PipelineBoard rows={shown} user={user} open={open} moveStatus={moveStatus} />
      )}
    </div>
  );
}

function PackagesTable({ rows, user, canBuild, open, submit, del }) {
  const [menu, setMenu] = useState(null);
  const head = ["Package", "Part No.", "Rev", "Customer", "Status", "Complete", "Latest File", "Due", "Owner", "Updated", ""];
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const pr = progressOf(p);
            const f = latestFile(p);
            const lu = lastUpdated(p);
            const overdue = p.status !== "approved" && daysUntil(p.due) < 0;
            return (
              <tr key={p.id} className="border-b border-slate-100 transition hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <button onClick={() => open(p.id)} className="text-left font-medium text-slate-800 hover:text-blue-700">{p.name}</button>
                  <div className="text-xs text-slate-400">{p.partName}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-600">{p.partNumber}</td>
                <td className="px-3 py-2.5 text-slate-600">{p.revision}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{p.customer}</td>
                <td className="px-3 py-2.5"><StatusPill status={p.status} /></td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pr.pct}%` }} /></div>
                    <span className="font-mono text-xs text-slate-500">{pr.pct}%</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {f ? <span className="font-mono text-xs text-slate-600">{f.name}{f.version ? ` v${f.version}` : ""}</span> : <span className="text-xs text-slate-300">None</span>}
                </td>
                <td className={`whitespace-nowrap px-3 py-2.5 text-xs ${overdue ? "font-medium text-rose-600" : "text-slate-600"}`}>{p.due}{overdue ? " (overdue)" : ""}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{p.owner}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-slate-400">{lu || "-"}</td>
                <td className="relative px-3 py-2.5 text-right">
                  <button onClick={() => setMenu(menu === p.id ? null : p.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                    <MoreVertical size={16} />
                  </button>
                  {menu === p.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
                      <div className="absolute right-2 z-40 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl">
                        <RowAction label="View" onClick={() => { setMenu(null); open(p.id); }} />
                        {canBuild && <RowAction label="Edit" onClick={() => { setMenu(null); open(p.id); }} />}
                        {canBuild && p.status === "draft" && <RowAction label="Submit" onClick={() => { setMenu(null); submit(p); }} />}
                        <RowAction label="Export PDF" onClick={() => { setMenu(null); exportPackage(p); }} />
                        <RowAction label="Export Excel" onClick={() => { setMenu(null); exportCSV(p); }} />
                        {canBuild && <RowAction label="Delete" danger onClick={() => { setMenu(null); del(p.id); }} />}
                      </div>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
function RowAction({ label, onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-sm transition hover:bg-slate-50 ${danger ? "text-rose-600" : "text-slate-700"}`}>{label}</button>
  );
}

function PipelineBoard({ rows, user, open, moveStatus }) {
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const cols = STATUS_FLOW;

  const allowed = (status) => {
    if (isCustomer(user)) return status === "approved" || status === "rejected";
    return status === "draft" || status === "submitted"; // supplier can draft/submit
  };
  const onDrop = (status) => {
    setOver(null);
    const p = rows.find((r) => r.id === dragId);
    setDragId(null);
    if (!p || p.status === status) return;
    if (!allowed(status)) { toast(`You cannot move a package to ${STATUS_FLOW.find((s) => s.key === status)?.label}`, "error"); return; }
    moveStatus(p.id, status);
    toast(`Moved to ${STATUS_FLOW.find((s) => s.key === status)?.label}`);
  };

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {cols.map((col) => {
        const items = rows.filter((r) => r.status === col.key);
        return (
          <div key={col.key}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={() => onDrop(col.key)}
            className={`rounded-xl border bg-slate-50 p-2.5 transition ${over === col.key ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{col.label}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => {
                const pr = progressOf(p);
                const overdue = p.status !== "approved" && daysUntil(p.due) < 0;
                return (
                  <div key={p.id} draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => { setDragId(null); setOver(null); }}
                    onClick={() => open(p.id)}
                    className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-blue-300 hover:shadow active:cursor-grabbing">
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">{p.partNumber} · {p.customer}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${pr.pct}%` }} /></div>
                      <span className="font-mono text-[11px] text-slate-500">{pr.pct}%</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className={overdue ? "font-medium text-rose-600" : "text-slate-400"}>{overdue ? "Overdue" : `Due ${p.due}`}</span>
                      <span className="flex items-center gap-1 text-slate-500"><Avatar name={p.owner || "?"} role={isCustomer(user) ? "customer_member" : "supplier_member"} size={16} /> {(p.owner || "").split(" ")[0]}</span>
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-300">Empty</p>}
            </div>
          </div>
        );
      })}
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
          Create package
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
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Edit package details</h2>
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
  const lu = lastUpdated(project);
  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-300 hover:shadow">
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
          <span className="flex items-center gap-2">
            <span className="font-mono">{p.done}/{p.total} required · {project.owner || "Unassigned"}</span>
            {project.due && project.status !== "approved" && (() => {
              const d = daysUntil(project.due);
              const cls = d < 0 ? "bg-rose-100 text-rose-700" : d <= 3 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500";
              return <span className={`rounded px-1.5 py-0.5 ${cls}`}>{d < 0 ? `Overdue ${-d}d` : `Due in ${d}d`}</span>;
            })()}
          </span>
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
      <div className="pointer-events-none absolute right-3 top-3 z-20 hidden w-56 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl group-hover:block">
        <div className="mb-1 flex items-center justify-between"><span className="text-slate-400">Status</span><StatusPill status={project.status} /></div>
        <div className="flex items-center justify-between"><span className="text-slate-400">Completion</span><span className="font-medium text-slate-700">{p.pct}%</span></div>
        <div className="flex items-center justify-between"><span className="text-slate-400">Last updated</span><span className="text-slate-700">{lu || "-"}</span></div>
        <p className="mt-1.5 border-t border-slate-100 pt-1.5 text-center text-blue-600">Click to open</p>
      </div>
    </div>
  );
}

/* --------------------------- project view --------------------------- */
function ProjectView({ user, project, updateProject, openElement, back }) {
  const req = requiredFor(project.level);
  const p = progressOf(project);
  const allDone = p.done === p.total;
  const supplierLike = isSupplier(user);
  const customerLike = isCustomer(user);
  const locked = project.status === "submitted" || project.status === "approved";
  const [reviewNote, setReviewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const saveEdits = (form) => { updateProject(project.id, (pr) => withEvent({ ...pr, ...form }, "Package details updated")); setEditing(false); toast("Package details updated"); };

  const submit = () => { updateProject(project.id, (pr) => withEvent({ ...pr, status: "submitted", submission: { status: "pending", comments: "" } }, "Submitted to customer")); toast("Submitted to customer"); notifyStatus(project, "submitted"); };
  const decide = (status, sign) => { const signedBy = sign?.name || user.name; updateProject(project.id, (pr) => withEvent({ ...pr, status, submission: { ...(pr.submission || {}), status, comments: reviewNote, by: signedBy, signature: sign?.dataUrl, signedAt: sign?.date } }, status === "approved" ? `Approved by ${signedBy}` : `Returned for changes by ${signedBy}`)); toast(status === "approved" ? "Package approved" : "Returned to supplier", status === "approved" ? "success" : "info"); notifyStatus(project, status, { by: signedBy, comments: reviewNote }); };
  const approveWithSign = async () => { const s = await requestSignature({ title: "Sign to approve", subtitle: `Approve ${project.name} on behalf of ${project.customer}.`, confirmLabel: "Sign & approve", defaultName: user.name }); if (s) decide("approved", s); };
  const reopen = () => { updateProject(project.id, (pr) => withEvent({ ...pr, status: "draft" }, "Reopened for edits")); toast("Reopened for edits", "info"); };

  return (
    <div className="mx-auto max-w-5xl">
      <button onClick={back} className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> All packages
      </button>

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900">{project.name}</h1>
              {supplierLike && !locked && <button onClick={() => setEditing(true)} title="Edit details" className="text-slate-400 transition hover:text-blue-600"><Pencil size={15} /></button>}
              <StatusPill status={project.status} />
            </div>
            <p className="mt-0.5 text-sm text-slate-500">{project.partName}</p>
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
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Part Number" mono value={project.partNumber} />
          <Field label="Revision" value={project.revision} />
          <Field label="Supplier" value={project.supplier} />
          <Field label="Customer" value={project.customer} />
          <Field label="Owner" value={project.owner || "Unassigned"} />
          <Field label="Due Date" value={<span className={project.status !== "approved" && daysUntil(project.due) < 0 ? "font-medium text-rose-600" : ""}>{project.due || "Not set"}{project.status !== "approved" && daysUntil(project.due) < 0 ? " (overdue)" : ""}</span>} />
        </dl>
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
          const file = (state.data?.files || [])[0];
          const lastComment = state.comments && state.comments.length ? state.comments[state.comments.length - 1] : null;
          return (
            <div key={el.id} className="group relative">
              <button onClick={() => required && openElement(el.id)} disabled={!required}
                className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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
              {required && (
                <div className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-1 hidden rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl group-hover:block">
                  <p className="mb-1.5 text-slate-600">{el.desc}</p>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-1.5">
                    <span className="text-slate-400">Status</span>
                    <span className="font-medium capitalize text-slate-700">{state.status.replace("_", " ")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Latest file</span>
                    <span className="font-mono text-slate-700">{file ? `${file.name}${file.version ? ` v${file.version}` : ""}` : "None"}</span>
                  </div>
                  {file?.at && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Uploaded</span>
                      <span className="text-slate-700">{file.at}{file.by ? ` by ${file.by}` : ""}</span>
                    </div>
                  )}
                  {lastComment && (
                    <div className="mt-1.5 border-t border-slate-100 pt-1.5 text-slate-600">
                      <span className="text-slate-400">Latest comment: </span>{lastComment.text}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Build & submit (supplier / admin) */}
      {(project.status === "draft" || project.status === "rejected") && supplierLike && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm text-slate-600">
            {project.status === "rejected" ? (
              <span className="flex items-center gap-1.5 text-rose-600"><AlertTriangle size={15} /> Returned: “{project.submission?.comments}”</span>
            ) : allDone ? "All required elements complete. Ready to submit." :
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
                <button onClick={approveWithSign}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                  <PenLine size={16} /> Sign &amp; approve
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
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 size={15} /> Approved by {project.submission?.by || project.customer}. {project.submission?.comments}</span>
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
  const steps = ["Draft", "Awaiting Approval", "Approved"];
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
      {status === "submitted" && <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700"><Lock size={12} /> Locked for customer approval. The supplier cannot proceed until the customer approves.</p>}
      {status === "rejected" && <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-700"><AlertTriangle size={12} /> Returned to the supplier for changes.</p>}
    </div>
  );
}

/* --------------------------- element editor --------------------------- */
function ElementFiles({ user, files, owner, canEdit, onAdd, onAssign }) {
  const [hist, setHist] = useState(false);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = React.useRef(null);
  const replaceRef = React.useRef(null);
  const sorted = [...files].sort((a, b) => (b.version || 1) - (a.version || 1));
  const latest = sorted[0];
  const supplierUsers = USERS.filter((u) => u.company === SUPPLIER_CO);

  const ingest = (file, asName) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast("File is larger than 8 MB; please use a smaller file in the demo", "error"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      onAdd({ name: asName || file.name, size: file.size, type: file.type, dataUrl: reader.result });
      toast(`Uploaded ${asName || file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const download = (f) => {
    if (!f.dataUrl) { toast("This is seeded sample metadata; upload a real file to download it", "info"); return; }
    const a = document.createElement("a"); a.href = f.dataUrl; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
  };
  const canPreview = (f) => f.dataUrl && (f.type === "application/pdf" || (f.type || "").startsWith("image/"));

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><FileText size={15} className="text-slate-400" /> Files</h3>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          Owner
          <select value={owner || ""} disabled={!canEdit} onChange={(e) => onAssign(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-50">
            <option value="">Unassigned</option>
            {supplierUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
          </select>
        </label>
      </div>

      {latest ? (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-blue-50 text-blue-600"><FileText size={16} /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{latest.name}</p>
              <p className="text-xs text-slate-400">v{latest.version || 1} · {latest.at || "-"}{latest.by ? ` · ${latest.by}` : ""}{latest.size ? ` · ${(latest.size / 1024).toFixed(0)} KB` : ""}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canPreview(latest) && <button onClick={() => setPreview(latest)} className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">View</button>}
            <button onClick={() => download(latest)} title="Download" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Download size={15} /></button>
            <button onClick={() => setHist(true)} className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100">History ({files.length})</button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">No file uploaded yet.</p>
      )}

      {canEdit && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); ingest(e.dataTransfer.files[0]); }}
          className={`mt-3 flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition ${drag ? "border-blue-400 bg-blue-50" : "border-slate-200"}`}>
          <Upload size={18} className="mb-1 text-slate-400" />
          <p className="text-xs text-slate-500">Drag a PDF or image here, or</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => inputRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Upload size={14} /> Upload</button>
            {latest && <button onClick={() => replaceRef.current?.click()} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><RotateCcw size={14} /> Replace latest</button>}
          </div>
          <input ref={inputRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { ingest(e.target.files[0]); e.target.value = ""; }} />
          <input ref={replaceRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { ingest(e.target.files[0], latest?.name); e.target.value = ""; }} />
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-400">Uploaded files stay in your browser for this session. Seeded sample files show metadata only.</p>

      {hist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setHist(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Version history</h3>
              <button onClick={() => setHist(false)} className="text-slate-400 hover:text-slate-700"><XCircle size={20} /></button>
            </div>
            <ul className="space-y-2">
              {sorted.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <span className="min-w-0"><span className="font-medium text-slate-800">v{f.version || 1}</span> <span className="font-mono text-xs text-slate-500">{f.name}</span></span>
                  <span className="flex items-center gap-2 text-xs text-slate-400">
                    {f.at || "-"}{f.by ? ` · ${f.by}` : ""}
                    {canPreview(f) && <button onClick={() => { setHist(false); setPreview(f); }} className="text-blue-600 hover:underline">view</button>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4" onClick={() => setPreview(null)}>
          <div className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5">
              <span className="truncate text-sm font-medium text-slate-800">{preview.name} <span className="font-normal text-slate-400">v{preview.version || 1}</span></span>
              <div className="flex items-center gap-1">
                <button onClick={() => download(preview)} title="Download" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Download size={16} /></button>
                <button onClick={() => setPreview(null)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><XCircle size={18} /></button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100">
              {preview.type === "application/pdf"
                ? <iframe title={preview.name} src={preview.dataUrl} className="h-full w-full" />
                : <div className="flex h-full items-center justify-center p-4"><img src={preview.dataUrl} alt={preview.name} className="max-h-full max-w-full object-contain" /></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ElementEditor({ user, project, updateProject, elementId, back }) {
  const el = ELEMENTS.find((e) => e.id === elementId);
  const state = project.elements[elementId];
  const isCEA = el.id === "customer_engineering_approval";
  const supplierLike = isSupplier(user);
  const customerLike = isCustomer(user);
  const projectLocked = project.status === "submitted" || project.status === "approved";
  const fieldsReadOnly = !(supplierLike && !projectLocked); // only the supplier org edits fields, and only before submission

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
  const roleDot = (role) => roleOrg(role) === "customer" ? "bg-emerald-500" : "bg-blue-500";

  const files = state.data?.files || [];
  const nextVersion = () => (files.length ? Math.max(...files.map((f) => f.version || 1)) + 1 : 1);
  const setFiles = (next) => setData({ ...state.data, files: next });
  const addFile = (meta) => setFiles([...files, { version: nextVersion(), at: new Date().toISOString().slice(0, 10), by: user.name, ...meta }]);
  const assignOwner = (name) => setData({ ...state.data, owner: name });

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
        {el.kind === "fmea" && <FmeaEditor project={project} data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "dimensional" && <DimensionalEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "psw" && <PswEditor project={project} data={state.data} setData={setData} readOnly={fieldsReadOnly} user={user} />}
        {el.kind === "flow" && <ProcessFlowEditor project={project} data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "controlplan" && <ControlPlanEditor project={project} data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "msa" && <MsaEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "capability" && <CapabilityEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "material" && <MaterialEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "csr" && <CsrEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
        {el.kind === "upload" && <UploadEditor data={state.data} setData={setData} readOnly={fieldsReadOnly} />}
      </div>

      <ElementFiles user={user} files={files} owner={state.data?.owner} canEdit={!fieldsReadOnly}
        onAdd={addFile} onAssign={assignOwner} />

      {isCEA ? (
        <div className="mt-4">
          {state.status === "completed" ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <span className="flex items-center gap-1.5"><CheckCircle2 size={16} /> Customer engineering approval granted.</span>
              {customerLike && <button onClick={() => setStatus("in_progress")} className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100">Withdraw</button>}
            </div>
          ) : customerLike ? (
            <div className="flex justify-end">
              <button onClick={() => { setStatus("completed"); toast("Engineering approval granted"); }}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                <ShieldCheck size={16} /> Approve engineering sign-off
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Clock size={15} /> Awaiting customer engineering sign-off. A Customer user can approve it.
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
                <p className="text-xs text-slate-500"><span className="font-medium text-slate-700">{c.by}</span> <span>· {roleLabel(c.role)}</span> · {c.t}</p>
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
function processSteps(project) {
  return project?.elements?.process_flow_diagram?.data?.steps || [];
}
function FmeaEditor({ project, data, setData, readOnly }) {
  const rows = data.rows || [];
  const steps = processSteps(project);
  const update = (id, key, val) => setData({ ...data, rows: rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)) });
  const addRow = () => setData({ ...data, rows: [...rows, { id: Date.now(), item: "", fn: "", mode: "", effect: "", sev: 5, cause: "", occ: 5, ctrl: "", det: 5, stepId: "" }] });
  const removeRow = (id) => setData({ ...data, rows: rows.filter((r) => r.id !== id) });
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-500">
        <Gauge size={16} className="text-blue-500" />
        Risk Priority Number recalculates live as you change Severity, Occurrence, and Detection.
      </div>
      {steps.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <Workflow size={13} /> Linked to the Process Flow Diagram. Tie each failure mode to the process step where it occurs.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-2 py-2">Item / Function</th>
              {steps.length > 0 && <th className="px-2 py-2">Process step</th>}
              <th className="px-2 py-2">Failure mode</th><th className="px-2 py-2">Effect</th>
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
                  {steps.length > 0 && (
                    <td className="px-2 py-2">
                      <select value={r.stepId || ""} onChange={(e) => update(r.id, "stepId", e.target.value)} disabled={readOnly}
                        className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-50">
                        <option value="">Unlinked</option>
                        {steps.map((s, i) => <option key={s.id} value={s.id}>{String(i + 1).padStart(2, "0")} {s.name || "Step"}</option>)}
                      </select>
                    </td>
                  )}
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
            {rows.length === 0 && <tr><td colSpan={steps.length > 0 ? 9 : 8} className="px-2 py-6 text-center text-sm text-slate-400">No failure modes yet.</td></tr>}
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
                    {v === null ? <span className="text-xs text-slate-300">-</span> :
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

function PswEditor({ project, data, setData, readOnly, user }) {
  const field = (label, value) => (
    <div><p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p><p className="font-mono text-sm text-slate-800">{value || "-"}</p></div>
  );
  const sub = project.submission;
  const signWarrant = async () => {
    const s = await requestSignature({ title: "Sign Part Submission Warrant", subtitle: "Affirm the declaration below on behalf of the supplier.", confirmLabel: "Sign warrant", defaultName: user?.name });
    if (s) setData({ ...data, supplierSign: s, declared: true });
  };
  const SigBlock = ({ label, sign, statusText, tone }) => (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      {sign ? (
        <>
          {sign.dataUrl ? <img src={sign.dataUrl} alt="signature" className="h-12 w-auto" /> : <p className="font-[cursive] text-lg text-slate-800">{sign.name}</p>}
          <p className="mt-1 text-xs text-slate-600">{sign.name} · {sign.date}</p>
        </>
      ) : (
        <p className={`py-3 text-sm ${tone || "text-slate-400"}`}>{statusText || "Not signed"}</p>
      )}
    </div>
  );
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm text-slate-500"><FileText size={16} className="text-blue-500" /> Part Submission Warrant (PSW) - the formal declaration that the submitted parts meet all requirements.</div>
      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
        {field("Part number", project.partNumber)}{field("Part name", project.partName)}{field("Revision", project.revision)}
        {field("Supplier", project.supplier)}{field("Customer", project.customer)}{field("Submission level", project.level)}
      </div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Reason for submission</label>
      <select disabled={readOnly} value={data.reason || ""} onChange={(e) => setData({ ...data, reason: e.target.value })}
        className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50">
        <option value="">Select a reason</option><option>Initial submission</option><option>Engineering change</option>
        <option>Tooling transfer / change</option><option>Correction of discrepancy</option>
      </select>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" disabled={readOnly} checked={!!data.declared} onChange={(e) => setData({ ...data, declared: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
        I affirm the samples represent parts made from production tooling and processes, and that results meet all drawing and specification requirements.
      </label>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div>
          <SigBlock label="Supplier authorized signature" sign={data.supplierSign} />
          {!readOnly && (
            <button onClick={signWarrant} className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              <PenLine size={15} /> {data.supplierSign ? "Re-sign warrant" : "Sign warrant"}
            </button>
          )}
        </div>
        <SigBlock label="Customer disposition"
          sign={sub?.status === "approved" ? { name: sub.by || project.customer, date: sub.signedAt || sub.date || "", dataUrl: sub.signature } : null}
          statusText={sub?.status === "rejected" ? `Returned for changes${sub.by ? " by " + sub.by : ""}` : "Pending customer review"}
          tone={sub?.status === "rejected" ? "text-rose-600" : "text-amber-600"} />
      </div>
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
          <span className="text-xs text-slate-400">PDF, DXF, XLSX, JPG - recorded for this demo</span>
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

function ProcessFlowEditor({ project, data, setData, readOnly }) {
  const steps = data.steps || [];
  const fmeaRows = [...(project?.elements?.process_fmea?.data?.rows || []), ...(project?.elements?.design_fmea?.data?.rows || [])];
  const ctrlRows = project?.elements?.control_plan?.data?.rows || [];
  const linkCounts = (id) => ({ fmea: fmeaRows.filter((r) => r.stepId === id).length, ctrl: ctrlRows.filter((r) => r.stepId === id).length });
  const update = (id, key, val) => setData({ ...data, steps: steps.map((s) => (s.id === id ? { ...s, [key]: val } : s)) });
  const add = () => setData({ ...data, steps: [...steps, { id: Date.now(), name: "", type: "Operation", desc: "" }] });
  const remove = (id) => setData({ ...data, steps: steps.filter((s) => s.id !== id) });
  const move = (i, dir) => {
    const j = i + dir; if (j < 0 || j >= steps.length) return;
    const next = [...steps]; [next[i], next[j]] = [next[j], next[i]]; setData({ ...data, steps: next });
  };
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">Ordered manufacturing sequence. Each step is typed, and shows how many FMEA failure modes and control-plan items reference it.</p>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const lc = linkCounts(s.id);
          return (
            <div key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5">
              <span className="mt-1 font-mono text-xs text-slate-400">{String(i + 1).padStart(2, "0")}</span>
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <CellInput value={s.name} onChange={(e) => update(s.id, "name", e.target.value)} disabled={readOnly} placeholder="Step name" w="w-48" />
                  <select value={s.type} onChange={(e) => update(s.id, "type", e.target.value)} disabled={readOnly}
                    className="rounded border border-slate-200 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50">
                    {["Operation", "Inspection", "Transport", "Storage", "Delay"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${lc.fmea ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"}`}>FMEA {lc.fmea}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] ${lc.ctrl ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-400"}`}>Controls {lc.ctrl}</span>
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
          );
        })}
        {steps.length === 0 && <p className="text-center text-sm text-slate-400">No process steps yet.</p>}
      </div>
      {!readOnly && <button onClick={add} className="mt-3 flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"><Plus size={15} /> Add step</button>}
    </div>
  );
}

function ControlPlanEditor({ project, data, setData, readOnly }) {
  const rows = data.rows || [];
  const steps = processSteps(project);
  const update = (id, key, val) => setData({ ...data, rows: rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)) });
  const add = () => setData({ ...data, rows: [...rows, { id: Date.now(), characteristic: "", spec: "", method: "", freq: "", reaction: "", stepId: "" }] });
  const remove = (id) => setData({ ...data, rows: rows.filter((r) => r.id !== id) });
  const covered = new Set(rows.map((r) => r.stepId).filter(Boolean));
  const uncovered = steps.filter((s) => !covered.has(s.id));
  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">How each characteristic is controlled, measured, and what happens when it's out of spec.</p>
      {steps.length > 0 && (
        <div className={`mb-3 flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs ${uncovered.length ? "border-amber-200 bg-amber-50 text-amber-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          <Workflow size={13} />
          {uncovered.length
            ? `Controls cover ${covered.size} of ${steps.length} process steps. Not yet controlled: ${uncovered.map((s) => s.name || "Step").join(", ")}.`
            : `All ${steps.length} process steps have at least one control.`}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              {steps.length > 0 && <th className="px-2 py-2">Process step</th>}
              <th className="px-2 py-2">Characteristic</th><th className="px-2 py-2">Specification</th><th className="px-2 py-2">Method</th>
              <th className="px-2 py-2">Frequency</th><th className="px-2 py-2">Reaction plan</th>{!readOnly && <th />}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100">
                {steps.length > 0 && (
                  <td className="px-2 py-2">
                    <select value={r.stepId || ""} onChange={(e) => update(r.id, "stepId", e.target.value)} disabled={readOnly}
                      className="rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-slate-50">
                      <option value="">Unlinked</option>
                      {steps.map((s, i) => <option key={s.id} value={s.id}>{String(i + 1).padStart(2, "0")} {s.name || "Step"}</option>)}
                    </select>
                  </td>
                )}
                <td className="px-2 py-2"><CellInput value={r.characteristic} onChange={(e) => update(r.id, "characteristic", e.target.value)} disabled={readOnly} placeholder="e.g. Bore Ø" w="w-32" /></td>
                <td className="px-2 py-2"><CellInput value={r.spec} onChange={(e) => update(r.id, "spec", e.target.value)} disabled={readOnly} placeholder="12.0 ±0.02" w="w-28" /></td>
                <td className="px-2 py-2"><CellInput value={r.method} onChange={(e) => update(r.id, "method", e.target.value)} disabled={readOnly} placeholder="CMM / gauge" w="w-28" /></td>
                <td className="px-2 py-2"><CellInput value={r.freq} onChange={(e) => update(r.id, "freq", e.target.value)} disabled={readOnly} placeholder="5/shift" w="w-24" /></td>
                <td className="px-2 py-2"><CellInput value={r.reaction} onChange={(e) => update(r.id, "reaction", e.target.value)} disabled={readOnly} placeholder="Quarantine + notify" w="w-40" /></td>
                {!readOnly && <td className="px-2 py-2 text-center"><button onClick={() => remove(r.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={15} /></button></td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={steps.length > 0 ? 7 : 6} className="px-2 py-6 text-center text-sm text-slate-400">No control items yet.</td></tr>}
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
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Gauge size={16} className="text-blue-500" /> Gage R&R from variation estimates - %GRR and distinct categories compute automatically.</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Inp k="ev" label="Repeatability (EV)" hint="equipment σ" />
        <Inp k="av" label="Reproducibility (AV)" hint="appraiser σ" />
        <Inp k="pv" label="Part variation (PV)" hint="part σ" />
        <Inp k="tol" label="Tolerance (opt.)" hint="USL − LSL" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="GRR" value={grr != null ? grr.toFixed(3) : "-"} />
        <Metric label="% GRR (of TV)" value={pctTV != null ? pctTV.toFixed(1) + "%" : "-"} />
        <Metric label="% GRR (of tol.)" value={pctTol != null ? pctTol.toFixed(1) + "%" : "-"} />
        <Metric label="Distinct categories" value={ndc != null ? ndc : "-"} />
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
  const readingsText = Array.isArray(data.readings) ? data.readings.join(", ") : (data.readings || "");
  const st = spcStats(data);
  const verdict = !st ? null : st.cpk >= 1.67 ? ["Excellent", "text-emerald-700 bg-emerald-100"] : st.cpk >= 1.33 ? ["Capable", "text-emerald-700 bg-emerald-100"] : st.cpk >= 1.0 ? ["Marginal", "text-amber-700 bg-amber-100"] : ["Not capable", "text-rose-700 bg-rose-100"];

  // control chart series
  const lsl = parseFloat(data.lsl), usl = parseFloat(data.usl), target = parseFloat(data.target);
  const chart = st && st.xs.length ? st.xs.map((v, i) => ({ i: i + 1, v })) : [];
  const outOfCtrl = st ? st.xs.filter((v) => v > st.ucl || v < st.lcl).length : 0;

  // histogram bins
  let bins = [];
  let lslLabel = null, uslLabel = null;
  if (st && st.xs.length) {
    const lo = Math.min(st.lcl, lsl, ...st.xs), hi = Math.max(st.ucl, usl, ...st.xs);
    const k = 9, w = (hi - lo) / k || 1;
    bins = Array.from({ length: k }, (_, b) => ({ x: lo + w * (b + 0.5), label: (lo + w * (b + 0.5)).toFixed(3), count: 0 }));
    st.xs.forEach((v) => { let idx = Math.floor((v - lo) / w); if (idx >= k) idx = k - 1; if (idx < 0) idx = 0; bins[idx].count++; });
    const nearest = (target) => bins.reduce((best, b) => (Math.abs(b.x - target) < Math.abs(bins[best].x - target) ? bins.indexOf(b) : best), 0);
    if (!isNaN(lsl)) lslLabel = bins[nearest(lsl)].label;
    if (!isNaN(usl)) uslLabel = bins[nearest(usl)].label;
  }

  const Inp = ({ k, label, ph }) => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <NumCell value={data[k] || ""} onChange={set(k)} disabled={readOnly} w="w-full" placeholder={ph} />
    </label>
  );

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-slate-500"><Gauge size={16} className="text-blue-500" /> Initial process study. Enter the spec limits and individual measurements; Cpk, control limits, and the charts update automatically.</div>
      <div className="grid grid-cols-3 gap-3">
        <Inp k="lsl" label="Lower spec (LSL)" ph="11.98" />
        <Inp k="target" label="Target" ph="12.00" />
        <Inp k="usl" label="Upper spec (USL)" ph="12.02" />
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Measurements (comma or space separated)</span>
        <textarea value={readingsText} onChange={set("readings")} disabled={readOnly} rows={2}
          placeholder="12.004 12.007 12.002 ..."
          className="w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50" />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="n" value={st ? st.n || st.xs.length || "-" : "-"} />
        <Metric label="Cp" value={st ? st.cp.toFixed(2) : "-"} />
        <Metric label="Cpk" value={st ? st.cpk.toFixed(2) : "-"} />
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Verdict</p>
          {verdict ? <span className={`mt-1 inline-block rounded px-2 py-1 text-sm font-semibold ${verdict[1]}`}>{verdict[0]}</span> : <p className="text-slate-300">-</p>}
        </div>
      </div>

      {st && chart.length > 0 && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-1 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-700">Individuals control chart</h4>
              <span className={`text-xs ${outOfCtrl ? "text-rose-600" : "text-emerald-600"}`}>{outOfCtrl ? `${outOfCtrl} out of control` : "In control"}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="i" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip formatter={(v) => v.toFixed ? v.toFixed(4) : v} />
                <ReferenceLine y={st.ucl} stroke="#ef4444" strokeDasharray="4 3" label={{ value: "UCL", position: "right", fontSize: 10, fill: "#ef4444" }} />
                <ReferenceLine y={st.mean} stroke="#2563eb" strokeDasharray="4 3" label={{ value: "x̄", position: "right", fontSize: 10, fill: "#2563eb" }} />
                <ReferenceLine y={st.lcl} stroke="#ef4444" strokeDasharray="4 3" label={{ value: "LCL", position: "right", fontSize: 10, fill: "#ef4444" }} />
                <Line type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2}
                  dot={(p) => { const oo = p.payload.v > st.ucl || p.payload.v < st.lcl; return <circle key={p.key ?? `${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r={3.5} fill={oo ? "#ef4444" : "#2563eb"} stroke="#fff" strokeWidth={1} />; }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="mb-1 text-sm font-semibold text-slate-700">Distribution vs. spec</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bins} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip />
                {lslLabel && <ReferenceLine x={lslLabel} stroke="#ef4444" label={{ value: "LSL", position: "top", fontSize: 10, fill: "#ef4444" }} />}
                {uslLabel && <ReferenceLine x={uslLabel} stroke="#ef4444" label={{ value: "USL", position: "top", fontSize: 10, fill: "#ef4444" }} />}
                <Bar dataKey="count" fill="#93c5fd" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">Control limits use the moving-range estimate of sigma (MR-bar / 1.128). Cpk ≥ 1.33 is the common automotive threshold for a capable process.</p>
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
  doc.text("Production Part Approval Process - demo export", left, y + 6);
  doc.setTextColor(0);
  y += 18;

  const row = (label, value) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(label, left, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value ?? "-"), left + 55, y);
    y += 7;
  };
  row("Part name:", project.partName);
  row("Part number:", project.partNumber);
  row("Revision:", project.revision);
  row("Supplier:", project.supplier);
  row("Customer:", project.customer);
  row("Submission level:", project.level);
  row("Status:", project.status);
  const pswData = project.elements?.part_submission_warrant?.data || {};
  row("Reason for submission:", pswData.reason || "-");

  y += 4;
  doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(90);
  const decl = doc.splitTextToSize("Declaration: the samples represent parts made from production tooling and processes, and results meet all drawing and specification requirements.", 178);
  doc.text(decl, left, y); y += decl.length * 4 + 2;
  doc.setTextColor(0);

  y += 4;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("Element completion", left, y); y += 7;
  doc.setFontSize(9);
  const req = requiredFor(project.level);
  ELEMENTS.forEach((el) => {
    if (!req.has(el.id)) return;
    const st = project.elements[el.id].status.replace("_", " ");
    doc.setFont("helvetica", "normal");
    if (y > 250) { doc.addPage(); y = 20; }
    doc.text(`${String(el.n).padStart(2, "0")}. ${el.name}`, left, y);
    doc.text(st, left + 120, y);
    y += 6;
  });

  // signatures
  if (y > 235) { doc.addPage(); y = 20; }
  y += 8;
  doc.setDrawColor(200); doc.line(left, y, left + 178, y); y += 8;
  const sup = pswData.supplierSign;
  const sub = project.submission;
  const sigCol = (x, label, name, date, img) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text(label, x, y);
    if (img) { try { doc.addImage(img, "PNG", x, y + 3, 50, 16); } catch (e) {} }
    else if (name) { doc.setFont("helvetica", "italic"); doc.setFontSize(13); doc.text(name, x, y + 14); }
    doc.setDrawColor(150); doc.line(x, y + 22, x + 70, y + 22);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(90);
    doc.text(`${name || "Not signed"}${date ? "   " + date : ""}`, x, y + 27);
    doc.setTextColor(0);
  };
  sigCol(left, "Supplier authorized signature", sup?.name, sup?.date, sup?.dataUrl);
  if (sub?.status === "approved") sigCol(left + 96, "Customer approval signature", sub.by, sub.signedAt || sub.date, sub.signature);
  else sigCol(left + 96, "Customer disposition", sub?.status === "rejected" ? "Returned for changes" : "Pending review", "", null);

  doc.save(`PSW_${project.partNumber || "part"}.pdf`);
  toast("PSW exported as PDF");
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
  if (kind === "capability") {
    const st = spcStats(data);
    if (st) return `Cpk ${st.cpk.toFixed(2)}`;
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
  toast("Package exported as PDF");
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
  toast("Exported to CSV");
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
function NumCell({ value, onChange, disabled, w = "w-20", placeholder }) {
  return (
    <input value={value} onChange={onChange} disabled={disabled} inputMode="decimal" placeholder={placeholder}
      className={`${w} rounded border border-slate-200 px-2 py-1 text-center font-mono text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-50`} />
  );
}

/* ----------------------------- bits ----------------------------- */
function SignaturePad({ onChange }) {
  const ref = React.useRef(null);
  const drawing = React.useRef(false);
  const last = React.useRef(null);
  const pt = (e) => {
    const c = ref.current, r = c.getBoundingClientRect();
    const t = e.touches && e.touches[0];
    const cx = t ? t.clientX : e.clientX, cy = t ? t.clientY : e.clientY;
    return { x: (cx - r.left) * (c.width / r.width), y: (cy - r.top) * (c.height / r.height) };
  };
  const down = (e) => { drawing.current = true; last.current = pt(e); };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const c = ref.current, ctx = c.getContext("2d"), p = pt(e);
    ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 2; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { if (!drawing.current) return; drawing.current = false; onChange(ref.current.toDataURL("image/png")); };
  const clear = () => { const c = ref.current; c.getContext("2d").clearRect(0, 0, c.width, c.height); onChange(null); };
  return (
    <div>
      <canvas ref={ref} width={460} height={120}
        onMouseDown={down} onMouseMove={moveDraw} onMouseUp={up} onMouseLeave={up}
        onTouchStart={down} onTouchMove={moveDraw} onTouchEnd={up}
        className="w-full cursor-crosshair touch-none rounded-lg border border-slate-300 bg-slate-50" />
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>Draw your signature above</span>
        <button onClick={clear} className="hover:text-slate-700">Clear</button>
      </div>
    </div>
  );
}

let signResolver = null;
let signListener = null;
function requestSignature(opts) {
  return new Promise((resolve) => { signResolver = resolve; if (signListener) signListener(opts || {}); });
}
function SignHost() {
  const [cfg, setCfg] = useState(null);
  const [name, setName] = useState("");
  const [sig, setSig] = useState(null);
  useEffect(() => { signListener = (opts) => { setCfg(opts); setName(opts.defaultName || ""); setSig(null); }; return () => { signListener = null; }; }, []);
  if (!cfg) return null;
  const close = (result) => { setCfg(null); if (signResolver) { signResolver(result); signResolver = null; } };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => close(null)}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-900">{cfg.title || "Sign"}</h3>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">{cfg.subtitle || "Type your name and draw your signature to authorize."}</p>
        <label className="mb-1 block text-xs font-medium text-slate-600">Signed by</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name"
          className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <SignaturePad onChange={setSig} />
        <div className="mt-4 flex gap-2">
          <button onClick={() => name.trim() && close({ name: name.trim(), dataUrl: sig, date: new Date().toISOString().slice(0, 10) })}
            disabled={!name.trim()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">
            <PenLine size={15} /> {cfg.confirmLabel || "Sign"}
          </button>
          <button onClick={() => close(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, value, mono }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
function Stat({ label, value, accent, icon: Icon }) {
  const color = accent === "amber" ? "text-amber-600" : accent === "emerald" ? "text-emerald-600" : accent === "blue" ? "text-blue-600" : "text-slate-900";
  const iconBg = accent === "amber" ? "bg-amber-50 text-amber-500" : accent === "emerald" ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-2xl font-semibold ${color}`}>{value}</p>
          <p className="mt-0.5 text-xs text-slate-500">{label}</p>
        </div>
        {Icon && <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}><Icon size={16} /></span>}
      </div>
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
    submitted: ["Awaiting Approval", "bg-amber-100 text-amber-700"],
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
