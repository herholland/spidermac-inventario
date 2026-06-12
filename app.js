// ================================================
// SpiderMac Inventario — app.js
// ================================================

const API = "https://script.google.com/macros/s/AKfycbyBObCv3vWy6XVWUalilYHUC5QjbbrDfTO6htblnGOhkxIm3JBUgcu1mnL0sQ37OYfR-A/exec";

const CATS = [
  "Pantallas","Bisel","Batería","Placa","Top Case","Trackpad",
  "Touch Bar","PDC / Carga","Flex","Ventilador","Audio",
  "Huella / Botones","Adaptadores Disco","Discos SSD/NVMe",
  "Memoria RAM","Wifi / BT","Accesorios","Tornillos / Gomas",
  "Componentes SMD","Consolas"
];

const CAT_COLORS = {
  "Pantallas":        {bg:"#E6F1FB",color:"#185FA5"},
  "Bisel":            {bg:"#EEEDFE",color:"#3C3489"},
  "Batería":          {bg:"#EAF3DE",color:"#3B6D11"},
  "Placa":            {bg:"#FAEEDA",color:"#854F0B"},
  "Top Case":         {bg:"#FAECE7",color:"#993C1D"},
  "Trackpad":         {bg:"#FBEAF0",color:"#72243E"},
  "Touch Bar":        {bg:"#E1F5EE",color:"#085041"},
  "PDC / Carga":      {bg:"#FCEBEB",color:"#791F1F"},
  "Flex":             {bg:"#F1EFE8",color:"#444441"},
  "Ventilador":       {bg:"#E1F5EE",color:"#0F6E56"},
  "Audio":            {bg:"#EEEDFE",color:"#534AB7"},
  "Huella / Botones": {bg:"#FAEEDA",color:"#633806"},
  "Adaptadores Disco":{bg:"#E6F1FB",color:"#0C447C"},
  "Discos SSD/NVMe":  {bg:"#EAF3DE",color:"#27500A"},
  "Memoria RAM":      {bg:"#FAECE7",color:"#712B13"},
  "Wifi / BT":        {bg:"#FBEAF0",color:"#4B1528"},
  "Accesorios":       {bg:"#F1EFE8",color:"#5F5E5A"},
  "Tornillos / Gomas":{bg:"#FAEEDA",color:"#412402"},
  "Componentes SMD":  {bg:"#EEEDFE",color:"#26215C"},
  "Consolas":         {bg:"#EAF3DE",color:"#173404"},
};

// ── STATE ──────────────────────────────────────────
let products      = [];
let currentPage   = "all";
let currentCat    = "";
let pendingSaves  = new Set(); // ids con cambios pendientes
let saveTimer     = null;

// ── INIT ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  registerSW();
  loadData();
});

function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

// ── API ────────────────────────────────────────────
async function loadData() {
  setSyncState("syncing", "Sincronizando...");
  try {
    const res  = await fetch(`${API}?action=getAll`, { cache: "no-store" });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    products = data.products.map(p => ({
      ...p,
      cantidad: Number(p.cantidad) || 0,
      minimo:   Number(p.minimo)   || 1,
    }));
    renderAll();
    setSyncState("ok", "Sincronizado");
    hideLoading();
  } catch (err) {
    setSyncState("err", "Sin conexión");
    hideLoading();
    toast("Error al conectar con Google Sheets", "err");
  }
}

