const API = "http://localhost:8000/api";
const FILE_BASE = "http://localhost:8000";

const user = JSON.parse(localStorage.getItem("campusOrbit_currentUser_v1") || "null");
if (!user || (user.role || "").toLowerCase() !== "student") {
  alert("Student login required.");
  window.location.href = "login.html";
}

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("campusOrbit_currentUser_v1");
  localStorage.removeItem("campusOrbit_token_v1");
  window.location.href = "login.html";
});

const studentDept = user.department || "Central";
let currentViewDept = "ALL";

document.getElementById("deptLabel").textContent = studentDept;
document.getElementById("welcomeText").textContent = `Welcome, ${user.fullName} (student)`;

// DOM
const cardsEl = document.getElementById("cards");
const eventsMetaEl = document.getElementById("eventsMeta");
const monthYearEl = document.getElementById("monthYear");
const calGridEl = document.getElementById("calGrid");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const upTitle = document.getElementById("upTitle");
const upMeta = document.getElementById("upMeta");
const upDesc = document.getElementById("upDesc");

const yearSummaryEl = document.getElementById("yearSummary");
const yearTablePanel = document.getElementById("yearTablePanel");
const yearListTitle = document.getElementById("yearListTitle");
const yearTableBody = document.getElementById("yearTableBody");
const viewDeptFilter = document.getElementById("viewDeptFilter");

let allApprovedEvents = [];
let selectedDate = null;
let selectedYear = null;
let viewMonth = new Date();

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymd(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function studentVisible(ev) {
  const dept = String(ev.dept || "").toUpperCase();

  if (currentViewDept === "Central") {
    return dept === "CENTRAL";
  }

  if (currentViewDept === "ALL") {
    return true;
  }

  return dept === currentViewDept;
}

function getEventYear(ev) {
  return String(ev.date || "").slice(0, 4);
}

function visibleEvents() {
  let list = allApprovedEvents.filter(studentVisible);

  if (selectedYear) {
    list = list.filter(ev => getEventYear(ev) === String(selectedYear));
  }

  return list;
}

function filteredEvents() {
  return visibleEvents()
    .filter(ev => (selectedDate ? ev.date === selectedDate : true))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

async function loadApprovedEvents() {
  try {
    const res = await fetch(`${API}/events/approved`);
    const data = await res.json().catch(() => []);

    if (!res.ok) {
      console.error("Failed to load approved events");
      allApprovedEvents = [];
      return;
    }

    allApprovedEvents = Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("Error loading approved events:", err);
    allApprovedEvents = [];
  }
}

function getTileClassForDate(dateKey) {
  const dayEvents = visibleEvents().filter(ev => ev.date === dateKey);
  if (dayEvents.length === 0) return "";

  const types = dayEvents.map(e => String(e.type || "").toLowerCase());

  if (types.some(t => t.includes("deadline"))) return "deadline";
  if (types.some(t => t.includes("holiday"))) return "holiday";
  if (types.some(t => t.includes("important") || t.includes("exam"))) return "important";

  return "event";
}

function renderCalendar() {
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();

  const first = new Date(y, m, 1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  monthYearEl.textContent = viewMonth.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });

  calGridEl.innerHTML = "";

  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement("div");
    blank.className = "cell muted";
    calGridEl.appendChild(blank);
  }

  const today = new Date();

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(y, m, day);
    const key = ymd(d);

    const cell = document.createElement("div");
    cell.className = "cell";
    cell.textContent = day;

    const tileClass = getTileClassForDate(key);
    if (tileClass) cell.classList.add(tileClass);

    if (sameDay(d, today)) cell.classList.add("today");
    if (selectedDate === key) cell.classList.add("selected");

    cell.onclick = () => {
      selectedDate = selectedDate === key ? null : key;
      renderCalendar();
      renderYearTable();
      renderEvents();
    };

    calGridEl.appendChild(cell);
  }
}

function renderYearSummary() {
  yearSummaryEl.innerHTML = "";

  const list = allApprovedEvents.filter(studentVisible);
  const yearMap = {};

  list.forEach(ev => {
    const year = getEventYear(ev);
    if (!year) return;
    yearMap[year] = (yearMap[year] || 0) + 1;
  });

  const years = Object.keys(yearMap).sort();

  const allBox = document.createElement("div");
  allBox.className = `yearBox ${selectedYear === null ? "active" : ""}`;
  allBox.innerHTML = `
    <div class="yearLabel">All</div>
    <div class="yearCount">${list.length} Event(s)</div>
    <div class="yearHint">Show all events</div>
  `;
  allBox.onclick = () => {
    selectedYear = null;
    selectedDate = null;
    renderAll();
  };
  yearSummaryEl.appendChild(allBox);

  years.forEach(year => {
    const box = document.createElement("div");
    box.className = `yearBox ${String(selectedYear) === String(year) ? "active" : ""}`;
    box.innerHTML = `
      <div class="yearLabel">${escapeHtml(year)}</div>
      <div class="yearCount">${yearMap[year]} Event(s)</div>
      <div class="yearHint">Click to view ${escapeHtml(year)} events</div>
    `;

    box.onclick = () => {
      selectedYear = year;
      selectedDate = null;
      viewMonth = new Date(Number(year), 0, 1);
      renderAll();
    };

    yearSummaryEl.appendChild(box);
  });
}

