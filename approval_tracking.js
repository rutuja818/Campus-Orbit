const API = "http://localhost:8000/api";
const LS_USER = "campusOrbit_currentUser_v1";

const user = JSON.parse(localStorage.getItem(LS_USER) || "null");
if (!user || (user.role || "").toLowerCase() !== "staff") {
  alert("Staff login required.");
  window.location.href = "login.html";
}

const tabs = {
  pending: document.getElementById("tabPending"),
  approved: document.getElementById("tabApproved"),
  rejected: document.getElementById("tabRejected"),
};

const counts = {
  pending: document.getElementById("countPending"),
  approved: document.getElementById("countApproved"),
  rejected: document.getElementById("countRejected"),
};

const listEl = document.getElementById("list");

let allEvents = [];
let activeTab = "PENDING";

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadEvents() {
  const res = await fetch(`${API}/events`);
  const data = await res.json().catch(() => []);
  allEvents = Array.isArray(data) ? data : [];
}

function myEventsOnly(events) {
  const myEmail = (user.email || "").toLowerCase();
  const myName = (user.fullName || user.full_name || user.name || "").toLowerCase();

  return events.filter(e => {
    const cb = String(e.createdBy || "").toLowerCase();
    return cb === myEmail || cb === myName || cb.includes(myEmail) || cb.includes(myName);
  });
}

function updateCounts(events) {
  const mine = myEventsOnly(events);

  const p = mine.filter(e => (e.status || "").toUpperCase() === "PENDING").length;
  const a = mine.filter(e => (e.status || "").toUpperCase() === "APPROVED").length;
  const r = mine.filter(e => (e.status || "").toUpperCase() === "REJECTED").length;

  if (counts.pending) counts.pending.textContent = p;
  if (counts.approved) counts.approved.textContent = a;
  if (counts.rejected) counts.rejected.textContent = r;
}

function renderList() {
  listEl.innerHTML = "";

  const mine = myEventsOnly(allEvents);
  const filtered = mine.filter(e => (e.status || "").toUpperCase() === activeTab);

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <h3>No ${activeTab.toLowerCase()} events</h3>
        <p>Your events will appear here.</p>
      </div>
    `;
    return;
  }

  filtered
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .forEach(e => {
      const badgeClass =
        activeTab === "PENDING" ? "bPending" :
        activeTab === "APPROVED" ? "bApproved" : "bRejected";

      const badgeText =
        activeTab === "PENDING" ? "🟡 PENDING" :
        activeTab === "APPROVED" ? "✅ APPROVED" : "⛔ REJECTED";

      listEl.innerHTML += `
        <div class="card">
          <div class="row">
            <h3 class="eventName">${escapeHtml(e.title)}</h3>
            <span class="badge ${badgeClass}">${badgeText}</span>
          </div>

          <div class="meta">
            <div>📅 ${escapeHtml(e.date)}</div>
            <div>🏫 ${escapeHtml(e.dept)}</div>
            <div>🏷️ ${escapeHtml(e.type)}</div>
          </div>

          <p class="info"><b>Description:</b> ${escapeHtml(e.desc)}</p>

          <div style="margin-top:10px;color:rgba(15,23,42,.85);font-weight:750">
            <div><b>Principal Remark:</b> ${escapeHtml(e.principalRemark || "—")}</div>
            <div><b>Reviewed By:</b> ${escapeHtml(e.reviewedBy || "—")}</div>
            <div><b>Reviewed At:</b> ${escapeHtml(e.reviewedAt && !String(e.reviewedAt).startsWith("0001-01-01") ? new Date(e.reviewedAt).toLocaleString() : "—")}</div>
          </div>
        </div>
      `;
    });
}

function setTab(status) {
  activeTab = status;

  Object.values(tabs).forEach(btn => btn && btn.classList.remove("active"));
  if (status === "PENDING") tabs.pending?.classList.add("active");
  if (status === "APPROVED") tabs.approved?.classList.add("active");
  if (status === "REJECTED") tabs.rejected?.classList.add("active");

  renderList();
}

async function init() {
  await loadEvents();
  updateCounts(allEvents);
  setTab("PENDING");
}

tabs.pending && (tabs.pending.onclick = () => setTab("PENDING"));
tabs.approved && (tabs.approved.onclick = () => setTab("APPROVED"));
tabs.rejected && (tabs.rejected.onclick = () => setTab("REJECTED"));

init();