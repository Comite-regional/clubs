/**
 * Configuration et Initialisation
 */
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

const elSearch = document.getElementById("search");
const elOnlyYouth = document.getElementById("onlyYouth");
const elOnlyRef = document.getElementById("onlyRef");
const elDept = document.getElementById("dept");
const elPractice = document.getElementById("practice");
const elCoachLevel = document.getElementById("coachLevel");
const elReset = document.getElementById("reset");
const elStats = document.getElementById("stats");
const elList = document.getElementById("list");
const elPanelBtn = document.getElementById("panelBtn");
const elSidebar = document.querySelector(".sidebar") || document.querySelector(".side");
const elOverlay = document.getElementById("overlay");
const elLegend = document.getElementById("legend");
const elModeButtons = document.querySelectorAll(".segBtn");
const elClusterToggle = document.getElementById("clusterToggle");

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/**
 * Fonctions de rendu visuel (Helpers)
 */

function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  // Correction : Taille bridée à 22px de haut pour s'aligner au texte
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
  // On vérifie la liste nominative 'entraineurs' présente dans le JSON
  if (!c.entraineurs || !c.entraineurs.length) {
    return `<div style="color: #64748b; font-style: italic; font-size: 11px;">Aucun entraîneur renseigné.</div>`;
  }
  return `<ul style="margin: 0; padding-left: 18px; font-size: 11px; color: #334155;">
    ${c.entraineurs.map(e => `<li>${esc(e.nom)} <span style="color:#64748b">(${esc(e.diplome)})</span></li>`).join("")}
  </ul>`;
}

function renderNamedPeople(list, emptyText, valueKey){
  if(!Array.isArray(list) || !list.length) return `<div style="color: #64748b; font-style: italic; font-size: 11px;">${emptyText}</div>`;
  return `<ul style="margin: 0; padding-left: 18px; font-size: 11px; color: #334155;">
    ${list.map(x => `<li>${esc(x.nom)} ${x[valueKey] ? `<span style="color:#64748b">(${esc(x[valueKey])})</span>` : ""}</li>`).join("")}
  </ul>`;
}

function getColorForMode(mode) {
    switch(mode) {
        case "femmes": return "#ec4899"; 
        case "para": return "#10b981";    
        case "jcomp": return "#f59e0b";   
        default: return "#2563eb";      
    }
}

function valueForMode(c){
  if(displayMode==="femmes") return Number(c.pct_femmes||0);
  if(displayMode==="para") return Number(c.pct_para||0);
  if(displayMode==="jcomp") return Number(c.pct_jeunes_competiteurs_18m||0);
  return Number(c.licences_total||0);
}

/**
 * POPUP ET MARQUEURS
 */

function makePopupHtml(c){
  const logo = c.logo_url 
    ? `<img src="${esc(c.logo_url)}" onerror="this.src='assets/logo_placeholder.svg';" style="width: 45px; height: 45px; object-fit: contain; border-radius: 4px; background: #f1f5f9;" />` 
    : `<div style="width: 45px; height: 45px; border-radius: 4px; background: #f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:10px;">LOGO</div>`;

  const links = [
    c.site ? `<a href="${esc(c.site)}" target="_blank" style="color:#2563eb; text-decoration:none; font-weight:bold;">Site</a>` : "",
    c.email ? `<a href="mailto:${esc(c.email)}" style="color:#2563eb; text-decoration:none; font-weight:bold;">Email</a>` : ""
  ].filter(Boolean).join(" | ");

  return `
  <div style="width: 320px; font-family: sans-serif; color: #1e293b;">
    <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
      ${logo}
      <div style="min-width: 0; flex: 1;">
        <div style="display: flex; align-items: center;">
          <strong style="font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.nom)}</strong>
          ${labelBadge(c.label_club)}
        </div>
        <div style="font-size: 11px; color: #64748b;">Près. : ${esc(c.president || "NC")}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-bottom: 8px;">
      <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
        <div style="font-size:9px; text-transform:uppercase; color:#64748b;">Total</div>
        <div style="font-weight:bold; font-size:13px;">${c.licences_total}</div>
      </div>
      <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
        <div style="font-size:9px; text-transform:uppercase; color:#64748b;">Jeunes</div>
        <div style="font-weight:bold; font-size:13px;">${(c.pourcentage_jeunes || 0).toFixed(1)}%</div>
      </div>
      <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
        <div style="font-size:9px; text-transform:uppercase; color:#64748b;">Para</div>
        <div style="font-weight:bold; font-size:13px;">${(c.pct_para || 0).toFixed(1)}%</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 5px; margin-bottom: 10px;">
      <div style="background:#f1f5f9; padding:8px; border-radius:4px; display:flex; align-items:center; gap:8px;">
         <div style="flex-shrink:0;">${pieSvg(c.pct_femmes, "#ec4899", 32, false)}</div>
         <div>
            <div style="font-size:9px; text-transform:uppercase; color:#64748b;">Féminisation</div>
            <div style="font-weight:bold; font-size:12px;">${(c.pct_femmes || 0).toFixed(1)}%</div>
         </div>
      </div>
      <div style="background:#fff7ed; border:1px solid #fed7aa; padding:8px; border-radius:4px; text-align:center;">
         <div style="font-size:9px; text-transform:uppercase; color:#c2410c;">J. Compét.</div>
         <div style="font-weight:bold; font-size:12px; color:#c2410c;">${(c.pct_jeunes_competiteurs_18m || 0).toFixed(1)}%</div>
      </div>
    </div>

    <div style="max-height: 120px; overflow-y: auto; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px;">
      <div style="font-size: 11px; font-weight: bold; margin-bottom: 4px; border-bottom: 1px solid #cbd5e1; color: #475569;">ENTRAÎNEURS</div>
      ${renderEntraineurs(c)}
      
      <div style="font-size: 11px; font-weight: bold; margin-top: 8px; margin-bottom: 4px; border-bottom: 1px solid #cbd5e1; color: #475569;">ARBITRES</div>
      ${renderNamedPeople(c.arbitres, "Aucun arbitre certifié.", "niveau")}
    </div>

    <div style="margin-top: 8px; text-align: center; font-size: 11px;">
      ${links}
    </div>
  </div>`;
}

