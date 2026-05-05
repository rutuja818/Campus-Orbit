const API = "http://localhost:8000/api";

document.getElementById("adminLoginForm").addEventListener("submit", adminLogin);

async function adminLogin(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const messageBox = document.getElementById("message");

  messageBox.textContent = "Checking admin credentials...";
  messageBox.className = "message";

  try {
    const res = await fetch(`${API}/admin/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      messageBox.textContent = data.error || "Admin login failed";
      messageBox.className = "message error";
      return;
    }

    // save token and admin info
    localStorage.setItem("campusOrbit_token_v1", data.token);
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("campusOrbit_currentUser_v1", JSON.stringify(data.user));

    messageBox.textContent = "Login successful. Opening admin dashboard...";
    messageBox.className = "message success";

    setTimeout(() => {
      window.location.href = "admin.html";
    }, 900);

  } catch (err) {
    console.error("Admin login error:", err);
    messageBox.textContent = "Server error. Please try again.";
    messageBox.className = "message error";
  }
}

function goHome() {
  window.location.href = "home.html";
}