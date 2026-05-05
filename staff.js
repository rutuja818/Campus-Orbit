// staff.js (NO localStorage) — uses MongoDB backend APIs
const API = "http://localhost:8000/api";

// ---- AUTH / PROTECT STAFF PAGE ----
const u = JSON.parse(localStorage.getItem("campusOrbit_currentUser_v1") || "null");
if (!u || (u.role || "").toLowerCase() !== "staff") {
  alert("Staff login required.");
  window.location.href = "login.html";
}

// ---- DOM ----
const welcomeText = document.getElementById("welcomeText");
const logoutBtn = document.getElementById("logoutBtn");
const trackBtn = document.getElementById("trackBtn");

const filtersEl = document.getElementById("filters");
const cardsEl = document.getElementById("cards");
const eventsMetaEl = document.getElementById("eventsMeta");

const monthYearEl = document.getElementById("monthYear");
const calGridEl = document.getElementById("calGrid");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

const statTotal = document.getElementById("statTotal");
const statExam = document.getElementById("statExam");
const statWorkshop = document.getElementById("statWorkshop");
const statSeminar = document.getElementById("statSeminar");

const upTitle = document.getElementById("upTitle");
const upMeta = document.getElementById("upMeta");
const upDesc = document.getElementById("upDesc");

const addOverlay = document.getElementById("addOverlay");
const editOverlay = document.getElementById("editOverlay");

const addEventTop = document.getElementById("addEventTop");
const closeAdd = document.getElementById("closeAdd");
const cancelAdd = document.getElementById("cancelAdd");
const saveAddBtn = document.getElementById("saveAdd");

const closeEdit = document.getElementById("closeEdit");
const cancelEdit = document.getElementById("cancelEdit");
const saveEditBtn = document.getElementById("saveEdit");

const pdfSemYear = document.getElementById("pdfSemYear");
const pdfSemester = document.getElementById("pdfSemester");
const pdfDept = document.getElementById("pdfDept");
const downloadSemPdfBtn = document.getElementById("downloadSemPdfBtn");

const pdfYear = document.getElementById("pdfYear");
const downloadYearPdfBtn = document.getElementById("downloadYearPdfBtn");
// Add fields
const addTitle = document.getElementById("addTitle");
const addDept = document.getElementById("addDept");
const addType = document.getElementById("addType");
const addDate = document.getElementById("addDate");
const addLocation = document.getElementById("addLocation");
const addStartTime = document.getElementById("addStartTime");
const addEndTime = document.getElementById("addEndTime");
const addDurationText = document.getElementById("addDurationText");
const addLink = document.getElementById("addLink");
const addPdf = document.getElementById("addPdf");
const addDesc = document.getElementById("addDesc");
const approvalRoute = document.getElementById("approvalRoute");
// Edit fields
const editTitle = document.getElementById("editTitle");
const editDept = document.getElementById("editDept");
const editType = document.getElementById("editType");
const editDate = document.getElementById("editDate");
const editLocation = document.getElementById("editLocation");
const editStartTime = document.getElementById("editStartTime");
const editEndTime = document.getElementById("editEndTime");
const editDurationText = document.getElementById("editDurationText");
const editLink = document.getElementById("editLink");
const editPdf = document.getElementById("editPdf");
const editDesc = document.getElementById("editDesc");

// ---- STATE ----
let events = [];
let selectedDept = "All";
let selectedDate = null;
let viewMonth = new Date();
let editingMongoId = null;

const departments = ["All","Central","GSE","CSE","ENTC","ELECT","MECH","CIVIL"];
// ---- UI ----
welcomeText.textContent = `Welcome, ${u.fullName} (staff)`;

// Logout
logoutBtn.onclick = () => {
  localStorage.removeItem("campusOrbit_currentUser_v1");
  localStorage.removeItem("campusOrbit_token_v1");
  window.location.href = "login.html";
};