async function saveAll() {
  setSyncState("syncing", "Guardando...");
  try {
    const res = await fetch(API, {
      method: "POST",
      body: JSON.stringify({ action: "save", products }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    pendingSaves.clear();
    setSyncState("ok", "Guardado ✓");
    toast("Guardado en Google Sheets", "ok");
  } catch (err) {
    setSyncState("err", "Error al guardar");
    toast("Error al guardar en Sheets", "err");
  }
}

// Guardar solo la cantidad de un producto (más rápido)
async function saveQty(id, cantidad) {
  try {
    await fetch(API, {
      method: "POST",
      body: JSON.stringify({ action: "updateQty", id, cantidad }),
    });
    setSyncState("ok", "Guardado ✓");
  } catch {
    setSyncState("err", "Error al guardar");
  }
}

// ── CRUD ───────────────────────────────────────────
function addProduct() {
  const nombre = document.getElementById("f-name").value.trim();
  if (!nombre) { toast("Ingresa un nombre", "err"); return; }

  const categoria = document.getElementById("f-cat").value;
  const cantidad  = parseInt(document.getElementById("f-qty").value)  || 0;
  const minimo    = parseInt(document.getElementById("f-min").value)   || 2;
  const costo     = document.getElementById("f-cost").value.trim();
  const precio    = document.getElementById("f-price").value.trim();

  const id = "p_" + Date.now();
  const p  = { id, nombre, categoria, cantidad, minimo, costo, precio };
  products.push(p);
  renderAll();
  clearForm();
  toggleForm();
  saveAll();
  toast(`"${nombre}" agregado`);
}

function changeQty(id, delta) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  p.cantidad = Math.max(0, p.cantidad + delta);
  renderTable();
  updateNavCounts();

  // Debounce: espera 1.5s sin cambios para guardar
  clearTimeout(saveTimer);
  setSyncState("syncing", "Por guardar...");
  saveTimer = setTimeout(() => saveQty(id, p.cantidad), 1500);
}

function deleteProduct(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
  products = products.filter(x => String(x.id) !== String(id));
  renderAll();
  saveAll();
  toast(`Eliminado: ${p.nombre.slice(0, 30)}`);
}

// ── RENDER ─────────────────────────────────────────
function getVisible() {
  let data = [...products];
  const q   = (document.getElementById("search")?.value || "").toLowerCase();
  const fs  = document.getElementById("f-status")?.value || "";
  const srt = document.getElementById("f-sort")?.value   || "nombre";

  if (currentPage === "alerts") data = data.filter(p => getStatus(p) !== "ok");
  if (currentCat)               data = data.filter(p => p.categoria === currentCat);
  if (q)  data = data.filter(p =>
    (p.nombre    || "").toLowerCase().includes(q) ||
    (p.categoria || "").toLowerCase().includes(q)
  );
  if (fs) data = data.filter(p => getStatus(p) === fs);

  if (srt === "nombre")   data.sort((a,b) => (a.nombre||"").localeCompare(b.nombre||""));
  if (srt === "qty-asc")  data.sort((a,b) => a.cantidad - b.cantidad);
  if (srt === "qty-desc") data.sort((a,b) => b.cantidad - a.cantidad);

  return data;
}

function renderAll() {
  renderTable();
  updateNavCounts();
}

function renderTable() {
  const data  = getVisible();
  const tbody = document.getElementById("tbody");
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty"><i class="ti ti-package-off"></i>No hay productos que coincidan</div></td></tr>`;
  } else {
    tbody.innerHTML = data.map(p => {
      const s   = getStatus(p);
      const slb = { ok:"En stock", low:"Stock bajo", out:"Sin stock" };
      const cc  = CAT_COLORS[p.categoria] || { bg:"#F1EFE8", color:"#444441" };
      return `<tr>
        <td style="font-weight:500;font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(p.nombre)}">${esc(p.nombre)}</td>
        <td><span class="cat-badge" style="background:${cc.bg};color:${cc.color}">${esc(p.categoria)}</span></td>
        <td>
          <div class="qty-ctrl">
            <button class="qty-btn" onclick="changeQty('${p.id}',-1)"><i class="ti ti-minus" style="font-size:11px"></i></button>
            <span class="qty-num">${p.cantidad}</span>
            <button class="qty-btn" onclick="changeQty('${p.id}',1)"><i class="ti ti-plus" style="font-size:11px"></i></button>
          </div>
        </td>
        <td style="font-size:11px;color:var(--text2)">${esc(p.costo||"—")}</td>
        <td style="font-size:11px">${esc(p.precio||"—")}</td>
        <td><span class="badge ${s}">${slb[s]}</span></td>
        <td><button class="btn danger sm" onclick="deleteProduct('${p.id}')"><i class="ti ti-trash"></i></button></td>
      </tr>`;
    }).join("");
  }

  // Stats
  const all = products;
  document.getElementById("s-total").textContent = data.length;
  document.getElementById("s-ok").textContent    = data.filter(p => getStatus(p) === "ok").length;
  document.getElementById("s-low").textContent   = data.filter(p => getStatus(p) === "low").length;
  document.getElementById("s-out").textContent   = data.filter(p => getStatus(p) === "out").length;
  document.getElementById("row-count").textContent = `${data.length} producto${data.length !== 1 ? "s" : ""}`;
}

function updateNavCounts() {
  document.getElementById("nc-all").textContent    = products.length;
  document.getElementById("nc-alerts").textContent = products.filter(p => getStatus(p) !== "ok").length;
  CATS.forEach(c => {
    const el = document.getElementById("nc-" + c);
    if (el) el.textContent = products.filter(p => p.categoria === c).length;
  });
}

// ── NAVIGATION ─────────────────────────────────────
function showPage(page) {
  currentPage = page;
  currentCat  = "";
  setActiveNav("nav-" + page);
  const titles = { all: "Todo el inventario", alerts: "⚠ Alertas de stock" };
  document.getElementById("page-title").textContent = titles[page] || page;
  renderTable();
  // mobile
  document.querySelectorAll(".mob-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("mob-" + page)?.classList.add("active");
}

function filterCat(cat) {
  currentPage = "cat";
  currentCat  = cat;
  setActiveNav("nav-" + cat);
  document.getElementById("page-title").textContent = cat;
  renderTable();
}

function setActiveNav(id) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

function showMobileCats() {
  const cat = prompt("Categoría:\n" + CATS.join("\n"));
  if (cat && CATS.includes(cat)) filterCat(cat);
}

// ── FORM ───────────────────────────────────────────
function toggleForm() {
  const f = document.getElementById("add-form");
  const open = f.style.display === "none" || f.style.display === "";
  f.style.display = open ? "block" : "none";
  if (open) {
    f.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("f-name").focus();
  }
}

function clearForm() {
  ["f-name","f-qty","f-min","f-cost","f-price","f-comp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

// ── HELPERS ────────────────────────────────────────
function getStatus(p) {
  const q = Number(p.cantidad) || 0;
  const m = Number(p.minimo)   || 1;
  if (q === 0)  return "out";
  if (q <= m)   return "low";
  return "ok";
}

function setSyncState(state, text) {
  const dot  = document.getElementById("sync-dot");
  const span = document.getElementById("sync-text");
  if (dot)  dot.className  = "sync-dot " + state;
  if (span) span.textContent = text;
}

function hideLoading() {
  const el = document.getElementById("loading");
  if (el) { el.classList.add("hidden"); setTimeout(() => el.remove(), 500); }
}

let toastTimer;
function toast(msg, type = "") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = "toast " + (type === "err" ? "err" : type === "ok" ? "ok" : "") + " show";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}
