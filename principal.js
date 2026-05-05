const API = "http://localhost:8000/api";
const FILE_BASE = "http://localhost:8000";

const token = localStorage.getItem("campusOrbit_token_v1");
const user = JSON.parse(localStorage.getItem("campusOrbit_currentUser_v1") || "null");

if (!user || (user.role || "").toLowerCase() !== "principal") {
  alert("Principal login required.");
  window.location.href = "login.html";
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("campusOrbit_currentUser_v1");
  localStorage.removeItem("campusOrbit_token_v1");
  window.location.href = "login.html";
});

document.getElementById("goTracking")?.addEventListener("click", () => {
  window.location.href = "approval_tracking.html";
});
document.getElementById("goStaff")?.addEventListener("click", () => {
  window.location.href = "staff.html";
});

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ✅ NEW: Check conflicts
async function checkConflicts(date) {
  try {
    const res = await fetch(`${API}/events/approved-by-date?date=${date}`, {
      headers: {
        "Authorization": token ? `Bearer ${token}` : ""
      }
    });

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.log("Conflict check failed");
    return [];
  }
}

function eventExtraMetaHtml(ev) {
  const locationHtml = ev.location
    ? `<div class="meta"><div>📍 ${escapeHtml(ev.location)}</div></div>`
    : "";

  const timeHtml = (ev.startTime || ev.endTime)
    ? `<div class="meta"><div>⏰ ${escapeHtml(ev.startTime || "-")} to ${escapeHtml(ev.endTime || "-")}</div></div>`
    : "";

  const durationHtml = ev.durationText
    ? `<div class="meta"><div>🗓️ ${escapeHtml(ev.durationText)}</div></div>`
    : "";

  const linkHtml = ev.link
    ? `<div class="meta"><div>🔗 <a href="${escapeHtml(ev.link)}" target="_blank">Open Link</a></div></div>`
    : "";

  const pdfHtml = ev.pdfUrl
    ? `<div class="meta"><div>📄 <a href="${FILE_BASE + ev.pdfUrl}" target="_blank">View PDF</a></div></div>`
    : "";

  return `${locationHtml}${timeHtml}${durationHtml}${linkHtml}${pdfHtml}`;
}

// ✅ UPDATED (async added)
async function loadPending() {
  const listEl = document.getElementById("list");
  listEl.innerHTML = "";

  let res;
  try {
    res = await fetch(`${API}/events/pending`, {
      headers: {
        "Authorization": token ? `Bearer ${token}` : ""
      }
    });
  } catch (e) {
    listEl.innerHTML = `
      <div class="empty">
        <h3>Server not reachable</h3>
        <p>Check if backend is running</p>
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
        <h3>API error</h3>
        <p>${escapeHtml(data?.error || `Status ${res.status}`)}</p>
      </div>
    `;
    return;
  }

  const list = Array.isArray(data) ? data : [];

  if (list.length === 0) {
    listEl.innerHTML = `
      <div class="empty">
        <h3>No pending approvals</h3>
        <p>No events waiting</p>
      </div>
    `;
    return;
  }

  // ✅ IMPORTANT: for-of loop
  for (const ev of list) {
    const id = ev._id || ev.id;

    // ✅ Check conflicts
    const conflicts = await checkConflicts(ev.date);

    // ✅ Conflict UI
    const conflictHtml = conflicts.length > 0 ? `
      <div style="margin-top:10px;padding:10px;border-radius:10px;background:#fee2e2;color:#b91c1c;font-weight:700;">
        ⚠️ Conflict Detected!
        ${conflicts.map(c => `<div>• ${escapeHtml(c.title)}</div>`).join("")}
        <div>👉 Choose another date</div>
      </div>
    ` : "";

    const box = document.createElement("div");
    box.className = "card";

    box.innerHTML = `
      <div class="topRow">
        <h3 class="eventName">${escapeHtml(ev.title)}</h3>
        <span class="badge">🟡 PENDING APPROVAL</span>
      </div>

      <div class="meta">
        <div>📅 ${escapeHtml(ev.date)}</div>
        <div>🏫 ${escapeHtml(ev.dept)}</div>
        <div>🏷️ ${escapeHtml(ev.type)}</div>
        <div>👤 By: ${escapeHtml(ev.createdBy || "Staff")}</div>
      </div>
      <div class="meta">
      <div>🛣️ Route: ${escapeHtml(ev.approvalRoute || "BOTH")}</div>
      </div>

      <div style="font-weight:750;margin:0 0 8px;">
        Description: <span style="color:rgba(15,23,42,.72);font-weight:650">${escapeHtml(ev.desc)}</span>
      </div>

      ${eventExtraMetaHtml(ev)}
      ${conflictHtml}

      <textarea id="remark_${id}" placeholder="Add remarks (optional)..."></textarea>

      <div class="actions">
        <button class="btn approve" data-id="${id}" data-action="APPROVED">✅ Approve</button>
        <button class="btn reject" data-id="${id}" data-action="REJECTED">⛔ Reject</button>
      </div>
    `;

    listEl.appendChild(box);
  }

  document.querySelectorAll("button[data-action]").forEach(btn => {
    btn.onclick = () => decide(btn.dataset.id, btn.dataset.action);
  });
}

async function decide(id, status) {
  let remark = document.getElementById(`remark_${id}`)?.value?.trim() || "";

  // ✅ Auto message if rejected
  if (status === "REJECTED" && !remark) {
    remark = " ⚠️ This event coincides with another approved event. Kindly consider selecting a different date.";
  }

  const res = await fetch(`${API}/events/decide/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token ? `Bearer ${token}` : ""
    },
    body: JSON.stringify({ status, remark })
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    alert(`✅ Event ${status}`);
    loadPending();
  } else {
    alert("❌ " + (data.error || `Failed (${res.status})`));
  }
}

loadPending();