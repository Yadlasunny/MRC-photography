// Footer year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Nav: transparent over hero, solid + blurred once scrolled past it
const nav = document.querySelector(".site-nav");
const hero = document.querySelector(".hero");

function updateNavState() {
  const threshold = hero.offsetHeight * 0.6;
  nav.classList.toggle("is-scrolled", window.scrollY > threshold);
}

window.addEventListener("scroll", updateNavState, { passive: true });
updateNavState();

// Mobile nav: hamburger toggle opens/closes the link dropdown
const navToggle = document.getElementById("nav-toggle");
const navLinks = document.getElementById("nav-links");

function closeNav() {
  navLinks.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
}

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));

document.addEventListener("click", (e) => {
  if (!navLinks.classList.contains("is-open")) return;
  if (navLinks.contains(e.target) || navToggle.contains(e.target)) return;
  closeNav();
});

// Hero viewfinder corners: snap inward like an autofocus lock, then settle
const heroFrame = document.querySelector(".hero-frame");
if (heroFrame) {
  requestAnimationFrame(() => {
    setTimeout(() => heroFrame.classList.add("is-locked"), 250);
  });
}

// Hero background: swap to the real photo once it exists, keep the gradient as fallback
const heroPhoto = new Image();
heroPhoto.onload = () => {
  hero.style.setProperty("--hero-photo", `url('/assets/images/hero.jpg')`);
  hero.classList.add("has-photo");
};
heroPhoto.src = "/assets/images/hero.jpg";

// ---- Gallery ----
const galleryGrid = document.getElementById("gallery-grid");
const galleryEmpty = document.getElementById("gallery-empty");
const galleryFilters = document.getElementById("gallery-filters");

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

function buildFallback(item, entry) {
  const fallback = document.createElement("div");
  fallback.className = "gallery-fallback";
  fallback.innerHTML = `
    <div class="viewfinder-box">
      <span class="vf-corner tl"></span>
      <span class="vf-corner tr"></span>
      <span class="vf-corner bl"></span>
      <span class="vf-corner br"></span>
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="4" fill="currentColor" stroke="none"/></svg>
    </div>
    <span class="fallback-text">${entry.categoryLabel} - Photo coming soon</span>
  `;
  item.appendChild(fallback);
  item.classList.add("img-missing");
}

function applyActiveFilter() {
  const activeFilter = galleryFilters.querySelector(".filter-btn.active")?.dataset.filter || "all";
  galleryGrid.querySelectorAll(".gallery-item").forEach((item) => {
    const matches = activeFilter === "all" || item.dataset.category === activeFilter;
    item.classList.toggle("is-hidden", !matches);
  });
}

function addFilterButton(key, label) {
  const button = document.createElement("button");
  button.className = "filter-btn";
  button.dataset.filter = key;
  button.textContent = label;
  button.addEventListener("click", () => {
    galleryFilters.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    applyActiveFilter();
  });
  galleryFilters.appendChild(button);
}

async function loadCategoryFilters() {
  try {
    const res = await fetch("/api/gallery/categories");
    const categories = await res.json();
    Object.entries(categories).forEach(([key, label]) => addFilterButton(key, label));
  } catch (err) {
    console.error("Could not load categories", err);
  }
}

function renderGallery(entries) {
  galleryGrid.querySelectorAll(".gallery-item").forEach((el) => el.remove());
  galleryEmpty.hidden = entries.length > 0;

  entries.forEach((entry, index) => {
    const item = document.createElement("div");
    item.className = "gallery-item";
    item.dataset.category = entry.category;
    item.dataset.id = entry.id;

    const img = document.createElement("img");
    img.src = entry.url;
    img.alt = entry.alt;
    img.loading = "lazy";
    img.addEventListener("error", () => buildFallback(item, entry), { once: true });

    const caption = document.createElement("span");
    caption.className = "gallery-caption";
    caption.innerHTML = `<span class="idx">${String(index + 1).padStart(2, "0")}</span>${entry.categoryLabel}`;

    item.appendChild(img);
    item.appendChild(caption);
    galleryGrid.appendChild(item);
    revealObserver.observe(item);
  });

  applyActiveFilter();
}

async function loadGallery() {
  try {
    const res = await fetch("/api/gallery");
    const entries = await res.json();
    renderGallery(entries);
  } catch (err) {
    console.error("Could not load gallery", err);
  }
}

galleryFilters.querySelector('[data-filter="all"]').addEventListener("click", (e) => {
  galleryFilters.querySelectorAll(".filter-btn").forEach((btn) => btn.classList.remove("active"));
  e.target.classList.add("active");
  applyActiveFilter();
});

loadCategoryFilters().then(loadGallery);
