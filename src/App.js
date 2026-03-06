import { useState, useCallback, useEffect } from "react";

/* ─────────────────────────────────────────────
   GOOGLE SHEETS HELPER
───────────────────────────────────────────── */
async function sheetsGet(cfg, range) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${cfg.sheetId}/values/${encodeURIComponent(range)}?key=${cfg.apiKey}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Sheets error ${r.status}`);
  return (await r.json()).values || [];
}

/* ─────────────────────────────────────────────
   CONFIG / DATA
───────────────────────────────────────────── */
const STATUS_CFG = {
  "Not Started": { bg:"#F1F5F9", text:"#64748B", dot:"#94A3B8" },
  "In Progress": { bg:"#EFF6FF", text:"#2563EB", dot:"#3B82F6" },
  "Completed":   { bg:"#F0FDF4", text:"#16A34A", dot:"#22C55E" },
  "On Hold":     { bg:"#FFF7ED", text:"#C2410C", dot:"#F97316" },
  "Delayed":     { bg:"#FFF1F2", text:"#BE123C", dot:"#F43F5E" },
  "Pending":     { bg:"#FAF5FF", text:"#7C3AED", dot:"#8B5CF6" },
  "Cancelled":   { bg:"#F8FAFC", text:"#94A3B8", dot:"#CBD5E1" },
};
const PRI_COLOR = { "Very High":"#EF4444","High":"#F97316","Medium":"#F59E0B","Low":"#10B981","Very Low":"#3B82F6" };
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const DEMO_PROJECTS = [
  { id:"P01", name:"Website Redesign",  start:"2026-02-01", end:"2026-04-30", lead:"Alex", client:"Acme Corp",   status:"In Progress" },
  { id:"P02", name:"Mobile App Launch", start:"2026-03-01", end:"2026-06-30", lead:"Alex", client:"TechStart",   status:"In Progress" },
  { id:"P03", name:"Brand Identity",    start:"2026-01-15", end:"2026-03-31", lead:"Alex", client:"NewBrand Co", status:"On Hold"     },
];
const DEMO_TASKS = [
  { id:1,  project:"Website Redesign",  phase:"Phase 1", taskName:"Wireframe homepage",       assignedTo:"Alex", status:"Completed",  kanbanStage:"Done",        priority:"High",      important:true,  urgent:true,  startDate:"2026-02-01", dueDate:"2026-02-10", progress:100, notes:"Approved by client" },
  { id:2,  project:"Website Redesign",  phase:"Phase 2", taskName:"Design system setup",      assignedTo:"Alex", status:"In Progress",kanbanStage:"In Progress", priority:"High",      important:true,  urgent:false, startDate:"2026-02-11", dueDate:"2026-03-10", progress:60,  notes:"" },
  { id:3,  project:"Website Redesign",  phase:"Phase 2", taskName:"Homepage development",     assignedTo:"Alex", status:"Not Started",kanbanStage:"Backlog",     priority:"Medium",    important:true,  urgent:false, startDate:"2026-03-11", dueDate:"2026-04-05", progress:0,   notes:"" },
  { id:4,  project:"Mobile App Launch", phase:"Phase 1", taskName:"Requirements gathering",   assignedTo:"Alex", status:"Completed",  kanbanStage:"Done",        priority:"Very High", important:true,  urgent:true,  startDate:"2026-03-01", dueDate:"2026-03-07", progress:100, notes:"Sign-off received" },
  { id:5,  project:"Mobile App Launch", phase:"Phase 1", taskName:"UI prototyping",           assignedTo:"Alex", status:"In Progress",kanbanStage:"In Progress", priority:"High",      important:true,  urgent:true,  startDate:"2026-03-08", dueDate:"2026-03-20", progress:40,  notes:"Review scheduled" },
  { id:6,  project:"Mobile App Launch", phase:"Phase 2", taskName:"Backend API design",       assignedTo:"Alex", status:"Not Started",kanbanStage:"Backlog",     priority:"High",      important:true,  urgent:false, startDate:"2026-03-21", dueDate:"2026-04-15", progress:0,   notes:"" },
  { id:7,  project:"Brand Identity",    phase:"Phase 1", taskName:"Logo concepts",            assignedTo:"Alex", status:"On Hold",    kanbanStage:"Ideas",       priority:"Medium",    important:false, urgent:false, startDate:"2026-01-15", dueDate:"2026-03-15", progress:30,  notes:"Waiting for brief" },
  { id:8,  project:"Website Redesign",  phase:"Phase 3", taskName:"SEO audit",                assignedTo:"Alex", status:"Pending",    kanbanStage:"Backlog",     priority:"Low",       important:false, urgent:false, startDate:"2026-04-01", dueDate:"2026-04-20", progress:0,   notes:"" },
];

/* ─────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */
const fmt = d => d ? new Date(d+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}) : "";
const isOD = (d,s) => d && s!=="Completed" && s!=="Cancelled" && new Date(d+"T00:00:00")<new Date(new Date().toDateString());
const dLeft = d => d ? Math.round((new Date(d+"T00:00:00")-new Date(new Date().toDateString()))/864e5) : null;

/* ─────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:        #F4F4F0;
  --card:      #FFFFFF;
  --border:    #E4E4DF;
  --line:      #EFEFEB;
  --text:      #18181B;
  --sub:       #71717A;
  --muted:     #A1A1AA;
  --accent:    #18181B;
  --blue:      #2563EB;
  --blue-bg:   #EFF6FF;
  --green:     #16A34A;
  --red:       #DC2626;
  --orange:    #EA580C;
  --r:         12px;
  --r-sm:      8px;
  --shadow:    0 1px 2px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.04);
  --shadow-md: 0 4px 24px rgba(0,0,0,.09);
  --shadow-lg: 0 12px 48px rgba(0,0,0,.14);
  --font:      'Plus Jakarta Sans', sans-serif;
}

html, body { height: 100%; }
body { font-family: var(--font); background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.55; -webkit-font-smoothing: antialiased; }

/* ── LAYOUT ── */
.shell { display: flex; min-height: 100vh; }

/* ── SIDEBAR (desktop) ── */
.sidebar {
  width: 232px; flex-shrink: 0;
  background: var(--card); border-right: 1px solid var(--border);
  padding: 0; display: flex; flex-direction: column;
  position: fixed; top: 0; left: 0; bottom: 0; z-index: 300;
  overflow-y: auto; overflow-x: hidden;
}
.sidebar-inner { display: flex; flex-direction: column; height: 100%; padding: 20px 14px 24px; gap: 2px; }
.logo {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 8px 22px; font-weight: 800; font-size: 15px;
  letter-spacing: -.4px; color: var(--text);
  border-bottom: 1px solid var(--line); margin-bottom: 10px;
}
.logo-mark {
  width: 28px; height: 28px; border-radius: 8px;
  background: var(--text); display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.logo-mark svg { width: 14px; height: 14px; fill: white; }
.nav-label {
  font-size: 10px; font-weight: 700; letter-spacing: .08em;
  text-transform: uppercase; color: var(--muted);
  padding: 14px 8px 5px;
}
.nav-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 9px 10px; border-radius: var(--r-sm); border: none;
  background: none; font-family: var(--font); font-size: 13.5px;
  font-weight: 500; color: var(--sub); cursor: pointer;
  transition: background .12s, color .12s; text-align: left;
  white-space: nowrap;
}
.nav-item:hover { background: var(--bg); color: var(--text); }
.nav-item.on { background: var(--text); color: #fff; }
.nav-item.on .nav-icon { color: #fff; }
.nav-icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; line-height: 1; }
.nav-spacer { flex: 1; }
.sync-dot { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; margin-left: auto; flex-shrink: 0; }

/* ── MOBILE BOTTOM BAR ── */
.mob-bar {
  display: none;
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 300;
  background: var(--card); border-top: 1px solid var(--border);
  padding: 8px 4px env(safe-area-inset-bottom);
  overflow-x: auto; -webkit-overflow-scrolling: touch;
}
.mob-bar::-webkit-scrollbar { display: none; }
.mob-inner { display: flex; gap: 2px; min-width: max-content; padding: 0 4px; }
.mob-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 6px 12px; border-radius: 10px; border: none; background: none;
  font-family: var(--font); font-size: 10px; font-weight: 600;
  color: var(--muted); cursor: pointer; transition: all .12s;
  white-space: nowrap; flex-shrink: 0;
}
.mob-item.on { background: var(--text); color: #fff; }
.mob-item:not(.on):hover { background: var(--bg); color: var(--text); }
.mob-icon { font-size: 17px; line-height: 1; }

/* ── MOBILE TOPBAR ── */
.mob-top {
  display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 200;
  background: var(--card); border-bottom: 1px solid var(--border);
  padding: 14px 18px; align-items: center; justify-content: space-between;
}
.mob-title { font-size: 16px; font-weight: 800; letter-spacing: -.4px; }

/* ── MAIN ── */
.main { margin-left: 232px; flex: 1; padding: 36px 40px; min-height: 100vh; }

/* ── TOPBAR ── */
.topbar { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 32px; gap: 16px; }
.topbar-left { min-width: 0; }
.page-title { font-size: 24px; font-weight: 800; letter-spacing: -.6px; line-height: 1.2; }
.page-sub { font-size: 12px; color: var(--muted); margin-top: 3px; font-weight: 500; }
.topbar-right { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }

/* ── BUTTONS ── */
.btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 16px; border-radius: var(--r-sm);
  font-size: 13px; font-weight: 600; cursor: pointer; border: none;
  transition: all .12s; font-family: var(--font); letter-spacing: -.1px;
}
.btn-dark { background: var(--text); color: #fff; }
.btn-dark:hover { background: #27272A; }
.btn-ghost { background: var(--card); color: var(--sub); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--bg); color: var(--text); border-color: #d4d4d8; }
.btn-danger { background: #FFF1F2; color: var(--red); }
.btn-danger:hover { background: #FFE4E6; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.btn:disabled { opacity: .5; cursor: not-allowed; }

/* ── BANNER ── */
.banner {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 13px 16px; border-radius: var(--r); margin-bottom: 24px;
  font-size: 13px; font-weight: 500;
}
.banner-warn { background: #FFFBEB; border: 1px solid #FDE68A; color: #92400E; }

/* ── STAT CARDS ── */
.stat-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 28px; }
.stat-card {
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--r); padding: 20px 22px; box-shadow: var(--shadow);
}
.stat-label { font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 8px; }
.stat-value { font-size: 32px; font-weight: 800; letter-spacing: -1.5px; line-height: 1; }
.stat-meta  { font-size: 12px; color: var(--sub); margin-top: 6px; font-weight: 500; }
.stat-track { height: 3px; background: var(--line); border-radius: 99px; margin-top: 14px; overflow: hidden; }
.stat-fill  { height: 100%; border-radius: 99px; transition: width .6s ease; }

/* ── SURFACE CARD ── */
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--shadow); overflow: hidden; }
.card-head { display: flex; align-items: center; justify-content: space-between; padding: 15px 18px; border-bottom: 1px solid var(--line); }
.card-title { font-size: 13px; font-weight: 700; letter-spacing: -.2px; }

/* ── TABLE ── */
.tbl-toolbar { display: flex; align-items: center; gap: 8px; padding: 13px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.t-search {
  flex: 1; min-width: 160px; padding: 8px 12px;
  border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 13px; font-family: var(--font); font-weight: 500;
  outline: none; background: var(--bg); color: var(--text);
  transition: border .12s;
}
.t-search:focus { border-color: var(--blue); background: var(--card); }
.t-sel {
  padding: 8px 11px; border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 13px; font-family: var(--font); font-weight: 500;
  outline: none; background: var(--bg); color: var(--text); cursor: pointer;
}
table { width: 100%; border-collapse: collapse; }
thead th {
  font-size: 11px; font-weight: 700; letter-spacing: .05em;
  text-transform: uppercase; color: var(--muted);
  padding: 10px 16px; text-align: left; background: var(--bg);
  border-bottom: 1px solid var(--border); white-space: nowrap;
}
tbody td { font-size: 13px; padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; font-weight: 500; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: #FAFAFA; }
.cell-muted { color: var(--sub); font-weight: 400; font-size: 12px; }
.cell-mono  { font-variant-numeric: tabular-nums; font-size: 12px; letter-spacing: -.3px; }
.cell-od    { color: var(--red) !important; font-weight: 700; }

/* ── BADGE / PILL ── */
.badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 99px; font-size: 11.5px; font-weight: 600; white-space: nowrap; }
.dot-sm { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.pri-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 5px; font-size: 11px; font-weight: 700; }
.pri-bar { width: 8px; height: 8px; border-radius: 2px; }

/* ── PROGRESS ── */
.prog { display: flex; align-items: center; gap: 8px; }
.prog-track { flex: 1; height: 5px; background: var(--line); border-radius: 99px; overflow: hidden; min-width: 56px; }
.prog-fill  { height: 100%; border-radius: 99px; transition: width .5s; }
.prog-pct   { font-size: 11px; font-weight: 600; color: var(--muted); width: 28px; text-align: right; font-variant-numeric: tabular-nums; }

/* ── KANBAN ── */
.kanban-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.k-col { background: var(--bg); border: 1px solid var(--border); border-radius: var(--r); padding: 14px; }
.k-col-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.k-col-name { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--sub); }
.k-count { font-size: 11px; background: var(--card); border: 1px solid var(--border); color: var(--muted); padding: 1px 7px; border-radius: 99px; font-weight: 600; }
.k-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--r-sm);
  padding: 13px 14px; margin-bottom: 8px; cursor: pointer;
  transition: box-shadow .12s, transform .12s, border-color .12s;
}
.k-card:last-child { margin-bottom: 0; }
.k-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: #D4D4D8; }
.k-title { font-size: 13px; font-weight: 600; line-height: 1.45; margin-bottom: 9px; color: var(--text); }
.k-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 2px; }
.k-proj { font-size: 11px; color: var(--muted); font-weight: 500; }
.k-due { font-size: 11px; color: var(--muted); margin-top: 5px; font-weight: 500; font-variant-numeric: tabular-nums; }

/* ── CALENDAR ── */
.cal-nav { display: flex; align-items: center; gap: 14px; margin-bottom: 18px; }
.cal-month { font-size: 18px; font-weight: 800; letter-spacing: -.5px; }
.cal-head-row { display: grid; grid-template-columns: repeat(7,1fr); margin-bottom: 4px; }
.cal-day-name { text-align: center; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); padding: 6px 0; }
.cal-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: 1px; background: var(--border); border-radius: var(--r); overflow: hidden; border: 1px solid var(--border); }
.cal-cell { background: var(--card); padding: 8px 7px; min-height: 90px; }
.cal-cell.off { background: var(--bg); }
.cal-cell.today { background: #EFF6FF; }
.cal-num { font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 5px; }
.cal-cell.today .cal-num { color: var(--blue); }
.cal-chip { font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; cursor: pointer; }

/* ── PROJECTS ── */
.proj-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px,1fr)); gap: 14px; }
.proj-card {
  background: var(--card); border: 1px solid var(--border); border-radius: var(--r);
  padding: 20px 22px; box-shadow: var(--shadow); cursor: pointer; transition: all .12s;
}
.proj-card:hover { box-shadow: var(--shadow-md); border-color: #D4D4D8; }
.proj-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.proj-name { font-size: 15px; font-weight: 700; letter-spacing: -.3px; }
.proj-id   { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 1px; }
.proj-meta { font-size: 12px; color: var(--sub); font-weight: 500; margin-bottom: 14px; line-height: 1.7; }
.proj-nums { display: flex; gap: 20px; margin-top: 14px; }
.proj-num-n { font-size: 20px; font-weight: 800; letter-spacing: -.8px; }
.proj-num-l { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-top: 1px; }

/* ── MATRIX ── */
.matrix-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.matrix-q { border-radius: var(--r); padding: 18px 20px; border: 1px solid; }
.matrix-q-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 12px; }
.matrix-task { background: var(--card); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 10px 12px; margin-bottom: 7px; }
.matrix-task-name { font-size: 13px; font-weight: 600; margin-bottom: 3px; }
.matrix-task-meta { font-size: 11px; color: var(--sub); font-weight: 500; display: flex; gap: 8px; }

/* ── MODAL ── */
.overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.4);
  z-index: 600; display: flex; align-items: center; justify-content: center;
  padding: 20px; backdrop-filter: blur(4px);
}
.modal {
  background: var(--card); border-radius: 16px; padding: 28px 30px;
  width: 100%; max-width: 500px; max-height: 90vh; overflow-y: auto;
  box-shadow: var(--shadow-lg); animation: slideUp .18s ease;
}
@keyframes slideUp { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.modal-title { font-size: 18px; font-weight: 800; letter-spacing: -.5px; margin-bottom: 22px; }
.form-field { margin-bottom: 16px; }
.form-label { display: block; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.form-input, .form-select, .form-textarea {
  width: 100%; padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--r-sm);
  font-size: 14px; font-family: var(--font); font-weight: 500; outline: none;
  color: var(--text); background: var(--bg); transition: border .12s;
}
.form-input:focus, .form-select:focus, .form-textarea:focus { border-color: var(--blue); background: var(--card); }
.form-textarea { resize: vertical; min-height: 80px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.form-range { width: 100%; accent-color: var(--blue); }
.form-checks { display: flex; gap: 24px; margin-bottom: 16px; }
.form-check { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--sub); }
.form-check input { accent-color: var(--blue); width: 15px; height: 15px; }
.modal-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--line); }

/* ── CONFIG MODAL EXTRAS ── */
.cfg-hint { font-size: 11.5px; color: var(--muted); font-weight: 500; margin-top: 5px; }
.cfg-box { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: var(--r-sm); padding: 13px 15px; margin-bottom: 18px; }
.cfg-box-title { font-size: 11px; font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.cfg-box-text { font-size: 11.5px; color: #15803D; font-weight: 500; line-height: 1.8; }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  .sidebar { display: none !important; }
  .mob-bar { display: block; }
  .mob-top { display: flex; }
  .main { margin-left: 0; padding: 72px 16px 100px; }
  .topbar { display: none; }
  .stat-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .kanban-grid { grid-template-columns: 1fr; }
  .matrix-grid { grid-template-columns: 1fr; }
  .proj-grid { grid-template-columns: 1fr; }
  .form-row { grid-template-columns: 1fr; }
  .tbl-toolbar { gap: 6px; }
  .t-sel { font-size: 12px; padding: 7px 8px; }
  table { font-size: 12px; }
  thead th { padding: 8px 10px; }
  tbody td { padding: 10px 10px; }
  .cal-cell { min-height: 60px; padding: 5px 4px; }
  .cal-num { font-size: 11px; }
  .modal { padding: 22px 18px; }
}
`;