function createMarker(c) {
    const mainColor = getColorForMode(displayMode);
    const baseRadius = 10 + Math.sqrt(Number(c.licences_total || 0)) * 1.2;

    if (displayMode === "licences") {
        return L.circleMarker([c.lat, c.lng], {
            radius: baseRadius, weight: 2, color: "#fff", fillColor: mainColor, fillOpacity: 0.8
        });
    } else {
        const pct = valueForMode(c);
        const size = Math.max(28, baseRadius * 1.8);
        const icon = L.divIcon({
            html: `<div style="transform: translate(-15%, -15%);">${pieSvg(pct, mainColor, size, true)}</div>`,
            className: 'marker-pie',
            iconSize: [size, size]
        });
        return L.marker([c.lat, c.lng], { icon: icon });
    }
}

/**
 * LOGIQUE FILTRES ET LISTE
 */

function applyFilters(){
  const q = (elSearch.value || "").toLowerCase().trim();
  const dept = elDept ? elDept.value : "";
  const practice = elPractice ? elPractice.value : "";
  const coachLvl = elCoachLevel ? elCoachLevel.value : "";

  filtered = clubs.filter(c => {
    const text = [c.nom, c.departement, c.president].join(" ").toLowerCase();
    const okQ = !q || text.includes(q);
    const okDept = !dept || c.departement === dept;
    const okPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
    const okCoach = !coachLvl || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === coachLvl));
    const okYouth = !elOnlyYouth.checked || (c.pourcentage_jeunes >= 30);
    const okRef = !elOnlyRef.checked || c.a_arbitre;
    return okQ && okDept && okPrac && okCoach && okYouth && okRef;
  });

  renderAll();
}

function renderMarkers(){
  if(clustersLayer) clustersLayer.clearLayers();
  if(plainLayer) plainLayer.clearLayers();

  filtered.forEach(c => {
    const m = createMarker(c);
    m.bindPopup(makePopupHtml(c), { maxWidth: 350 });
    if(elClusterToggle && elClusterToggle.checked && displayMode === "licences") {
        clustersLayer.addLayer(m);
    } else {
        plainLayer.addLayer(m);
    }
  });
}

function renderList(){
  if(!elList) return;
  const top10 = filtered.slice().sort((a,b) => b.licences_total - a.licences_total).slice(0, 10);
  elList.innerHTML = top10.map(c => `
    <div class="list-item" onclick="zoomToClub(${c.lat}, ${c.lng}, '${c.code_structure}')" style="cursor:pointer; padding:10px; border-bottom:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
      <div><div style="font-weight:bold; font-size:13px;">${esc(c.nom)}</div><div style="font-size:11px; color:#64748b;">${esc(c.ville)}</div></div>
      <div style="font-weight:800; color:#2563eb;">${c.licences_total}</div>
    </div>`).join("");
}

window.zoomToClub = (lat, lng, id) => {
    map.setView([lat, lng], 13);
    // On cherche le club pour ouvrir sa popup
    const c = clubs.find(x => String(x.code_structure) === id);
    if(c) L.popup().setLatLng([lat, lng]).setContent(makePopupHtml(c)).openOn(map);
};

function renderAll(){
  renderMarkers();
  renderList();
  if(elStats) elStats.innerHTML = `<strong>${filtered.length}</strong> clubs filtrés`;
}

async function loadData(){
  const res = await fetch("./clubs.json");
  const data = await res.json();
  clubs = data.map(c => ({
    ...c,
    lat: Number(c.lat), lng: Number(c.lon || c.lng),
    licences_total: Number(c.licences_total || 0),
    pct_femmes: Number(c.pct_femmes || 0),
    pct_para: Number(c.pct_para || 0),
    pct_jeunes_competiteurs_18m: Number(c.pct_jeunes_competiteurs_18m || 0),
    entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : []
  }));
  
  // Remplir les filtres
  const depts = [...new Set(clubs.map(c => c.departement))].sort();
  elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
  
  applyFilters();
}

function init(){
  map = L.map("map").setView(MAP_CENTER, MAP_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  
  plainLayer = L.layerGroup().addTo(map);
  clustersLayer = L.markerClusterGroup().addTo(map);

  [elSearch, elDept, elPractice, elCoachLevel, elOnlyYouth, elOnlyRef, elClusterToggle].forEach(el => {
    if(el) el.addEventListener(el.type === "text" ? "input" : "change", applyFilters);
  });

  elModeButtons.forEach(btn => btn.addEventListener("click", () => {
    displayMode = btn.dataset.mode;
    elModeButtons.forEach(b => b.classList.toggle("active", b === btn));
    applyFilters();
  }));

  loadData();
}

document.addEventListener("DOMContentLoaded", init);