// Tracking
trackBtn.addEventListener("click", () => window.location.href = "approval_tracking.html");

// ---- HELPERS ----
function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function pad2(n){ return String(n).padStart(2,"0"); }
function ymd(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }
function sameDay(a,b){
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function isValidUrl(url){
  if (!url) return true;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ---- API CALLS ----
async function apiGet(path){
  const token = localStorage.getItem("campusOrbit_token_v1") || "";
  const res = await fetch(API + path, {
    headers: token ? { "Authorization": `Bearer ${token}` } : {}
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiPostForm(path, formData){
  const token = localStorage.getItem("campusOrbit_token_v1") || "";
  const res = await fetch(API + path, {
    method:"POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: formData
  });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiPutForm(path, formData){
  const token = localStorage.getItem("campusOrbit_token_v1") || "";
  const res = await fetch(API + path, {
    method:"PUT",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: formData
  });
  const data = await res.json().catch(()=> ({}));
  if(!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---- LOAD EVENTS FROM MONGODB ----
async function loadEventsFromDB(){
  const all = await apiGet("/events");
  const myEmail = (u.email || "").toLowerCase();

  events = (all || []).filter(ev => {
    const cb = String(ev.createdBy || "").toLowerCase();
    return cb === myEmail || cb === String(u.fullName || "").toLowerCase();
  });
}

// ---- FILTERS ----
function renderFilters(){
  filtersEl.innerHTML = "";
  departments.forEach(dep=>{
    const b = document.createElement("div");
    b.className = "filter" + (dep===selectedDept ? " active" : "");
    b.textContent = dep;
    b.onclick = () => { selectedDept = dep; renderAllUI(); };
    filtersEl.appendChild(b);
  });
}

function filteredEvents(){
  return events
    .filter(ev => (selectedDept==="All" ? true : ev.dept===selectedDept))
    .filter(ev => (selectedDate ? ev.date===selectedDate : true))
    .sort((a,b)=> String(a.date).localeCompare(String(b.date)));
}

// ---- CALENDAR ----
function renderCalendar(){
  const y = viewMonth.getFullYear();
  const m = viewMonth.getMonth();
  const first = new Date(y,m,1);
  const firstDow = first.getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();

  monthYearEl.textContent = viewMonth.toLocaleString("default", { month:"long", year:"numeric" });
  calGridEl.innerHTML = "";

  for(let i=0;i<firstDow;i++){
    const blank = document.createElement("div");
    blank.className = "cell muted";
    calGridEl.appendChild(blank);
  }

  const today = new Date();
  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(y,m,day);
    const key = ymd(d);

    const cell = document.createElement("div");
    cell.className = "cell";
    if(sameDay(d, today)) cell.classList.add("today");
    if(selectedDate === key) cell.classList.add("selected");
    cell.textContent = day;

    if(events.some(ev => ev.date === key)){
      const dot = document.createElement("div");
      dot.className = "dot";
      cell.appendChild(dot);
    }

    cell.onclick = () => { selectedDate = key; renderAllUI(); };
    calGridEl.appendChild(cell);
  }
}

prevBtn.onclick = () => { viewMonth.setMonth(viewMonth.getMonth()-1); renderCalendar(); };
nextBtn.onclick = () => { viewMonth.setMonth(viewMonth.getMonth()+1); renderCalendar(); };

// ---- EVENTS RENDER ----
function renderEvents(){
  const list = filteredEvents();
  const deptText = selectedDept==="All" ? "all departments" : selectedDept;
  const dateText = selectedDate ? ` on ${selectedDate}` : "";
  eventsMetaEl.textContent = `Showing ${list.length} event(s) for ${deptText}${dateText}`;

  cardsEl.innerHTML = "";
  if(list.length === 0){
    cardsEl.innerHTML = `<div class="panel" style="grid-column:1/-1;">
      <div style="font-weight:950;color:var(--brand);font-size:18px;margin-bottom:6px;">No events found</div>
      <div style="color:var(--muted);font-weight:650;">Try selecting another date or department.</div>
    </div>`;
    return;
  }

  list.forEach(ev=>{
    const card = document.createElement("div");
    card.className = "card";

    const status = (ev.status || "PENDING").toUpperCase();

    // ✅ SHOW HOD REMARK
    const hodRemarkHtml = ev.hodRemark
      ? `<div style="margin-top:8px;padding:10px;background:#fff3cd;border-radius:8px;font-weight:700;">
           ⚠️ HOD Remark: ${escapeHtml(ev.hodRemark)}
         </div>`
      : "";

    // ✅ SHOW PRINCIPAL REMARK
    const principalRemarkHtml = ev.principalRemark
      ? `<div style="margin-top:6px;color:var(--muted);font-weight:700;">
           Principal Remark: ${escapeHtml(ev.principalRemark)}
         </div>`
      : "";

    const locationHtml = ev.location
      ? `<div class="cardDate">📍 <span>${escapeHtml(ev.location)}</span></div>`
      : "";

    const timeHtml = (ev.startTime || ev.endTime)
      ? `<div class="cardDate">⏰ <span>${escapeHtml(ev.startTime || "-")} to ${escapeHtml(ev.endTime || "-")}</span></div>`
      : "";

    const durationHtml = ev.durationText
      ? `<div class="cardDate">🗓️ <span>${escapeHtml(ev.durationText)}</span></div>`
      : "";

    const FILE_BASE = "http://localhost:8000";

    const linkHtml = ev.link
      ? `<div class="cardDate">🔗 <a href="${escapeHtml(ev.link)}" target="_blank">Open Event Link</a></div>`
      : "";

    const pdfHtml = ev.pdfUrl
      ? `<div class="cardDate">📄 <a href="${FILE_BASE}${escapeHtml(ev.pdfUrl)}" target="_blank">View PDF</a></div>`
      : "";

    // ✅ ALLOW EDIT FOR BOTH CASES
    const canEdit = status === "HOD_PENDING" || status === "HOD_CHANGES_REQUIRED";

    card.innerHTML = `
      <div class="chip">${escapeHtml(ev.type)}</div>
      <h4 class="cardTitle">${escapeHtml(ev.title)}</h4>
      <div class="cardDept">${escapeHtml(ev.dept)}</div>
      <div class="cardDate">📅 <span>${escapeHtml(ev.date)}</span></div>
      ${locationHtml}
      ${timeHtml}
      ${durationHtml}
      ${linkHtml}
      ${pdfHtml}
      <p class="cardDesc">${escapeHtml(ev.desc)}</p>

      <div style="font-weight:900;margin-bottom:10px;">
     Status: <span>${escapeHtml(status)}</span><br>
     Approval Route: <span>${escapeHtml(ev.approvalRoute || "BOTH")}</span>
     ${hodRemarkHtml}
     ${principalRemarkHtml}
     </div>

      <div class="actions">
        ${canEdit ? `<button class="btn edit" data-edit="${ev.id}">Edit</button>` : ""}
      </div>
    `;

    cardsEl.appendChild(card);
  });

  cardsEl.querySelectorAll("[data-edit]").forEach(btn=>{
    btn.onclick = () => openEdit(btn.getAttribute("data-edit"));
  });
}
// ---- STATS + UPCOMING ----
function renderStats(){
  statTotal.textContent = events.length;
  statExam.textContent = events.filter(e=>String(e.type).toLowerCase()==="exam").length;
  statWorkshop.textContent = events.filter(e=>String(e.type).toLowerCase()==="workshop").length;
  statSeminar.textContent = events.filter(e=>String(e.type).toLowerCase()==="seminar").length;
}

function renderUpcoming(){
  const todayKey = ymd(new Date());
  const next = [...events]
    .filter(e=> String(e.date) >= todayKey && String((e.status||"PENDING")).toUpperCase()==="APPROVED")
    .sort((a,b)=> String(a.date).localeCompare(String(b.date)))[0];

  if(!next){
    upTitle.textContent = "No upcoming approved events";
    upMeta.textContent = "—";
    upDesc.textContent = "Once principal approves, upcoming event will appear here.";
    return;
  }

  upTitle.textContent = next.title;
  upMeta.textContent = `${next.dept} • ${next.type} • ${next.date}`;
  upDesc.textContent = next.desc;
}

// ---- ADD EVENT MODAL ----
function openAdd(){
  addOverlay.style.display = "flex";
  addDate.value = selectedDate || ymd(new Date());
  approvalRoute.value = "BOTH";
}
function closeAddModal(){
  addOverlay.style.display = "none";
  addTitle.value = "";
  addDept.value = "";
  addType.value = "";
  addDate.value = "";
  addLocation.value = "";
  addStartTime.value = "";
  addEndTime.value = "";
  addDurationText.value = "";
  addLink.value = "";
  addPdf.value = "";
  addDesc.value = "";
  approvalRoute.value = "BOTH";
}
addEventTop.onclick = openAdd;
closeAdd.onclick = closeAddModal;
cancelAdd.onclick = closeAddModal;
addOverlay.addEventListener("click", (e)=>{ if(e.target===addOverlay) closeAddModal(); });

// Create Event -> MongoDB + PDF upload
saveAddBtn.onclick = async () => {
  const title = addTitle.value.trim();
  const dept = addDept.value.trim();
  const type = addType.value.trim();
  const date = addDate.value;
  const location = addLocation.value.trim();
  const startTime = addStartTime.value;
  const endTime = addEndTime.value;
  const durationText = addDurationText.value.trim();
  const link = addLink.value.trim();
  const desc = addDesc.value.trim();
  const pdfFile = addPdf.files[0] || null;
  const route = approvalRoute.value;

  if(!title || !dept || !type || !date || !desc){
    alert("Title, department, type, date, and description are required.");
    return;
  }

  if (link && !isValidUrl(link)) {
    alert("Please enter a valid event link.");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("dept", dept);
  formData.append("type", type);
  formData.append("date", date);
  formData.append("location", location);
  formData.append("startTime", startTime);
  formData.append("endTime", endTime);
  formData.append("durationText", durationText);
  formData.append("link", link);
  formData.append("desc", desc);
  formData.append("createdBy", u.email || u.fullName);
  formData.append("approvalRoute", route);

  if (pdfFile) {
    formData.append("pdf", pdfFile);
  }

  try{
    await apiPostForm("/events", formData);
   alert(`✅ Event created successfully. Approval route: ${route}`);
    closeAddModal();
    await refresh();
  }catch(err){
    alert("❌ " + err.message);
  }
};

// ---- EDIT ----
// ---- EDIT ----
function openEdit(mongoId){
  const ev = events.find(e => e.id === mongoId);
  if(!ev) return;

  const status = String(ev.status || "PENDING").toUpperCase();

  // ✅ Allow edit for BOTH cases
  if(status !== "HOD_PENDING" && status !== "HOD_CHANGES_REQUIRED"){
    alert("Only editable events (Pending or HOD Changes Required).");
    return;
  }

  editingMongoId = mongoId;
  editTitle.value = ev.title || "";
  editDept.value = ev.dept || "";
  editType.value = ev.type || "";
  editDate.value = ev.date || "";
  editLocation.value = ev.location || "";
  editStartTime.value = ev.startTime || "";
  editEndTime.value = ev.endTime || "";
  editDurationText.value = ev.durationText || "";
  editLink.value = ev.link || "";
  editDesc.value = ev.desc || "";

  editOverlay.style.display = "flex";
}

function closeEditModal(){
  editOverlay.style.display = "none";
  editingMongoId = null;
  editTitle.value = "";
  editDept.value = "";
  editType.value = "";
  editDate.value = "";
  editLocation.value = "";
  editStartTime.value = "";
  editEndTime.value = "";
  editDurationText.value = "";
  editLink.value = "";
  editPdf.value = "";
  editDesc.value = "";
}
closeEdit.onclick = closeEditModal;
cancelEdit.onclick = closeEditModal;
editOverlay.addEventListener("click", (e)=>{ if(e.target===editOverlay) closeEditModal(); });

// Edit pending event
saveEditBtn.onclick = async () => {
  if (!editingMongoId) return;

  const title = editTitle.value.trim();
  const dept = editDept.value.trim();
  const type = editType.value.trim();
  const date = editDate.value;
  const location = editLocation.value.trim();
  const startTime = editStartTime.value;
  const endTime = editEndTime.value;
  const durationText = editDurationText.value.trim();
  const link = editLink.value.trim();
  const desc = editDesc.value.trim();
  const pdfFile = editPdf.files[0] || null;

  if(
  !title ||
  !dept ||
  !type ||
  !date ||
  !location ||
  !startTime ||
  !endTime ||
  !durationText ||
  !desc
){
  alert("Please fill all required fields. Link and PDF are optional.");
  return;
}

  if (link && !isValidUrl(link)) {
    alert("Please enter a valid event link.");
    return;
  }

  const formData = new FormData();
  formData.append("title", title);
  formData.append("dept", dept);
  formData.append("type", type);
  formData.append("date", date);
  formData.append("location", location);
  formData.append("startTime", startTime);
  formData.append("endTime", endTime);
  formData.append("durationText", durationText);
  if (link) {
  formData.append("link", link);
}
  formData.append("desc", desc);

  if (pdfFile) {
    formData.append("pdf", pdfFile);
  }

  try{
    await apiPutForm(`/events/${editingMongoId}`, formData);
    alert("✅ Event updated successfully.");
    closeEditModal();
    await refresh();
  }catch(err){
    alert("❌ " + err.message);
  }
};

// ---- MAIN RENDER ----
function renderAllUI(){
  renderFilters();
  renderCalendar();
  renderStats();
  renderUpcoming();
  renderEvents();
}

async function refresh(){
  await loadEventsFromDB();
  renderAllUI();
}
downloadSemPdfBtn?.addEventListener("click", async () => {
  const year = pdfSemYear.value.trim();
  const semester = pdfSemester.value;
  const dept = pdfDept.value.trim();

  if (!year) {
    alert("Please enter semester report year.");
    return;
  }

  if (!/^\d{4}$/.test(year)) {
    alert("Please enter a valid 4-digit year.");
    return;
  }

  if (!semester) {
    alert("Please select semester.");
    return;
  }

  if (!dept) {
    alert("Please choose department.");
    return;
  }

  try {
    const token = localStorage.getItem("campusOrbit_token_v1") || "";

    const res = await fetch(
      `${API}/events/semester-pdf?year=${encodeURIComponent(year)}&semester=${encodeURIComponent(semester)}&dept=${encodeURIComponent(dept)}`,
      {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to download semester PDF");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `semester_${semester}_${dept}_${year}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("❌ " + err.message);
  }
});
downloadYearPdfBtn?.addEventListener("click", async () => {
  const year = pdfYear.value.trim();

  if (!year) {
    alert("Please enter a year.");
    return;
  }

  if (!/^\d{4}$/.test(year)) {
    alert("Please enter a valid 4-digit year.");
    return;
  }

  try {
    const token = localStorage.getItem("campusOrbit_token_v1") || "";

    const res = await fetch(
      `${API}/events/yearly-pdf?year=${encodeURIComponent(year)}`,
      {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to download yearly PDF");
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `yearly_events_${year}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("❌ " + err.message);
  }
});
// Init
refresh().catch(err => {
  console.error(err);
  alert("Backend not reachable. Start Go server: go run main.go");
});