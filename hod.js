const API = "http://localhost:8000/api";
const FILE_BASE = "http://localhost:8000";

const token = localStorage.getItem("campusOrbit_token_v1");
const user = JSON.parse(localStorage.getItem("campusOrbit_currentUser_v1") || "null");

// ✅ Check HOD login
if (!user || (user.role || "").toLowerCase() !== "hod") {
  alert("HOD login required.");
  window.location.href = "login.html";
}

// 🔓 Logout
function logout(){
  localStorage.removeItem("campusOrbit_currentUser_v1");
  localStorage.removeItem("campusOrbit_token_v1");
  window.location.href = "login.html";
}

// 🧼 escape HTML
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// 📄 Extra event details
function eventExtraMetaHtml(ev) {
  const locationHtml = ev.location
    ? `<div class="meta">📍 ${escapeHtml(ev.location)}</div>` : "";

  const timeHtml = (ev.startTime || ev.endTime)
    ? `<div class="meta">⏰ ${escapeHtml(ev.startTime || "-")} to ${escapeHtml(ev.endTime || "-")}</div>` : "";

  const linkHtml = ev.link
    ? `<div class="meta">🔗 <a href="${escapeHtml(ev.link)}" target="_blank">Open Link</a></div>` : "";

  const pdfHtml = ev.pdfUrl
    ? `<div class="meta">📄 <a href="${FILE_BASE + ev.pdfUrl}" target="_blank">View PDF</a></div>` : "";

  return `${locationHtml}${timeHtml}${linkHtml}${pdfHtml}`;
}

// 📥 Load HOD pending events
async function loadPending() {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  let res;
  try {
    res = await fetch(`${API}/events/hod-pending`, {
      headers: {
        "Authorization": token ? `Bearer ${token}` : ""
      }
    });
  } catch (e) {
    listEl.innerHTML = `
      <div class="empty">
        <h3>Server not reachable</h3>
        <p>Check backend</p>
      </div>
    `;
    return;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    listEl.innerHTML = `
      <div class="empty">
        <h3>Error</h3>
        <p>${escapeHtml(data?.error || "Failed")}</p>
      </div>
    `;
    return;
  }

  const list = Array.isArray(data) ? data : [];

  if (list.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <h3>No events</h3>
        <p>No pending approvals</p>
      </div>
    `;
    return;
  }

  for (const ev of list) {
    const id = ev._id || ev.id;

    const box = document.createElement("div");
    box.className = "card";

    box.innerHTML = `
      <div class="topRow">
        <h3 class="eventName">${escapeHtml(ev.title)}</h3>
        <span class="badge">🟡 PENDING (HOD)</span>
      </div>

      <div class="meta">
        📅 ${escapeHtml(ev.date)} |
        🏫 ${escapeHtml(ev.dept)} |
        🏷️ ${escapeHtml(ev.type)}
      </div>
      <div class="meta">
      Approval Route: ${escapeHtml(ev.approvalRoute || "BOTH")}
      </div>

      <div style="margin-top:8px;font-weight:700;">
        Description: ${escapeHtml(ev.desc)}
      </div>

      ${eventExtraMetaHtml(ev)}

      <textarea id="remark_${id}" placeholder="Add remark..."></textarea>

      <div class="actions">
        <button class="btn approve" data-id="${id}" data-action="APPROVED">✅ Approve</button>
        <button class="btn reject" data-id="${id}" data-action="REJECTED">⛔ Reject</button>
      </div>
    `;

    listEl.appendChild(box);
  }

  // 🎯 Button actions
  document.querySelectorAll("button[data-action]").forEach(btn => {
    btn.onclick = () => decide(btn.dataset.id, btn.dataset.action);
  });
}

// ✅ HOD decision
async function decide(id, status) {
  const remark = document.getElementById(`remark_${id}`)?.value || "";

  const res = await fetch(`${API}/events/hod-decide/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    },
    body: JSON.stringify({
      status,
      remark
    })
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    alert(`✅ ${status}`);
    loadPending();
  } else {
    alert("❌ " + (data.error || "Failed"));
  }
}

// 🚀 Start
loadPending();