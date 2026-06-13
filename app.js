// ═══════════════════════════════════════════════════
//  SpiderMac Inventario — app.js  v2
// ═══════════════════════════════════════════════════

const API = "https://script.google.com/macros/s/AKfycbyBObCv3vWy6XVWUalilYHUC5QjbbrDfTO6htblnGOhkxIm3JBUgcu1mnL0sQ37OYfR-A/exec";

const CATS = [
  "Pantallas","Bisel","Batería","Placa","Top Case","Trackpad",
  "Touch Bar","PDC / Carga","Flex","Ventilador","Audio",
  "Huella / Botones","Adaptadores Disco","Discos SSD/NVMe",
  "Memoria RAM","Wifi / BT","Accesorios","Tornillos / Gomas",
  "Componentes SMD","Consolas"
];

const MODELS = [
  "A2338","A2337","A2289","A2251","A2179","A2159","A2141",
  "A1990","A1989","A1932","A1708","A1707","A1706","A1534",
  "A1502","A1466","A1465","A1425","A1398","A1370","A1369",
  "A1297","A1286","A1278"
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
let products     = [];
let currentPage  = "all";
let currentCat   = "";
let currentModel = "";
let editingId    = null;
let saveTimer    = null;
let modalTags    = [];
let recentSearches = JSON.parse(localStorage.getItem("sm_recent") || "[]");

// ── INIT ───────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  setupTagInput();
  setupSplashSearch();
  loadData();
});

// ── SPLASH SEARCH ──────────────────────────────────
function setupSplashSearch() {
  const inp = document.getElementById("splash-search");
  if (!inp) return;
  inp.addEventListener("keydown", e => {
    if (e.key === "Enter") {
      const q = inp.value.trim();
      if (q) enterApp(q);
      else enterApp("");
    }
  });
  inp.addEventListener("input", () => {
    showSplashSuggestions(inp.value);
  });
  renderSplashSuggestions();
}

function renderSplashSuggestions() {
  const box = document.getElementById("splash-suggestions");
  if (!box) return;
  const items = recentSearches.slice(0, 5);
  if (!items.length) { box.style.display = "none"; return; }
  box.style.display = "block";
  box.innerHTML = `<div class="sugg-label">Búsquedas recientes</div>` +
    items.map(s => `<div class="sugg-item" onclick="splashPick('${esc(s)}')">${esc(s)}</div>`).join("");
}

function showSplashSuggestions(q) {
  const box = document.getElementById("splash-suggestions");
  if (!box) return;
  if (!q) { renderSplashSuggestions(); return; }
  const matches = products
    .filter(p => (p.nombre||"").toLowerCase().includes(q.toLowerCase()) ||
                 (p.modelos||"").toLowerCase().includes(q.toLowerCase()))
    .slice(0, 6)
    .map(p => p.nombre);
  if (!matches.length) { box.style.display = "none"; return; }
  box.style.display = "block";
  box.innerHTML = `<div class="sugg-label">Productos</div>` +
    matches.map(s => `<div class="sugg-item" onclick="splashPick('${esc(s)}')">${esc(s)}</div>`).join("");
}

function splashPick(val) {
  document.getElementById("splash-search").value = val;
  enterApp(val);
}

function enterApp(query) {
  if (query) {
    addRecentSearch(query);
    document.getElementById("search").value = query;
  }
  const splash = document.getElementById("splash");
  splash.classList.add("hide");
  document.getElementById("app").style.visibility = "visible";
  setTimeout(() => { splash.style.display = "none"; }, 500);
  if (query) renderTable();
}

function addRecentSearch(q) {
  recentSearches = [q, ...recentSearches.filter(s => s !== q)].slice(0, 8);
  try { localStorage.setItem("sm_recent", JSON.stringify(recentSearches)); } catch {}
}

// ── API ────────────────────────────────────────────
async function loadData() {
  setSyncState("syncing", "Sincronizando...");
  setSplashStatus("syncing", "Cargando inventario...");
  try {
    const res  = await fetch(`${API}?action=getAll`, { cache: "no-store" });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    products = data.products.map(p => ({
      ...p,
      cantidad: Number(p.cantidad) || 0,
      minimo:   Number(p.minimo)   || 1,
      modelos:  p.modelos || "",
    }));
    renderAll();
    setSyncState("ok", "Sincronizado");
    setSplashStatus("ok", `${products.length} productos listos`);
    showSplashSuggestions(document.getElementById("splash-search")?.value || "");
  } catch (err) {
    setSyncState("err", "Sin conexión");
    setSplashStatus("err", "Sin conexión — datos locales");
    toast("Error al conectar con Google Sheets", "err");
  }
}

