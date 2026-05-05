const API = "http://localhost:8000/api";

let roleChartInstance = null;
let eventStatusChartInstance = null;
let eventsDeptChartInstance = null;
let usersDeptChartInstance = null;

async function loadDashboard() {
  try {
    const token = localStorage.getItem("campusOrbit_token_v1");

    const res = await fetch(`${API}/admin/dashboard`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error("Failed to fetch dashboard data");
    }

    const data = await res.json();

    // ======================
    // TOP CARDS
    // ======================
    document.getElementById("totalUsers").textContent = data.totalUsers || 0;
    document.getElementById("totalEvents").textContent = data.totalEvents || 0;
    document.getElementById("pendingEvents").textContent = data.pendingEvents || 0;
    document.getElementById("approvedEvents").textContent = data.approvedEvents || 0;
    document.getElementById("rejectedEvents").textContent = data.rejectedEvents || 0;
    document.getElementById("totalReports").textContent = data.totalReports || 0;

    // ======================
    // CHARTS
    // ======================
    renderRoleChart(data.usersByRole || {});
    renderEventStatusChart(data);
    renderEventsDeptChart(data.eventsByDepartment || {});
    renderUsersDeptChart(data.usersByDepartment || {});

    // ======================
    // TABLES
    // ======================
    renderRecentUsers(data.recentUsers || []);
    renderRecentEvents(data.recentEvents || []);
    renderRecentReports(data.recentReports || []);

  } catch (error) {
    console.error("Dashboard load error:", error);
    alert("Unable to load admin dashboard.");
  }
}

function renderRoleChart(roleData) {
  const ctx = document.getElementById("roleChart");

  if (roleChartInstance) roleChartInstance.destroy();

  roleChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Student", "Staff", "HOD", "Principal", "Admin"],
      datasets: [{
        data: [
          roleData.Student || 0,
          roleData.Staff || 0,
          roleData.HOD || 0,
          roleData.Principal || 0,
          roleData.Admin || 0
        ],
        backgroundColor: [
          "#0b8f87",
          "#10b981",
          "#2563eb",
          "#f59e0b",
          "#d7263d"
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

function renderEventStatusChart(data) {
  const ctx = document.getElementById("eventStatusChart");

  if (eventStatusChartInstance) eventStatusChartInstance.destroy();

  eventStatusChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Pending", "Approved", "Rejected"],
      datasets: [{
        label: "Events",
        data: [
          data.pendingEvents || 0,
          data.approvedEvents || 0,
          data.rejectedEvents || 0
        ],
        backgroundColor: [
          "#f59e0b",
          "#10b981",
          "#d7263d"
        ],
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

function renderEventsDeptChart(deptData) {
  const ctx = document.getElementById("eventsDeptChart");

  if (eventsDeptChartInstance) eventsDeptChartInstance.destroy();

  eventsDeptChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: Object.keys(deptData),
      datasets: [{
        label: "Events",
        data: Object.values(deptData),
        backgroundColor: "#0b8f87",
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

function renderUsersDeptChart(deptData) {
  const ctx = document.getElementById("usersDeptChart");

  if (usersDeptChartInstance) usersDeptChartInstance.destroy();

  usersDeptChartInstance = new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(deptData),
      datasets: [{
        data: Object.values(deptData),
        backgroundColor: [
          "#0b8f87",
          "#10b981",
          "#2563eb",
          "#f59e0b",
          "#d7263d",
          "#8b5cf6",
          "#14b8a6"
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

function renderRecentUsers(users) {
  const body = document.getElementById("recentUsersBody");
  body.innerHTML = "";

  if (!users.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty">No users found</td></tr>`;
    return;
  }

  users.forEach(user => {
    body.innerHTML += `
      <tr>
        <td>${user.fullName || "-"}</td>
        <td>${user.email || "-"}</td>
        <td>${user.role || "-"}</td>
        <td>${user.department || "-"}</td>
      </tr>
    `;
  });
}

function renderRecentEvents(events) {
  const body = document.getElementById("recentEventsBody");
  body.innerHTML = "";

  if (!events.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty">No events found</td></tr>`;
    return;
  }

  events.forEach(event => {
    const statusClass = getStatusClass(event.status);

    body.innerHTML += `
      <tr>
        <td>${event.title || "-"}</td>
        <td>${event.dept || "-"}</td>
        <td>${event.date || "-"}</td>
        <td><span class="status ${statusClass}">${event.status || "-"}</span></td>
      </tr>
    `;
  });
}

function renderRecentReports(reports) {
  const body = document.getElementById("recentReportsBody");
  body.innerHTML = "";

  if (!reports.length) {
    body.innerHTML = `<tr><td colspan="4" class="empty">No reports found</td></tr>`;
    return;
  }

  reports.forEach(report => {
    body.innerHTML += `
      <tr>
        <td>${report.title || "-"}</td>
        <td>${report.dept || "-"}</td>
        <td>${report.createdBy || "-"}</td>
        <td>${report.date || "-"}</td>
      </tr>
    `;
  });
}

function getStatusClass(status) {
  const s = (status || "").toUpperCase();

  if (s === "PENDING") return "pending";
  if (s === "APPROVED") return "approved";
  if (s === "REJECTED") return "rejected";

  return "";
}

loadDashboard();