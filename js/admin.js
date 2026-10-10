import { upload } from "@vercel/blob/client";

const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const logoutBtn = document.getElementById("logout-btn");

const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");

const categoryList = document.getElementById("category-list");
const categoryForm = document.getElementById("category-form");
const categoryError = document.getElementById("category-error");

const uploadForm = document.getElementById("upload-form");
const uploadError = document.getElementById("upload-error");
const uploadCategorySelect = document.getElementById("upload-category");
const photoList = document.getElementById("photo-list");

document.querySelectorAll(".password-toggle").forEach((toggle) => {
  const input = toggle.previousElementSibling;
  toggle.addEventListener("click", () => {
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    toggle.setAttribute("aria-pressed", String(!isVisible));
    toggle.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
  });
});

// Populated from the server on load; photo cards and the upload dropdown
// both read category labels/counts from here.
let categories = {};
let galleryEntries = [];

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  logoutBtn.hidden = false;
  loadAll();
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

categoryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  categoryError.hidden = true;

  const formData = new FormData(categoryForm);
  const label = formData.get("label");

  const res = await fetch("/api/gallery/categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label }),
  });

  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Could not add category." }));
    categoryError.textContent = error;
    categoryError.hidden = false;
    return;
  }

  categoryForm.reset();
  await loadCategories();
});

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  uploadError.hidden = true;

  const formData = new FormData(uploadForm);
  const file = formData.get("photo");
  const category = formData.get("category");
  const alt = formData.get("alt");

  if (!file || !file.size) {
    uploadError.textContent = "Photo file is required.";
    uploadError.hidden = false;
    return;
  }

  try {
    // Uploaded directly from the browser to Blob storage (not through this
    // server), so a full-quality photo never hits the request-size limit
    // a serverless function would otherwise enforce.
    const blob = await upload(`images/${category}/${file.name}`, file, {
      access: "public",
      handleUploadUrl: "/api/blob-upload",
      clientPayload: JSON.stringify({ category }),
    });

    const res = await fetch("/api/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: blob.url, category, alt }),
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Upload failed." }));
      uploadError.textContent = error;
      uploadError.hidden = false;
      return;
    }
  } catch (err) {
    uploadError.textContent = err.message || "Upload failed.";
    uploadError.hidden = false;
    return;
  }

  uploadForm.reset();
  loadPhotos();
});

function renderCategoryList() {
  categoryList.innerHTML = "";

  Object.entries(categories).forEach(([key, label]) => {
    const count = galleryEntries.filter((entry) => entry.category === key).length;

    const chip = document.createElement("li");
    chip.className = "admin-category-chip";
    chip.innerHTML = `
      <span>${label}</span>
      <span class="admin-category-count">${count}</span>
      <button type="button" class="admin-category-remove" data-key="${key}" aria-label="Delete category ${label}">&times;</button>
    `;

    chip.querySelector(".admin-category-remove").addEventListener("click", async () => {
      if (!confirm(`Delete the "${label}" category?`)) return;

      const res = await fetch(`/api/gallery/categories/${key}`, { method: "DELETE" });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Could not delete category." }));
        categoryError.textContent = error;
        categoryError.hidden = false;
        return;
      }
      categoryError.hidden = true;
      await loadCategories();
    });

    categoryList.appendChild(chip);
  });
}

function renderCategorySelect() {
  const previous = uploadCategorySelect.value;
  uploadCategorySelect.innerHTML = "";

  Object.entries(categories).forEach(([key, label]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = label;
    uploadCategorySelect.appendChild(option);
  });

  if (previous && categories[previous]) uploadCategorySelect.value = previous;
}

async function loadCategories() {
  const res = await fetch("/api/gallery/categories");
  categories = await res.json();
  renderCategorySelect();
  renderCategoryList();
}

function renderPhotoCard(entry) {
  const card = document.createElement("div");
  card.className = "admin-photo-card";
  card.innerHTML = `
    <img src="${entry.url}" alt="${entry.alt}" loading="lazy" />
    <div class="admin-photo-meta">
      <span class="admin-photo-category">${categories[entry.category] || entry.category}</span>
      <button type="button" class="admin-delete-btn" data-id="${entry.id}">Delete</button>
    </div>
  `;

  card.querySelector(".admin-delete-btn").addEventListener("click", async () => {
    if (!confirm("Remove this photo from the gallery?")) return;
    await fetch(`/api/gallery/${entry.id}`, { method: "DELETE" });
    card.remove();
    galleryEntries = galleryEntries.filter((item) => item.id !== entry.id);
    renderCategoryList();
  });

  return card;
}

async function loadPhotos() {
  const res = await fetch("/api/gallery");
  galleryEntries = await res.json();
  photoList.innerHTML = "";
  galleryEntries.forEach((entry) => photoList.appendChild(renderPhotoCard(entry)));
  renderCategoryList();
}

async function loadAll() {
  await loadCategories();
  await loadPhotos();
}

checkSession();
