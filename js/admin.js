const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const logoutBtn = document.getElementById("logout-btn");

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

const uploadForm = document.getElementById("upload-form");
const uploadError = document.getElementById("upload-error");
const photoList = document.getElementById("photo-list");

const passwordForm = document.getElementById("password-form");
const passwordError = document.getElementById("password-error");
const passwordSuccess = document.getElementById("password-success");

document.querySelectorAll(".password-toggle").forEach((toggle) => {
  const input = toggle.previousElementSibling;
  toggle.addEventListener("click", () => {
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    toggle.setAttribute("aria-pressed", String(!isVisible));
    toggle.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
  });
});

const CATEGORY_LABELS = {
  wedding: "Wedding",
  birthday: "Birthday",
  "maternity-baby": "Maternity & Baby",
  modeling: "Modeling",
};

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  logoutBtn.hidden = false;
  loadPhotos();
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
  logoutBtn.hidden = true;
}

async function checkSession() {
  const res = await fetch("/api/session");
  const { authenticated } = await res.json();
  authenticated ? showDashboard() : showLogin();
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const formData = new FormData(loginForm);
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: formData.get("username"),
      password: formData.get("password"),
    }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Sign in failed." }));
    loginError.textContent = error;
    loginError.hidden = false;
    return;
  }

  loginForm.reset();
  showDashboard();
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  showLogin();
});

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadError.hidden = true;

  const formData = new FormData(uploadForm);
  const res = await fetch("/api/gallery", { method: "POST", body: formData });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Upload failed." }));
    uploadError.textContent = error;
    uploadError.hidden = false;
    return;
  }

  uploadForm.reset();
  loadPhotos();
});

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  passwordError.hidden = true;
  passwordSuccess.hidden = true;

  const formData = new FormData(passwordForm);
  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmPassword = formData.get("confirmPassword");

  if (newPassword !== confirmPassword) {
    passwordError.textContent = "New passwords do not match.";
    passwordError.hidden = false;
    return;
  }

  const res = await fetch("/api/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Could not update password." }));
    passwordError.textContent = error;
    passwordError.hidden = false;
    return;
  }

  passwordForm.reset();
  passwordSuccess.hidden = false;
});

function renderPhotoCard(entry) {
  const card = document.createElement("div");
  card.className = "admin-photo-card";
  card.innerHTML = `
    <img src="/assets/images/${entry.category}/${entry.filename}" alt="${entry.alt}" loading="lazy" />
    <div class="admin-photo-meta">
      <span class="admin-photo-category">${CATEGORY_LABELS[entry.category] || entry.category}</span>
      <button type="button" class="admin-delete-btn" data-id="${entry.id}">Delete</button>
    </div>
  `;

  card.querySelector(".admin-delete-btn").addEventListener("click", async () => {
    if (!confirm("Remove this photo from the gallery?")) return;
    await fetch(`/api/gallery/${entry.id}`, { method: "DELETE" });
    card.remove();
  });

  return card;
}

async function loadPhotos() {
  const res = await fetch("/api/gallery");
  const entries = await res.json();
  photoList.innerHTML = "";
  entries.forEach((entry) => photoList.appendChild(renderPhotoCard(entry)));
}

checkSession();