/* ─────────────────────────────────────────────
   SHARED ATOMS
───────────────────────────────────────────── */
function Badge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG["Not Started"];
  return <span className="badge" style={{ background: c.bg, color: c.text }}><span className="dot-sm" style={{ background: c.dot }} />{status}</span>;
}

function PriTag({ priority }) {
  const color = PRI_COLOR[priority] || "#94A3B8";
  return <span className="pri-tag" style={{ background: color+"18", color }}><span className="pri-bar" style={{ background: color }} />{priority}</span>;
}

function Prog({ value }) {
  const v = Math.min(100, Math.max(0, Number(value) || 0));
  const c = v===100?"#22C55E":v>60?"#2563EB":v>30?"#F97316":"#94A3B8";
  return <div className="prog"><div className="prog-track"><div className="prog-fill" style={{ width:v+"%", background:c }} /></div><span className="prog-pct">{v}%</span></div>;
}

/* ─────────────────────────────────────────────
   VIEWS
───────────────────────────────────────────── */
function DashboardView({ tasks, projects }) {
  const total = tasks.length;
  const done  = tasks.filter(t => t.status==="Completed").length;
  const inpro = tasks.filter(t => t.status==="In Progress").length;
  const over  = tasks.filter(t => isOD(t.dueDate, t.status)).length;
  const pct   = total ? Math.round(done/total*100) : 0;

  const upcoming = tasks
    .filter(t => t.status!=="Completed" && t.dueDate)
    .sort((a,b) => new Date(a.dueDate)-new Date(b.dueDate))
    .slice(0, 8);

  return <>
    <div className="stat-row">
      {[
        { label:"Total Tasks",  value:total, meta:`${projects.length} projects`,         fill:"100%",              color:"#18181B" },
        { label:"Completed",    value:done,  meta:`${pct}% completion rate`,             fill:pct+"%",             color:"#22C55E" },
        { label:"In Progress",  value:inpro, meta:`${tasks.filter(t=>dLeft(t.dueDate)===0&&t.status!=="Completed").length} due today`, fill:total?(inpro/total*100)+"%":"0%", color:"#2563EB" },
        { label:"Overdue",      value:over,  meta:over>0?"needs attention":"all on track",fill:total?(over/total*100)+"%":"0%", color:over>0?"#EF4444":"#22C55E" },
      ].map(s => (
        <div className="stat-card" key={s.label}>
          <div className="stat-label">{s.label}</div>
          <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
          <div className="stat-meta">{s.meta}</div>
          <div className="stat-track"><div className="stat-fill" style={{ width:s.fill, background:s.color }} /></div>
        </div>
      ))}
    </div>

    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <div className="card">
        <div className="card-head"><span className="card-title">Upcoming Deadlines</span></div>
        <table>
          <thead><tr><th>Task</th><th>Project</th><th>Due</th><th>Priority</th></tr></thead>
          <tbody>
            {upcoming.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight:600, maxWidth:160 }}>{t.taskName}</td>
                <td className="cell-muted">{t.project}</td>
                <td><span className={`cell-mono ${isOD(t.dueDate,t.status)?"cell-od":""}`}>{fmt(t.dueDate)}{isOD(t.dueDate,t.status)?" ↑":""}</span></td>
                <td><PriTag priority={t.priority} /></td>
              </tr>
            ))}
            {upcoming.length===0 && <tr><td colSpan={4} style={{ textAlign:"center", padding:24, color:"var(--muted)" }}>No upcoming tasks</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Projects Overview</span></div>
        <table>
          <thead><tr><th>Project</th><th>Tasks</th><th>Progress</th><th>Status</th></tr></thead>
          <tbody>
            {projects.map(p => {
              const pt = tasks.filter(t=>t.project===p.name);
              const pd = pt.filter(t=>t.status==="Completed").length;
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight:600 }}>{p.name}</td>
                  <td className="cell-mono">{pt.length}</td>
                  <td style={{ minWidth:120 }}><Prog value={pt.length?Math.round(pd/pt.length*100):0} /></td>
                  <td><Badge status={p.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}

function TasksView({ tasks, projects, onEdit, onAdd }) {
  const [q, setQ]   = useState("");
  const [fp, setFp] = useState("All");
  const [fs, setFs] = useState("All");

  const rows = tasks.filter(t => {
    const mq = t.taskName.toLowerCase().includes(q.toLowerCase()) || t.project.toLowerCase().includes(q.toLowerCase());
    return mq && (fp==="All"||t.project===fp) && (fs==="All"||t.status===fs);
  });

  return (
    <div className="card">
      <div className="tbl-toolbar">
        <input className="t-search" placeholder="Search tasks or projects…" value={q} onChange={e=>setQ(e.target.value)} />
        <select className="t-sel" value={fp} onChange={e=>setFp(e.target.value)}>
          <option>All</option>{projects.map(p=><option key={p.id}>{p.name}</option>)}
        </select>
        <select className="t-sel" value={fs} onChange={e=>setFs(e.target.value)}>
          <option>All</option>{Object.keys(STATUS_CFG).map(s=><option key={s}>{s}</option>)}
        </select>
        <button className="btn btn-dark btn-sm" onClick={onAdd}>+ Task</button>
      </div>
      <div style={{ overflowX:"auto" }}>
        <table>
          <thead><tr>
            <th>Task</th><th>Project</th><th>Phase</th><th>Status</th>
            <th>Priority</th><th>Due</th><th>Progress</th><th></th>
          </tr></thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.id}>
                <td style={{ fontWeight:600, maxWidth:180 }}>{t.taskName}</td>
                <td className="cell-muted">{t.project}</td>
                <td className="cell-muted">{t.phase}</td>
                <td><Badge status={t.status} /></td>
                <td><PriTag priority={t.priority} /></td>
                <td><span className={`cell-mono ${isOD(t.dueDate,t.status)?"cell-od":""}`}>{fmt(t.dueDate)}{isOD(t.dueDate,t.status)?" ↑":""}</span></td>
                <td style={{ minWidth:120 }}><Prog value={t.progress} /></td>
                <td><button className="btn btn-ghost btn-sm" onClick={()=>onEdit(t)}>Edit</button></td>
              </tr>
            ))}
            {rows.length===0 && <tr><td colSpan={8} style={{ textAlign:"center", padding:36, color:"var(--muted)" }}>No tasks match your filters</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KanbanView({ tasks, onEdit, onAdd }) {
  const STAGES = ["Backlog","Ideas","In Progress","Done"];
  const extra  = [...new Set(tasks.map(t=>t.kanbanStage))].filter(s=>!STAGES.includes(s));
  const stages = [...STAGES, ...extra];

  return <>
    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:14 }}>
      <button className="btn btn-dark btn-sm" onClick={onAdd}>+ New Task</button>
    </div>
    <div className="kanban-grid">
      {stages.map(stage => {
        const col = tasks.filter(t=>t.kanbanStage===stage);
        return (
          <div className="k-col" key={stage}>
            <div className="k-col-head">
              <span className="k-col-name">{stage}</span>
              <span className="k-count">{col.length}</span>
            </div>
            {col.map(t => (
              <div className="k-card" key={t.id} onClick={()=>onEdit(t)}>
                <div className="k-title">{t.taskName}</div>
                <div style={{ marginBottom:6 }}><Prog value={t.progress} /></div>
                <div className="k-foot">
                  <span className="k-proj">{t.project}</span>
                  <span className="pri-bar" style={{ background:PRI_COLOR[t.priority]||"#94A3B8", width:10, height:10, borderRadius:3 }} />
                </div>
                {t.dueDate && <div className={`k-due ${isOD(t.dueDate,t.status)?"cell-od":""}`}>Due {fmt(t.dueDate)}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  </>;
}

function CalendarView({ tasks }) {
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());

  const first = new Date(yr,mo,1).getDay();
  const days  = new Date(yr,mo+1,0).getDate();
  const cells = Array(first).fill(null);
  for(let d=1;d<=days;d++) cells.push(d);
  while(cells.length%7!==0) cells.push(null);

  const byDay = {};
  tasks.forEach(t => {
    if(!t.dueDate) return;
    const d = new Date(t.dueDate+"T00:00:00");
    if(d.getFullYear()===yr && d.getMonth()===mo) {
      const k = d.getDate();
      byDay[k] = byDay[k] || [];
      byDay[k].push(t);
    }
  });

  const prev = () => {
  if (mo === 0) {
    setMo(11);
    setYr(y => y - 1);
  } else {
    setMo(m => m - 1);
  }
};

const next = () => {
  if (mo === 11) {
    setMo(0);
    setYr(y => y + 1);
  } else {
    setMo(m => m + 1);
  }
};

  return <>
    <div className="cal-nav">
      <button className="btn btn-ghost btn-sm" onClick={prev}>‹</button>
      <span className="cal-month">{MONTHS[mo]} {yr}</span>
      <button className="btn btn-ghost btn-sm" onClick={next}>›</button>
    </div>
    <div className="cal-head-row">{DAYS.map(d=><div className="cal-day-name" key={d}>{d}</div>)}</div>
    <div className="cal-grid">
      {cells.map((d,i) => {
        const isT = d && d===now.getDate() && mo===now.getMonth() && yr===now.getFullYear();
        const dt  = d ? (byDay[d]||[]) : [];
        return (
          <div key={i} className={`cal-cell ${!d?"off":""} ${isT?"today":""}`}>
            {d && <div className="cal-num">{d}</div>}
            {dt.slice(0,3).map(t => {
              const c = STATUS_CFG[t.status]||STATUS_CFG["Not Started"];
              return <span key={t.id} className="cal-chip" style={{ background:c.bg, color:c.text }} title={t.taskName}>{t.taskName}</span>;
            })}
            {dt.length>3 && <span style={{ fontSize:10, color:"var(--muted)", fontWeight:600 }}>+{dt.length-3}</span>}
          </div>
        );
      })}
    </div>
  </>;
}

function ProjectsView({ projects, tasks, onEdit, onAdd }) {
  return <>
    <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:16 }}>
      <button className="btn btn-dark btn-sm" onClick={onAdd}>+ New Project</button>
    </div>
    <div className="proj-grid">
      {projects.map(p => {
        const pt   = tasks.filter(t=>t.project===p.name);
        const done = pt.filter(t=>t.status==="Completed").length;
        const inpr = pt.filter(t=>t.status==="In Progress").length;
        const over = pt.filter(t=>isOD(t.dueDate,t.status)).length;
        const pp   = pt.length ? Math.round(done/pt.length*100) : 0;
        return (
          <div className="proj-card" key={p.id} onClick={()=>onEdit(p)}>
            <div className="proj-head">
              <div><div className="proj-name">{p.name}</div><div className="proj-id">{p.id}</div></div>
              <Badge status={p.status} />
            </div>
            <div className="proj-meta">
              <span>👤 {p.lead}</span>{p.client && <span> · 🏢 {p.client}</span>}<br />
              <span>📅 {fmt(p.start)} → {fmt(p.end)}</span>
            </div>
            <Prog value={pp} />
            <div className="proj-nums">
              {[{n:pt.length,l:"Total"},{n:done,l:"Done",c:"#22C55E"},{n:inpr,l:"Active",c:"#2563EB"},{n:over,l:"Overdue",c:over>0?"#EF4444":"var(--muted)"}].map(x=>(
                <div key={x.l}><div className="proj-num-n" style={{ color:x.c||"var(--text)" }}>{x.n}</div><div className="proj-num-l">{x.l}</div></div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  </>;
}

function MatrixView({ tasks }) {
  const Q = [
    { k:"do", label:"Do First",  imp:true,  urg:true,  color:"#DC2626", border:"#FECACA", bg:"#FFF5F5" },
    { k:"sc", label:"Schedule",  imp:true,  urg:false, color:"#2563EB", border:"#BFDBFE", bg:"#F0F7FF" },
    { k:"de", label:"Delegate",  imp:false, urg:true,  color:"#D97706", border:"#FDE68A", bg:"#FFFBEB" },
    { k:"dn", label:"Eliminate", imp:false, urg:false, color:"#71717A", border:"#E4E4E7", bg:"#FAFAFA" },
  ];
  return (
    <div className="matrix-grid">
      {Q.map(q => {
        const qt = tasks.filter(t=>!!t.important===q.imp && !!t.urgent===q.urg && t.status!=="Completed");
        return (
          <div key={q.k} className="matrix-q" style={{ background:q.bg, borderColor:q.border }}>
            <div className="matrix-q-title" style={{ color:q.color }}>{q.label} <span style={{ opacity:.6 }}>({qt.length})</span></div>
            {qt.length===0 && <div style={{ fontSize:12, color:"var(--muted)", fontWeight:500 }}>Nothing here</div>}
            {qt.map(t => (
              <div key={t.id} className="matrix-task">
                <div className="matrix-task-name">{t.taskName}</div>
                <div className="matrix-task-meta">
                  <span>{t.project}</span>
                  {t.dueDate && <span className={isOD(t.dueDate,t.status)?"cell-od":""}>{fmt(t.dueDate)}</span>}
                  <span><PriTag priority={t.priority} /></span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────
   MODALS
───────────────────────────────────────────── */
function TaskModal({ task, projects, onSave, onDelete, onClose }) {
  const isNew = !task.id;
  const [f, sf] = useState({
    taskName:    task.taskName    || "",
    project:     task.project     || (projects[0]?.name||""),
    phase:       task.phase       || "Phase 1",
    assignedTo:  task.assignedTo  || "",
    status:      task.status      || "Not Started",
    kanbanStage: task.kanbanStage || "Backlog",
    priority:    task.priority    || "Medium",
    important:   !!task.important,
    urgent:      !!task.urgent,
    startDate:   task.startDate   || "",
    dueDate:     task.dueDate     || "",
    progress:    task.progress    ?? 0,
    notes:       task.notes       || "",
  });
  const s=(k,v)=>sf(p=>({...p,[k]:v}));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">{isNew?"New Task":"Edit Task"}</div>
        <div className="form-field"><label className="form-label">Task Name *</label><input className="form-input" value={f.taskName} onChange={e=>s("taskName",e.target.value)} placeholder="What needs to be done?" /></div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Project *</label><select className="form-select" value={f.project} onChange={e=>s("project",e.target.value)}>{projects.map(p=><option key={p.id}>{p.name}</option>)}</select></div>
          <div className="form-field"><label className="form-label">Phase</label><input className="form-input" value={f.phase} onChange={e=>s("phase",e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Status *</label><select className="form-select" value={f.status} onChange={e=>s("status",e.target.value)}>{Object.keys(STATUS_CFG).map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="form-field"><label className="form-label">Kanban Stage</label><select className="form-select" value={f.kanbanStage} onChange={e=>s("kanbanStage",e.target.value)}>{["Backlog","Ideas","In Progress","Done"].map(x=><option key={x}>{x}</option>)}</select></div>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Priority *</label><select className="form-select" value={f.priority} onChange={e=>s("priority",e.target.value)}>{Object.keys(PRI_COLOR).map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="form-field"><label className="form-label">Assigned To</label><input className="form-input" value={f.assignedTo} onChange={e=>s("assignedTo",e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Start Date *</label><input className="form-input" type="date" value={f.startDate} onChange={e=>s("startDate",e.target.value)} /></div>
          <div className="form-field"><label className="form-label">Due Date *</label><input className="form-input" type="date" value={f.dueDate} onChange={e=>s("dueDate",e.target.value)} /></div>
        </div>
        <div className="form-field"><label className="form-label">Progress — {f.progress}%</label><input className="form-range" type="range" min="0" max="100" step="5" value={f.progress} onChange={e=>s("progress",Number(e.target.value))} /></div>
        <div className="form-checks">
          <label className="form-check"><input type="checkbox" checked={f.important} onChange={e=>s("important",e.target.checked)} />Important</label>
          <label className="form-check"><input type="checkbox" checked={f.urgent} onChange={e=>s("urgent",e.target.checked)} />Urgent</label>
        </div>
        <div className="form-field"><label className="form-label">Notes</label><textarea className="form-textarea" value={f.notes} onChange={e=>s("notes",e.target.value)} placeholder="Optional notes…" /></div>
        <div className="modal-footer">
          {!isNew&&<button className="btn btn-danger" onClick={()=>onDelete(task.id)}>Delete</button>}
          <div style={{flex:1}}/>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-dark" onClick={()=>onSave({...task,...f})}>{isNew?"Add Task":"Save"}</button>
        </div>
      </div>
    </div>
  );
}

function ProjectModal({ project, onSave, onDelete, onClose }) {
  const isNew = !project.id;
  const [f, sf] = useState({
    id:     project.id     || "P" + String(Date.now()).slice(-2),
    name:   project.name   || "",
    start:  project.start  || "",
    end:    project.end    || "",
    lead:   project.lead   || "",
    client: project.client || "",
    status: project.status || "Not Started",
  });
  const s=(k,v)=>sf(p=>({...p,[k]:v}));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">{isNew?"New Project":"Edit Project"}</div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Project ID</label><input className="form-input" value={f.id} onChange={e=>s("id",e.target.value)} /></div>
          <div className="form-field"><label className="form-label">Status</label><select className="form-select" value={f.status} onChange={e=>s("status",e.target.value)}>{Object.keys(STATUS_CFG).map(x=><option key={x}>{x}</option>)}</select></div>
        </div>
        <div className="form-field"><label className="form-label">Project Name *</label><input className="form-input" value={f.name} onChange={e=>s("name",e.target.value)} /></div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Start Date</label><input className="form-input" type="date" value={f.start} onChange={e=>s("start",e.target.value)} /></div>
          <div className="form-field"><label className="form-label">End Date</label><input className="form-input" type="date" value={f.end} onChange={e=>s("end",e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-field"><label className="form-label">Project Lead</label><input className="form-input" value={f.lead} onChange={e=>s("lead",e.target.value)} /></div>
          <div className="form-field"><label className="form-label">Client</label><input className="form-input" value={f.client} onChange={e=>s("client",e.target.value)} /></div>
        </div>
        <div className="modal-footer">
          {!isNew&&<button className="btn btn-danger" onClick={()=>onDelete(project.id)}>Delete</button>}
          <div style={{flex:1}}/>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-dark" onClick={()=>onSave({...project,...f})}>{isNew?"Add Project":"Save"}</button>
        </div>
      </div>
    </div>
  );
}

function ConfigModal({ cfg, onSave, onClose }) {
  const [f, sf] = useState({ apiKey:cfg.apiKey||"", sheetId:cfg.sheetId||"", sheetName:cfg.sheetName||"Variable Tasks" });
  const s=(k,v)=>sf(p=>({...p,[k]:v}));
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">Connect Google Sheet</div>
        <div className="cfg-box">
          <div className="cfg-box-title">Your sheet — HeyMorning format</div>
          <div className="cfg-box-text">Tab: Variable Tasks<br />Columns: PROJECT · TASK NAME · PHASE · STATUS · KANBAN STAGE · PRIORITY · ASSIGNED TO · IMPORTANT · URGENT · START DATE · DUE DATE · PROGRESS · NOTES</div>
        </div>
        <div className="form-field">
          <label className="form-label">Google Sheets API Key</label>
          <input className="form-input" value={f.apiKey} onChange={e=>s("apiKey",e.target.value)} placeholder="AIzaSy…" />
          <div className="cfg-hint">Google Cloud Console → APIs & Services → Credentials</div>
        </div>
        <div className="form-field">
          <label className="form-label">Spreadsheet ID</label>
          <input className="form-input" value={f.sheetId} onChange={e=>s("sheetId",e.target.value)} placeholder="1BxiMVs0XRA5nF…" />
          <div className="cfg-hint">From URL: /spreadsheets/d/<strong>THIS_PART</strong>/edit</div>
        </div>
        <div className="form-field">
          <label className="form-label">Tab Name</label>
          <input className="form-input" value={f.sheetName} onChange={e=>s("sheetName",e.target.value)} placeholder="Variable Tasks" />
        </div>
        <div style={{ fontSize:12, color:"var(--muted)", fontWeight:500, marginBottom:4 }}>⚠ Share sheet as "Anyone with the link → Viewer" for the API key to work.</div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-dark" onClick={()=>onSave(f)}>Save & Connect</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   NAV CONFIG
───────────────────────────────────────────── */
const NAV = [
  { id:"dashboard", icon:"◈", label:"Dashboard",       mob:"Home"     },
  { id:"tasks",     icon:"☰", label:"All Tasks",        mob:"Tasks"    },
  { id:"kanban",    icon:"⊞", label:"Kanban",           mob:"Kanban"   },
  { id:"calendar",  icon:"▦", label:"Calendar",         mob:"Calendar" },
  { id:"projects",  icon:"◧", label:"Projects",         mob:"Projects" },
  { id:"matrix",    icon:"⊡", label:"Decision Matrix",  mob:"Matrix"   },
];
const TITLES = {
  dashboard: ["Overview",         "your control centre at a glance"],
  tasks:     ["All Tasks",        "view, filter & manage every task"],
  kanban:    ["Kanban Board",     "tasks grouped by stage"],
  calendar:  ["Calendar",         "deadlines plotted by month"],
  projects:  ["Projects",         "all active & upcoming projects"],
  matrix:    ["Decision Matrix",  "eisenhower prioritisation"],
};

/* ─────────────────────────────────────────────
   ROOT APP
───────────────────────────────────────────── */
export default function App() {
  const [view,      setView]      = useState("dashboard");
  const [tasks,     setTasks]     = useState(DEMO_TASKS);
  const [projects,  setProjects]  = useState(DEMO_PROJECTS);
  const [cfg,       setCfg]       = useState({ apiKey:"", sheetId:"", sheetName:"Variable Tasks" });
  const [connected, setConnected] = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [showCfg,   setShowCfg]   = useState(false);
  const [taskModal, setTaskModal] = useState(null);
  const [projModal, setProjModal] = useState(null);

  // Persist config in sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("cc_cfg");
      if (saved) { const c = JSON.parse(saved); setCfg(c); if(c.apiKey&&c.sheetId) setConnected(true); }
    } catch {}
  }, []);

  const syncFromSheet = useCallback(async (c) => {
    if (!c.apiKey || !c.sheetId) return;
    setSyncing(true);
    try {
      const rows = await sheetsGet(c, `${c.sheetName}!A2:M500`);
      const parsed = rows.filter(r=>r[0]&&r[1]).map((r,i) => ({
        id: i+1,
        project:     r[0]||"",
        taskName:    r[1]||"",
        phase:       r[2]||"",
        status:      r[3]||"Not Started",
        kanbanStage: r[4]||"Backlog",
        priority:    r[5]||"Medium",
        assignedTo:  r[6]||"",
        important:   ["true","1","TRUE","yes"].includes(String(r[7]||"").toLowerCase()),
        urgent:      ["true","1","TRUE","yes"].includes(String(r[8]||"").toLowerCase()),
        startDate:   r[9]||"",
        dueDate:     r[10]||"",
        progress:    Number(String(r[11]||"0").replace(/[^0-9.]/g,""))||0,
        notes:       r[12]||"",
      }));
      if (parsed.length > 0) setTasks(parsed);
    } catch(e) { alert("Sync failed: " + e.message); }
    setSyncing(false);
  }, []);

  const saveCfg = (newCfg) => {
    setCfg(newCfg);
    try { sessionStorage.setItem("cc_cfg", JSON.stringify(newCfg)); } catch {}
    setConnected(!!(newCfg.apiKey && newCfg.sheetId));
    setShowCfg(false);
    if (newCfg.apiKey && newCfg.sheetId) syncFromSheet(newCfg);
  };

  const saveTask = t => {
    setTasks(prev => t.id ? prev.map(x=>x.id===t.id?t:x) : [...prev, {...t, id:Date.now()}]);
    setTaskModal(null);
  };
  const delTask = id => { setTasks(p=>p.filter(x=>x.id!==id)); setTaskModal(null); };

  const saveProj = p => {
    setProjects(prev => prev.find(x=>x.id===p.id) ? prev.map(x=>x.id===p.id?p:x) : [...prev,p]);
    setProjModal(null);
  };
  const delProj = id => { setProjects(p=>p.filter(x=>x.id!==id)); setProjModal(null); };

  const [title, sub] = TITLES[view] || ["",""];

  return (
    <>
      <style>{CSS}</style>
      <div className="shell">

        {/* ── DESKTOP SIDEBAR ── */}
        <nav className="sidebar">
          <div className="sidebar-inner">
            <div className="logo">
              <div className="logo-mark">
                <svg viewBox="0 0 16 16"><path d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z"/></svg>
              </div>
              Control Centre
            </div>

            <div className="nav-label">Views</div>
            {NAV.map(n => (
              <button key={n.id} className={`nav-item ${view===n.id?"on":""}`} onClick={()=>setView(n.id)}>
                <span className="nav-icon">{n.icon}</span>{n.label}
              </button>
            ))}

            <div className="nav-spacer" />
            <div className="nav-label">Sync</div>
            <button className="nav-item" onClick={()=>setShowCfg(true)}>
              <span className="nav-icon">⚙</span>Google Sheet
              {connected && <span className="sync-dot" />}
            </button>
            {connected && (
              <button className="nav-item" onClick={()=>syncFromSheet(cfg)} disabled={syncing}>
                <span className="nav-icon">{syncing?"↻":"↺"}</span>
                {syncing?"Syncing…":"Sync Now"}
              </button>
            )}
          </div>
        </nav>

        {/* ── MOBILE TOP BAR ── */}
        <div className="mob-top">
          <span className="mob-title">Control Centre</span>
          <div style={{ display:"flex", gap:8 }}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowCfg(true)}>⚙</button>
            {(view==="tasks"||view==="kanban") && <button className="btn btn-dark btn-sm" onClick={()=>setTaskModal({})}>+ Task</button>}
            {view==="projects" && <button className="btn btn-dark btn-sm" onClick={()=>setProjModal({})}>+ Project</button>}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <main className="main">
          <div className="topbar">
            <div className="topbar-left">
              <div className="page-title">{title}</div>
              <div className="page-sub">{sub}</div>
            </div>
            <div className="topbar-right">
              {!connected && <button className="btn btn-ghost" onClick={()=>setShowCfg(true)}>🔗 Connect Sheet</button>}
              {(view==="tasks"||view==="kanban") && <button className="btn btn-dark" onClick={()=>setTaskModal({})}>+ New Task</button>}
              {view==="projects" && <button className="btn btn-dark" onClick={()=>setProjModal({})}>+ New Project</button>}
            </div>
          </div>

          {!connected && (
            <div className="banner banner-warn">
              <span>Running on <strong>demo data</strong> — connect your HeyMorning Google Sheet to load your real tasks.</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowCfg(true)}>Connect →</button>
            </div>
          )}

          {view==="dashboard" && <DashboardView tasks={tasks} projects={projects} />}
          {view==="tasks"     && <TasksView tasks={tasks} projects={projects} onEdit={t=>setTaskModal(t)} onAdd={()=>setTaskModal({})} />}
          {view==="kanban"    && <KanbanView tasks={tasks} onEdit={t=>setTaskModal(t)} onAdd={()=>setTaskModal({})} />}
          {view==="calendar"  && <CalendarView tasks={tasks} />}
          {view==="projects"  && <ProjectsView projects={projects} tasks={tasks} onEdit={p=>setProjModal(p)} onAdd={()=>setProjModal({})} />}
          {view==="matrix"    && <MatrixView tasks={tasks} />}
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <div className="mob-bar">
          <div className="mob-inner">
            {NAV.map(n => (
              <button key={n.id} className={`mob-item ${view===n.id?"on":""}`} onClick={()=>setView(n.id)}>
                <span className="mob-icon">{n.icon}</span>
                <span>{n.mob}</span>
              </button>
            ))}
            <button className="mob-item" onClick={()=>setShowCfg(true)}>
              <span className="mob-icon">⚙</span>
              <span>Sheet</span>
              {connected && <span style={{ position:"absolute", top:6, right:10, width:6, height:6, borderRadius:"50%", background:"#22C55E" }} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {showCfg && <ConfigModal cfg={cfg} onSave={saveCfg} onClose={()=>setShowCfg(false)} />}
      {taskModal!==null && <TaskModal task={taskModal} projects={projects} onSave={saveTask} onDelete={delTask} onClose={()=>setTaskModal(null)} />}
      {projModal!==null && <ProjectModal project={projModal} onSave={saveProj} onDelete={delProj} onClose={()=>setProjModal(null)} />}
    </>
  );
}

