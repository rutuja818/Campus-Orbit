const API = "http://localhost:8000/api";

// 👁 Show/Hide Password
document.getElementById("togglePass").addEventListener("click", () => {
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
});

// 🎯 Elements
const roleEl = document.getElementById("role");
const deptField = document.getElementById("deptField");
const deptSelect = document.getElementById("department");

// ✅ Show / hide department based on role
function toggleDept() {
  const role = roleEl.value;

  deptSelect.innerHTML = "";

  if (role === "Student") {
    deptField.style.display = "block";
    deptSelect.innerHTML = `
      <option value="GSE" selected>GSE</option>
      <option value="CSE">CSE</option>
      <option value="CIVIL">CIVIL</option>
      <option value="MECH">MECH</option>
      <option value="ELECT">ELECT</option>
      <option value="ENTC">ENTC</option>
    `;
  } else if (role === "Staff" || role === "HOD") {
    deptField.style.display = "block";
    deptSelect.innerHTML = `
      <option value="Central" selected>Central</option>
      <option value="GSE">GSE</option>
      <option value="CSE">CSE</option>
      <option value="CIVIL">CIVIL</option>
      <option value="MECH">MECH</option>
      <option value="ELECT">ELECT</option>
      <option value="ENTC">ENTC</option>
    `;
  } else {
    deptField.style.display = "none";
  }
}

toggleDept();
roleEl.addEventListener("change", toggleDept);

// 🔢 Allow only digits (max 8)
document.getElementById("password").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 8);
});

// 🚀 Submit Form
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();
  const role = document.getElementById("role").value;

  let department = "";

  if (role === "Student" || role === "Staff" || role === "HOD") {
    department = deptSelect.value;
  }

  const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!gmailPattern.test(email)) {
    alert("❌ Enter valid @gmail.com email");
    return;
  }

  const passwordPattern = /^\d{8}$/;
  if (!passwordPattern.test(password)) {
    alert("❌ Password must be exactly 8 digits");
    return;
  }

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        email,
        password,
        role,
        department
      }),
    });

    const data = await res.json();

    if (res.ok) {
      alert("✅ Registered Successfully!");
      window.location.href = "login.html";
    } else {
      alert("❌ " + (data.error || "Registration failed"));
    }
  } catch (err) {
    alert("❌ Server error");
  }
});