function renderYearTable() {
  if (!selectedYear) {
    yearTablePanel.style.display = "none";
    yearTableBody.innerHTML = "";
    return;
  }

  const list = allApprovedEvents
    .filter(studentVisible)
    .filter(ev => getEventYear(ev) === String(selectedYear))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  yearTablePanel.style.display = "block";
  yearListTitle.textContent = `${selectedYear} Year Events`;

  if (list.length === 0) {
    yearTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color:var(--muted); font-weight:700;">
          No events found for ${selectedYear}
        </td>
      </tr>
    `;
    return;
  }

  yearTableBody.innerHTML = list.map(ev => `
    <tr>
      <td>${escapeHtml(ev.date)}</td>
      <td>${escapeHtml(ev.title)}</td>
      <td><span class="yearRowBadge">${escapeHtml(ev.type)}</span></td>
      <td>${escapeHtml(ev.dept)}</td>
    </tr>
  `).join("");
}

function eventExtraHtml(ev) {
  const locationHtml = ev.location
    ? `<div class="cardDate">📍 <span>${escapeHtml(ev.location)}</span></div>`
    : "";

  const timeHtml = (ev.startTime || ev.endTime)
    ? `<div class="cardDate">⏰ <span>${escapeHtml(ev.startTime || "-")} to ${escapeHtml(ev.endTime || "-")}</span></div>`
    : "";

  const durationHtml = ev.durationText
    ? `<div class="cardDate">🗓️ <span>${escapeHtml(ev.durationText)}</span></div>`
    : "";

  const linkHtml = ev.link
    ? `<div class="cardDate">🔗 <a href="${escapeHtml(ev.link)}" target="_blank" rel="noopener noreferrer">Open Link</a></div>`
    : "";

  const pdfHtml = ev.pdfUrl
    ? `<div class="cardDate">📄 <a href="${FILE_BASE + ev.pdfUrl}" target="_blank" rel="noopener noreferrer">View PDF</a></div>`
    : "";

  return `${locationHtml}${timeHtml}${durationHtml}${linkHtml}${pdfHtml}`;
}

function renderEvents() {
  cardsEl.innerHTML = "";

  if (selectedYear) {
    const totalYearEvents = allApprovedEvents
      .filter(studentVisible)
      .filter(ev => getEventYear(ev) === String(selectedYear)).length;

    if (selectedDate) {
      const list = filteredEvents();
      eventsMetaEl.textContent = `Showing ${list.length} event(s) for ${selectedYear} on ${selectedDate}`;

      if (list.length === 0) {
        cardsEl.innerHTML = `
          <div class="panel" style="grid-column:1/-1;">
            <div style="font-weight:950;color:var(--brand);font-size:18px;margin-bottom:6px;">No events found</div>
            <div style="color:var(--muted);font-weight:650;">No ${selectedYear} events found on selected date.</div>
          </div>
        `;
        return;
      }

      list.forEach(ev => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="chip">${escapeHtml(ev.type)}</div>
          <h4 class="cardTitle">${escapeHtml(ev.title)}</h4>
          <div class="cardDept">${escapeHtml(ev.dept)}</div>
          <div class="cardDate">📅 <span>${escapeHtml(ev.date)}</span></div>
          ${eventExtraHtml(ev)}
          <p class="cardDesc">${escapeHtml(ev.desc)}</p>
        `;
        cardsEl.appendChild(card);
      });
      return;
    }

    eventsMetaEl.textContent = `Showing ${totalYearEvents} event(s) for year ${selectedYear}`;
    return;
  }

  const list = filteredEvents();
  const dateText = selectedDate ? ` on ${selectedDate}` : "";

  eventsMetaEl.textContent = `Showing ${list.length} event(s) for ${studentDept} (and Central)${dateText}`;
  if (list.length === 0) {
    cardsEl.innerHTML = `
      <div class="panel" style="grid-column:1/-1;">
        <div style="font-weight:950;color:var(--brand);font-size:18px;margin-bottom:6px;">No events found</div>
        <div style="color:var(--muted);font-weight:650;">Try selecting another date or click the same date again to clear filter.</div>
      </div>
    `;
    return;
  }

  list.forEach(ev => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <div class="chip">${escapeHtml(ev.type)}</div>
      <h4 class="cardTitle">${escapeHtml(ev.title)}</h4>
      <div class="cardDept">${escapeHtml(ev.dept)}</div>
      <div class="cardDate">📅 <span>${escapeHtml(ev.date)}</span></div>
      ${eventExtraHtml(ev)}
      <p class="cardDesc">${escapeHtml(ev.desc)}</p>
    `;
    cardsEl.appendChild(card);
  });
}

function renderUpcoming() {
  const todayKey = ymd(new Date());

  const next = allApprovedEvents
    .filter(studentVisible)
    .filter(e => e.date >= todayKey)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];

  if (!next) {
    upTitle.textContent = "No upcoming events";
    upMeta.textContent = "—";
    upDesc.textContent = "No upcoming approved events for your department right now.";
    return;
  }

  upTitle.textContent = next.title;

  const parts = [
    next.dept,
    next.type,
    next.date,
    next.location ? `📍 ${next.location}` : "",
    (next.startTime || next.endTime) ? `⏰ ${next.startTime || "-"} to ${next.endTime || "-"}` : ""
  ].filter(Boolean);

  upMeta.textContent = parts.join(" • ");
  upDesc.textContent = next.desc;
}

function renderAll() {
  renderYearSummary();
  renderCalendar();
  renderUpcoming();
  renderYearTable();
  renderEvents();
}

prevBtn.onclick = () => {
  viewMonth.setMonth(viewMonth.getMonth() - 1);
  renderCalendar();
};

nextBtn.onclick = () => {
  viewMonth.setMonth(viewMonth.getMonth() + 1);
  renderCalendar();
};
viewDeptFilter?.addEventListener("change", () => {
  currentViewDept = viewDeptFilter.value;
  selectedDate = null;
  selectedYear = null;
  renderAll();
});
async function init() {
 viewDeptFilter.value = "ALL";
 currentViewDept = "ALL";

  await loadApprovedEvents();
  renderAll();
}

init();