function setSplashStatus(state, text) {
  const dot  = document.getElementById("splash-dot");
  const span = document.getElementById("splash-status-text");
  if (dot)  dot.className  = "splash-dot " + state;
  if (span) span.textContent = text;
}

async function saveAll() {
  setSyncState("syncing", "Guardando...");
  try {
    const res  = await fetch(API, {
      method: "POST",
      body: JSON.stringify({ action: "save", products }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    setSyncState("ok", "Guardado ✓");
    toast("Guardado en Google Sheets", "ok");
  } catch {
    setSyncState("err", "Error al guardar");
    toast("Error al guardar en Sheets", "err");
  }
}

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

// ── MODAL ──────────────────────────────────────────
function openAddModal() {
  editingId = null;
  modalTags = [];
  document.getElementById("modal-title").textContent = "Agregar producto";
  document.getElementById("modal-delete-btn").style.display = "none";
  document.getElementById("m-nombre").value = "";
  document.getElementById("m-cat").value    = "Pantallas";
  document.getElementById("m-color").value  = "";
  document.getElementById("m-qty").value    = "";
  document.getElementById("m-min").value    = "2";
  document.getElementById("m-costo").value  = "";
  document.getElementById("m-precio").value = "";
  document.getElementById("m-comp").value   = "";
  renderTags();
  openModal("edit-modal");
}

function openEditModal(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  editingId = id;
  modalTags = p.modelos ? p.modelos.split(",").map(s => s.trim()).filter(Boolean) : [];
  document.getElementById("modal-title").textContent = "Editar producto";
  document.getElementById("modal-delete-btn").style.display = "";
  document.getElementById("m-nombre").value = p.nombre  || "";
  document.getElementById("m-cat").value    = p.categoria || "Pantallas";
  document.getElementById("m-color").value  = p.color   || "";
  document.getElementById("m-qty").value    = p.cantidad;
  document.getElementById("m-min").value    = p.minimo;
  document.getElementById("m-costo").value  = p.costo   || "";
  document.getElementById("m-precio").value = p.precio  || "";
  document.getElementById("m-comp").value   = p.competencia || "";
  renderTags();
  openModal("edit-modal");
}

function saveModal() {
  const nombre = document.getElementById("m-nombre").value.trim();
  if (!nombre) { toast("Ingresa un nombre", "err"); return; }

  const obj = {
    nombre,
    categoria:   document.getElementById("m-cat").value,
    color:       document.getElementById("m-color").value,
    cantidad:    parseInt(document.getElementById("m-qty").value)  || 0,
    minimo:      parseInt(document.getElementById("m-min").value)   || 2,
    costo:       document.getElementById("m-costo").value.trim(),
    precio:      document.getElementById("m-precio").value.trim(),
    competencia: document.getElementById("m-comp").value.trim(),
    modelos:     modalTags.join(", "),
  };

  if (editingId) {
    const idx = products.findIndex(x => String(x.id) === String(editingId));
    if (idx !== -1) products[idx] = { ...products[idx], ...obj };
    toast("Producto actualizado");
  } else {
    obj.id = "p_" + Date.now();
    products.push(obj);
    toast("Producto agregado");
  }

  closeEditModal();
  renderAll();
  saveAll();
}

function deleteFromModal() {
  if (!editingId) return;
  const p = products.find(x => String(x.id) === String(editingId));
  if (!confirm(`¿Eliminar "${p?.nombre}"?`)) return;
  products = products.filter(x => String(x.id) !== String(editingId));
  closeEditModal();
  renderAll();
  saveAll();
  toast("Producto eliminado");
}

// ── DETAIL MODAL ───────────────────────────────────
function openDetailModal(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  const cc = CAT_COLORS[p.categoria] || { bg:"#F1EFE8", color:"#444441" };
  const modTags = (p.modelos || "").split(",").map(s => s.trim()).filter(Boolean);

  document.getElementById("detail-body").innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
      <div style="width:48px;height:48px;border-radius:12px;background:${cc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <i class="ti ti-package" style="font-size:22px;color:${cc.color}"></i>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:4px;line-height:1.3">${esc(p.nombre)}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <span class="cat-badge" style="background:${cc.bg};color:${cc.color}">${esc(p.categoria)}</span>
          ${p.color ? `<span style="display:inline-block;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:600;background:var(--bg2);color:var(--text2)">${esc(p.color)}</span>` : ""}
        </div>
      </div>
    </div>

    ${modTags.length ? `
    <div style="margin-bottom:16px">
      <div class="detail-label">Modelos compatibles</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${modTags.map(m => `<span class="tag">${esc(m)}</span>`).join("")}
      </div>
    </div>` : ""}

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
      <div class="detail-card">
        <div class="detail-card-label">Stock actual</div>
        <div class="detail-card-value" style="color:${getStatus(p)==='ok'?'var(--green)':getStatus(p)==='low'?'var(--amber)':'var(--red)'}">${p.cantidad}</div>
        <div class="detail-card-sub">Mín: ${p.minimo}</div>
      </div>
      <div class="detail-card">
        <div class="detail-card-label">Precio venta</div>
        <div class="detail-card-value">${esc(p.precio||"—")}</div>
      </div>
      <div class="detail-card">
        <div class="detail-card-label">Estado</div>
        <div style="margin-top:4px">${statusBadge(p)}</div>
      </div>
    </div>

    <div style="background:var(--bg2);border-radius:var(--radius);padding:12px;margin-bottom:16px">
      <div class="detail-label" style="margin-bottom:10px">Información de costos</div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid var(--border)">
        <span style="font-size:13px;color:var(--text2)">Costo de compra</span>
        <span style="font-size:13px;font-weight:500;color:var(--text)">${esc(p.costo||"—")}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:0.5px solid var(--border)">
        <span style="font-size:13px;color:var(--text2)">Precio de venta</span>
        <span style="font-size:13px;font-weight:600;color:var(--green)">${esc(p.precio||"—")}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:6px 0">
        <span style="font-size:13px;color:var(--text2)">Precio competencia</span>
        <span style="font-size:13px;font-weight:500;color:var(--text)">${esc(p.competencia||"—")}</span>
      </div>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn primary" style="flex:1;justify-content:center" onclick="closeDetailModal();openEditModal('${p.id}')"><i class="ti ti-edit"></i>Editar</button>
      <button class="btn" style="justify-content:center" onclick="closeDetailModal();changeQty('${p.id}',1)"><i class="ti ti-plus"></i></button>
      <button class="btn" style="justify-content:center" onclick="closeDetailModal();changeQty('${p.id}',-1)"><i class="ti ti-minus"></i></button>
    </div>
  `;
  openModal("detail-modal");
}

function closeDetailModal() { closeModal2("detail-modal"); }
function closeEditModal()   { closeModal2("edit-modal"); }
function openModal(id) {
  document.getElementById(id).classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeModal2(id) {
  document.getElementById(id).classList.remove("show");
  document.body.style.overflow = "";
}
function closeModal(e) {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove("show");
    document.body.style.overflow = "";
  }
}

// ── FILTER MODAL (mobile) ──────────────────────────
function openMobileCats() {
  const body = document.getElementById("filter-modal-body");
  body.innerHTML = `
    <div class="form-section-label" style="padding:0 0 8px">Tipo de producto</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      ${CATS.map(c => {
        const cc = CAT_COLORS[c] || {bg:"#F1EFE8",color:"#5F5E5A"};
        const count = products.filter(p => p.categoria === c).length;
        return `<button onclick="filterCatMobile('${c}')" style="padding:6px 12px;border-radius:20px;border:0.5px solid ${cc.color}33;background:${cc.bg};color:${cc.color};font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">${c} <span style="opacity:.7">(${count})</span></button>`;
      }).join("")}
    </div>
    <div class="form-section-label" style="padding:0 0 8px">Modelo Mac</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">
      ${MODELS.map(m => {
        const count = products.filter(p => (p.modelos||"").includes(m) || (p.nombre||"").includes(m)).length;
        if (!count) return "";
        return `<button onclick="filterModelMobile('${m}')" style="padding:6px 12px;border-radius:20px;border:0.5px solid var(--border2);background:var(--bg2);color:var(--text2);font-size:12px;font-weight:600;cursor:pointer;font-family:inherit">${m} <span style="opacity:.7">(${count})</span></button>`;
      }).join("")}
    </div>
    <button class="btn" style="width:100%;justify-content:center" onclick="showPage('all');closeModal2('filter-modal')">Ver todo</button>
  `;
  openModal("filter-modal");
}

function filterCatMobile(cat) {
  filterCat(cat);
  closeModal2("filter-modal");
}
function filterModelMobile(m) {
  filterModel(m);
  closeModal2("filter-modal");
}
function closeFilterModal(e) {
  if (!e || e.target === e.currentTarget) closeModal2("filter-modal");
}

// ── TAG INPUT ──────────────────────────────────────
function setupTagInput() {
  const inp  = document.getElementById("tag-input");
  const sugg = document.getElementById("tag-suggestions");
  if (!inp) return;

  inp.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      const val = inp.value.trim().replace(/,/g, "").toUpperCase();
      if (val && !modalTags.includes(val)) { modalTags.push(val); renderTags(); }
      inp.value = "";
      sugg.style.display = "none";
    } else if (e.key === "Backspace" && !inp.value && modalTags.length) {
      modalTags.pop(); renderTags();
    }
  });

  inp.addEventListener("input", () => {
    const q = inp.value.trim().toUpperCase();
    if (!q) { sugg.style.display = "none"; return; }
    const hits = MODELS.filter(m => m.includes(q) && !modalTags.includes(m));
    if (!hits.length) { sugg.style.display = "none"; return; }
    sugg.style.display = "block";
    sugg.innerHTML = hits.map(m => `<div class="tag-sug-item" onmousedown="addTag('${m}')">${m}</div>`).join("");
  });

  inp.addEventListener("blur", () => setTimeout(() => { sugg.style.display = "none"; }, 150));
}

function addTag(val) {
  val = val.trim().toUpperCase();
  if (val && !modalTags.includes(val)) { modalTags.push(val); renderTags(); }
  document.getElementById("tag-input").value = "";
  document.getElementById("tag-suggestions").style.display = "none";
}

function removeTag(i) {
  modalTags.splice(i, 1);
  renderTags();
}

function renderTags() {
  const c = document.getElementById("tags-container");
  if (!c) return;
  c.innerHTML = modalTags.map((t, i) =>
    `<span class="tag">${esc(t)}<span class="del-tag" onclick="removeTag(${i})">×</span></span>`
  ).join("");
}

// ── CRUD ───────────────────────────────────────────
function changeQty(id, delta) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  p.cantidad = Math.max(0, p.cantidad + delta);
  renderTable(); updateNavCounts();
  clearTimeout(saveTimer);
  setSyncState("syncing", "Por guardar...");
  saveTimer = setTimeout(() => saveQty(id, p.cantidad), 1500);
}

// ── RENDER ─────────────────────────────────────────
function getVisible() {
  let data = [...products];
  const q   = (document.getElementById("search")?.value || "").toLowerCase();
  const fs  = document.getElementById("f-status")?.value || "";
  const srt = document.getElementById("f-sort")?.value   || "nombre";

  if (currentPage === "alerts") data = data.filter(p => getStatus(p) !== "ok");
  if (currentCat)               data = data.filter(p => p.categoria === currentCat);
  if (currentModel)             data = data.filter(p =>
    (p.modelos||"").includes(currentModel) || (p.nombre||"").includes(currentModel)
  );
  if (q) data = data.filter(p =>
    (p.nombre    ||"").toLowerCase().includes(q) ||
    (p.categoria ||"").toLowerCase().includes(q) ||
    (p.modelos   ||"").toLowerCase().includes(q) ||
    (p.color     ||"").toLowerCase().includes(q)
  );
  if (fs) data = data.filter(p => getStatus(p) === fs);
  if (srt === "nombre")   data.sort((a,b) => (a.nombre||"").localeCompare(b.nombre||""));
  if (srt === "qty-asc")  data.sort((a,b) => a.cantidad - b.cantidad);
  if (srt === "qty-desc") data.sort((a,b) => b.cantidad - a.cantidad);
  return data;
}

function renderAll() { renderTable(); updateNavCounts(); }

function renderTable() {
  const data  = getVisible();
  const tbody = document.getElementById("tbody");

  if (!data.length) {
    tbody.innerHTML = `<div class="empty"><i class="ti ti-package-off"></i>No hay productos que coincidan</div>`;
  } else {
    tbody.innerHTML = data.map((p, i) => {
      const s   = getStatus(p);
      const cc  = CAT_COLORS[p.categoria] || { bg:"#F1EFE8", color:"#444441" };
      const modTags = (p.modelos||"").split(",").map(x=>x.trim()).filter(Boolean).slice(0,3);
      const qtyColor = s==="ok" ? "var(--text)" : s==="low" ? "var(--amber)" : "var(--red)";
      const isLast = i === data.length - 1;

      // Initial letter avatar
      const initial = (p.nombre||"?")[0].toUpperCase();

      return `
      <div onclick="openDetailModal('${p.id}')"
        style="display:flex;align-items:center;gap:12px;padding:13px 14px;cursor:pointer;border-bottom:${isLast?"none":"0.5px solid var(--border)"};background:var(--bg);transition:background .1s"
        onmouseenter="this.style.background='var(--bg2)'" onmouseleave="this.style.background='var(--bg)'"
        ontouchstart="this.style.background='var(--bg2)'" ontouchend="this.style.background='var(--bg)'">

        <!-- Avatar -->
        <div style="width:40px;height:40px;border-radius:10px;background:${cc.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;font-weight:700;color:${cc.color}">${initial}</div>

        <!-- Info -->
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px">${esc(p.nombre)}</div>
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            <span class="cat-badge" style="background:${cc.bg};color:${cc.color}">${esc(p.categoria)}</span>
            ${p.precio ? `<span style="font-size:11px;color:var(--text2)">$/u: ${esc(p.precio)}</span>` : ""}
          </div>
        </div>

        <!-- Cantidad + estado -->
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0" onclick="event.stopPropagation()">
          <div style="text-align:center">
            <div style="font-size:20px;font-weight:700;color:${qtyColor};line-height:1">${p.cantidad}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:1px">${s==="ok"?"En stock":s==="low"?"Stock bajo":"Sin stock"}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px">
            <button class="qty-btn" onclick="changeQty('${p.id}',1)" style="width:30px;height:30px;border-radius:50%;border:none;background:var(--gl);color:var(--gd);cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none">
              <i class="ti ti-plus" style="font-size:14px"></i>
            </button>
            <button class="qty-btn" onclick="changeQty('${p.id}',-1)" style="width:30px;height:30px;border-radius:50%;border:none;background:var(--rl);color:var(--red);cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none">
              <i class="ti ti-minus" style="font-size:14px"></i>
            </button>
          </div>
          <!-- Edit + delete -->
          <div style="display:flex;flex-direction:column;gap:5px">
            <button onclick="openEditModal('${p.id}')" style="width:30px;height:30px;border-radius:8px;border:0.5px solid var(--border2);background:var(--bg2);color:var(--text2);cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none">
              <i class="ti ti-pencil" style="font-size:14px"></i>
            </button>
            <button onclick="if(confirm('¿Eliminar?')){deleteProduct('${p.id}')}" style="width:30px;height:30px;border-radius:8px;border:0.5px solid rgba(163,45,45,.25);background:var(--rl);color:var(--red);cursor:pointer;display:flex;align-items:center;justify-content:center;-webkit-appearance:none">
              <i class="ti ti-trash" style="font-size:14px"></i>
            </button>
          </div>
        </div>
      </div>`;
    }).join("");
  }

  document.getElementById("row-count").textContent = `${data.length} producto${data.length!==1?"s":""}`;
}

function deleteProduct(id) {
  products = products.filter(x => String(x.id) !== String(id));
  renderAll();
  saveAll();
  toast("Producto eliminado");
}

function updateNavCounts() {
  const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  safeSet("nc-all",    products.length);
  safeSet("nc-alerts", products.filter(p => getStatus(p) !== "ok").length);
  CATS.forEach(c => safeSet("nc-" + c, products.filter(p => p.categoria === c).length));
  MODELS.forEach(m => safeSet("nc-m-" + m,
    products.filter(p => (p.modelos||"").includes(m) || (p.nombre||"").includes(m)).length
  ));
}

// ── NAVIGATION ─────────────────────────────────────
function showPage(page) {
  currentPage = page; currentCat = ""; currentModel = "";
  setActiveNav("nav-" + page);
  const titles = { all: "Todo el inventario", alerts: "⚠ Alertas de stock" };
  document.getElementById("page-title").textContent = titles[page] || page;
  renderTable();
  document.querySelectorAll(".mob-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("mob-" + page)?.classList.add("active");
}

function filterCat(cat) {
  currentPage = "cat"; currentCat = cat; currentModel = "";
  setActiveNav("nav-" + cat);
  document.getElementById("page-title").textContent = cat;
  renderTable();
}

function filterModel(m) {
  currentPage = "model"; currentModel = m; currentCat = "";
  setActiveNav("nav-m-" + m);
  document.getElementById("page-title").textContent = "Modelo " + m;
  renderTable();
}

function setActiveNav(id) {
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
}

// ── HELPERS ────────────────────────────────────────
function getStatus(p) {
  const q = Number(p.cantidad) || 0, m = Number(p.minimo) || 1;
  return q === 0 ? "out" : q <= m ? "low" : "ok";
}

function statusBadge(p) {
  const s = getStatus(p);
  const l = { ok:"En stock", low:"Stock bajo", out:"Sin stock" };
  return `<span class="badge ${s}">${l[s]}</span>`;
}

function setSyncState(state, text) {
  const dot  = document.getElementById("sync-dot");
  const span = document.getElementById("sync-text");
  if (dot)  dot.className   = "sync-dot " + state;
  if (span) span.textContent = text;
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
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
