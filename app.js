const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

// Éléments du DOM
const elSearch = document.getElementById("search");
const elSearchBtn = document.getElementById("searchValidate");
const elDept = document.getElementById("dept");
const elPractice = document.getElementById("practice");
const elCoachLevel = document.getElementById("coachLevel");
const elStats = document.getElementById("stats");
const elList = document.getElementById("list");
const elPanelBtn = document.getElementById("panelBtn");
const elSidebar = document.querySelector(".sidebar");
const elOverlay = document.getElementById("overlay");
const elClusterToggle = document.getElementById("clusterToggle");

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 1. FONCTIONS DE RENDU VISUEL (POPUP & ICONS) **/

function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  return `<img src="assets/label_${key}.png" alt="${esc(label)}" 
          style="height: 22px; width: auto; margin-left: 8px; vertical-align: middle; flex-shrink: 0;" />`;
}

function pieSvg(pct, color = "#2563eb", size = 40, showText = true){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  return `
  <svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display: block;">
    <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="8"></circle>
    <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
    ${showText ? `<text x="28" y="32" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">${Math.round(p)}%</text>` : ''}
  </svg>`;
}

function renderEntraineurs(c) {
  if (!c.entraineurs || !c.entraineurs.length) return `<div style="color: #64748b; font-style: italic; font-size: 11px;">Aucun entraîneur recensé.</div>`;
  return `<ul style="margin: 0; padding-left: 18px; font-size: 11px; color: #334155;">
    ${c.entraineurs.map(e => `<li>${esc(e.nom)} <span style="color:#64748b">(${esc(e.diplome)})</span></li>`).join("")}
  </ul>`;
}

function makePopupHtml(c){
  const logo = c.logo_url 
    ? `<img src="${esc(c.logo_url)}" onerror="this.src='assets/logo_placeholder.svg';" style="width: 45px; height: 45px; object-fit: contain; border-radius: 4px; background: #f1f5f9;" />` 
    : `<div style="width: 45px; height: 45px; border-radius: 4px; background: #f1f5f9;"></div>`;

  return `
  <div style="width: 300px; font-family: sans-serif; color: #1e293b;">
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
      ${logo}
      <div style="min-width: 0; flex: 1;">
        <div style="display: flex; align-items: center;">
          <strong style="font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.nom)}</strong>
          ${labelBadge(c.label_club)}
        </div>
        <div style="font-size: 11px; color: #64748b;">${esc(c.ville)} (${c.cp})</div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 8px;">
      <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
        <div style="font-size:9px; color:#64748b;">TOTAL</div>
        <div style="font-weight:bold; font-size:13px;">${c.licences_total}</div>
      </div>
      <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
        <div style="font-size:9px; color:#64748b;">JEUNES</div>
        <div style="font-weight:bold; font-size:13px;">${Math.round(c.pourcentage_jeunes)}%</div>
      </div>
      <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
        <div style="font-size:9px; color:#64748b;">PARA</div>
        <div style="font-weight:bold; font-size:13px;">${(c.pct_para || 0).toFixed(1)}%</div>
      </div>
    </div>
    <div style="max-height: 100px; overflow-y: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; margin-top:5px;">
      <div style="font-size: 10px; font-weight: bold; margin-bottom: 4px; color: #475569; text-transform:uppercase;">Entraîneurs</div>
      ${renderEntraineurs(c)}
    </div>
    <div style="margin-top: 10px; text-align: center;">
       <a href="mailto:${esc(c.email)}" style="font-size:11px; color:#2563eb; text-decoration:none; font-weight:bold;">Contacter le club</a>
    </div>
  </div>`;
}

/** 2. LOGIQUE DE LA CARTE **/

function getColorForMode(mode) {
    switch(mode) {
        case "femmes": return "#ec4899"; 
        case "para": return "#10b981";    
        case "jeunes": return "#3b82f6"; 
        default: return "#2563eb";      
    }
}

function valueForMode(c){
  if(displayMode==="femmes") return Number(c.pct_femmes||0);
  if(displayMode==="para") return Number(c.pct_para||0);
  if(displayMode==="jeunes") return Number(c.pourcentage_jeunes||0);
  return Number(c.licences_total||0);
}

function createMarker(c) {
    const mainColor = getColorForMode(displayMode);
    const baseRadius = 10 + Math.sqrt(Number(c.licences_total || 0)) * 1.5;

    if (displayMode === "licences") {
        return L.circleMarker([c.lat, c.lng], {
            radius: baseRadius, weight: 2, color: "#fff", fillColor: mainColor, fillOpacity: 0.8
        });
    } else {
        const pct = valueForMode(c);
        const size = Math.max(30, baseRadius * 1.8);
        const icon = L.divIcon({
            html: `<div style="transform: translate(-15%, -15%);">${pieSvg(pct, mainColor, size, true)}</div>`,
            className: 'marker-pie', iconSize: [size, size]
        });
        return L.marker([c.lat, c.lng], { icon: icon });
    }
}

/** 3. FILTRES ET ACTIONS **/

function applyFilters(){
  const q = elSearch.value.toLowerCase().trim();
  const dept = elDept.value;
  const practice = elPractice.value;
  const coachLvl = elCoachLevel.value;

  filtered = clubs.filter(c => {
    // RECHERCHE PAR NOM, VILLE OU CP
    const searchStr = `${c.nom} ${c.ville} ${c.cp}`.toLowerCase();
    const okQ = !q || searchStr.includes(q);
    const okDept = !dept || c.departement === dept;
    const okPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
    const okCoach = !coachLvl || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === coachLvl));
    return okQ && okDept && okPrac && okCoach;
  });

  renderAll();
}

function renderMarkers(){
  clustersLayer.clearLayers();
  plainLayer.clearLayers();
  filtered.forEach(c => {
    const m = createMarker(c);
    m.bindPopup(makePopupHtml(c));
    if(elClusterToggle.checked && displayMode === "licences") clustersLayer.addLayer(m);
    else plainLayer.addLayer(m);
  });
}

function renderList(){
  const top = filtered.sort((a,b) => b.licences_total - a.licences_total).slice(0, 15);
  elList.innerHTML = top.map(c => `
    <div class="list-item" onclick="zoomTo(${c.lat}, ${c.lng})" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
        <div style="font-weight:bold; font-size:12px;">${esc(c.nom)}</div>
        <div style="font-size:11px; color:#64748b;">${esc(c.ville)} - ${c.licences_total} licenciés</div>
    </div>`).join("");
}

window.zoomTo = (lat, lng) => {
    map.setView([lat, lng], 13);
    if(window.innerWidth <= 1024) closeMobile();
};

function closeMobile() {
    elSidebar.classList.remove("open");
    elOverlay.classList.remove("show");
    elPanelBtn.textContent = "📊 Liste & Filtres";
}

function renderAll() {
    renderMarkers();
    renderList();
    elStats.innerHTML = `<strong>${filtered.length}</strong> clubs affichés`;
}

/** 4. INITIALISATION **/

async function loadData() {
    const res = await fetch("./clubs.json");
    const data = await res.json();
    clubs = data.map(c => ({
        ...c, lat: Number(c.lat), lng: Number(c.lon || c.lng),
        licences_total: Number(c.licences_total || 0),
        pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
        pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
        niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : [],
        entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : []
    }));

    // Remplir les selects dynamiquement
    const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
    elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
    
    const practices = [...new Set(clubs.flatMap(c => c.pratiques))].filter(Boolean).sort();
    elPractice.innerHTML = `<option value="">Toutes pratiques</option>` + practices.map(p => `<option value="${p}">${p}</option>`).join("");

    const coachs = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();
    elCoachLevel.innerHTML = `<option value="">Tous les diplômes</option>` + coachs.map(l => `<option value="${l}">${l}</option>`).join("");

    applyFilters();
}

function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);

    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // Bouton Localisation
    const b = document.createElement('button');
    b.className = 'btn-locate'; b.innerHTML = '📍';
    document.body.appendChild(b);
    b.onclick = () => map.locate({setView: true, maxZoom: 12});

    // Événements
    elSearchBtn.onclick = () => { applyFilters(); if(window.innerWidth <= 1024) closeMobile(); };
    elSearch.onkeypress = (e) => { if(e.key === "Enter") { applyFilters(); if(window.innerWidth <= 1024) closeMobile(); } };
    
    [elDept, elPractice, elCoachLevel, elClusterToggle].forEach(el => el.onchange = applyFilters);

    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    elPanelBtn.onclick = () => {
        const open = elSidebar.classList.toggle("open");
        elOverlay.classList.toggle("show");
        elPanelBtn.textContent = open ? "✖ Fermer" : "📊 Liste & Filtres";
    };

    document.getElementById("reset").onclick = () => {
        elSearch.value = ""; elDept.value = ""; elPractice.value = ""; elCoachLevel.value = "";
        applyFilters();
    };

    loadData();
}

document.addEventListener("DOMContentLoaded", init);
