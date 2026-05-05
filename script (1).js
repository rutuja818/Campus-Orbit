function toggleMenu() {
  document.getElementById("navLinks").classList.toggle("active");
}

function scrollToRoles() {
  document.getElementById("roles").scrollIntoView({ behavior: "smooth" });
}

function loginRole(role) {
  showToast(role + " Login Selected");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.innerText = message;
  toast.style.display = "block";

  setTimeout(() => {
    toast.style.display = "none";
  }, 2000);
}