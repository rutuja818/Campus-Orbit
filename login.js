const API = "http://localhost:8000/api";

const LS_CURRENT = "campusOrbit_currentUser_v1";
const LS_TOKEN = "campusOrbit_token_v1";

// show/hide password
document.getElementById("togglePass").addEventListener("click", () => {
  const pass = document.getElementById("password");
  pass.type = pass.type === "password" ? "text" : "password";
});

// forgot password -> direct MongoDB update through backend
document.getElementById("forgotLink").addEventListener("click", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();

  if (!email) {
    alert("❌ Enter your registered email first");
    return;
  }

  const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!gmailPattern.test(email)) {
    alert("❌ Only @gmail.com email is allowed");
    return;
  }

  const newPassword = prompt("Enter new password (exactly 8 digits only):");
  if (!newPassword) return;

  const passwordPattern = /^\d{8}$/;
  if (!passwordPattern.test(newPassword)) {
    alert("❌ Password must be exactly 8 digits only");
    return;
  }

  try {
    const res = await fetch(`${API}/update-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        newPassword
      })
    });

    const data = await res.json();

    if (res.ok) {
      alert("✅ Password updated successfully. Now login.");
    } else {
      alert("❌ " + (data.error || "Failed to update password"));
    }
  } catch (error) {
    alert("❌ Server error");
  }
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert("❌ " + (data.error || "Login failed"));
      return;
    }

    localStorage.setItem(LS_CURRENT, JSON.stringify(data.user));
    localStorage.setItem(LS_TOKEN, data.token);

    const role = (data.user.role || "").toLowerCase();

    if (role === "staff") {
      window.location.href = "staff.html";
    }
    else if (role === "hod") {
      window.location.href = "hod.html";
    }
      else if (role === "principal") {
      window.location.href = "principal_approval.html";
    } else {
      window.location.href = "student.html";
    }
  } catch (error) {
    alert("❌ Server error during login");
  }
});