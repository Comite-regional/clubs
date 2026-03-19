const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

// Éléments UI
const elSearch = document.getElementById("search");
const elOnlyYouth = document.getElementById("onlyYouth");
const elOnlyRef = document.getElementById("onlyRef");
const elDept = document.getElementById("dept");
const elPractice = document.getElementById("practice");
const elCoachLevel = document.getElementById("coachLevel"); // Nouveau filtre
const elReset = document.getElementById("reset");
const elStats = document.getElementById("stats");
const elList = document.getElementById("list");
const elPanelBtn = document.getElementById("panelBtn");
const elSidebar = document.querySelector(".sidebar");
const elOverlay = document.getElementById("overlay");
const elLegend = document.getElementById("legend");
const elModeButtons = document.querySelectorAll(".segBtn");
const elClusterToggle = document.getElementById("clusterToggle");

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences";
let modeScale = {min:0, max:100};

// Utilitaires
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
function lerp(a,b,t){return a+(b-a)*t;}

function colorLerp(c1,c2,t){
  const a=c1.match(/\w\w/g).map(h=>parseInt(h,16));
  const b=c2.match(/\w\w/g).map(h=>parseInt(h,16));
  const r=Math.round(lerp(a[0],b[0],t));
  const g=Math.round(lerp(a[1],b[1],t));
  const bl=Math.round(lerp(a[2],b[2],t));
  return `rgb(${r},${g},${bl})`;
}

// Logique de données
function recomputeScale(){
  if(displayMode==="licences"){ modeScale = {min:0, max:0}; return; }
  const vals = filtered.map(valueForMode).filter(v => Number.isFinite(v));
  if(!vals.length){ modeScale = {min:0, max:100}; return; }
  let mn = Math.min(...vals);
  let mx = Math.max(...vals);
  if(mx - mn < 1){ mn = 0; mx = 100; }
  modeScale = {min:mn, max:mx};
}

function valueForMode(c){
  if(displayMode==="femmes") return Number(c.pct_femmes||0);
  if(displayMode==="para") return Number(c.pct_para||0);
  if(displayMode==="jcomp") return Number(c.pct_jeunes_competiteurs_18m||0);
  return Number(c.licences_total||0);
}

function colorForMode(c){
  if(displayMode==="licences") return "#2563eb";
  const v=valueForMode(c);
  const denom = (modeScale.max - modeScale.min) || 1;
  let t = clamp((v - modeScale.min)/denom, 0, 1);
  t = Math.pow(t, 0.75);
  const low="94a3b8", mid="3b82f6", high="a855f7";
  return t<0.5 ? colorLerp(low, mid, t*2) : colorLerp(mid, high, (t-0.5)*2);
}

// Rendu UI
function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  return `<img class="labelBadge" src="assets/label_${key}.png" alt="Label ${esc(label)}" title="Label ${esc(label)}" />`;
}

function pieSvg(pct){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  return `
  <svg viewBox="0 0 56 56" class="pie" aria-hidden="true">
    <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="8"></circle>
    <circle cx="28" cy="28" r="22" fill="none" stroke="#ec4899" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
    <text x="28" y="31" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${Math.round(p)}%</text>
  </svg>`;
}

function renderNamedPeople(list, emptyText, valueKey){
  if(!Array.isArray(list) || !list.length) return `<div class="empty-list">${emptyText}</div>`;
  const sorted = list.slice().sort((a,b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr"));
  return `<ul>${sorted.map(x => `<li>${esc(x?.nom || "Inconnu")}${x[valueKey] ? ` — <b>${esc(x[valueKey])}</b>` : ""}</li>`).join("")}</ul>`;
}

function makePopupHtml(c){
  const coachLevelsHtml = (c.niveaux_entraineurs?.length)
    ? `<ul>${c.niveaux_entraineurs.map(x => `<li>${esc(x.niveau)} : <b>${esc(x.nb)}</b></li>`).join("")}</ul>`
    : `<div class="empty-list">Aucun diplôme actif.</div>`;

  const logo = c.logo_url ? `<img class="logo" src="${esc(c.logo_url)}" onerror="this.src='assets/logo_placeholder.svg';" />` : `<div class="logo">LOGO</div>`;
  const links = [c.site ? `<a href="${esc(c.site)}" target="_blank">Site</a>` : "", c.email ? `<a href="mailto:${esc(c.email)}">Email</a>` : ""].filter(Boolean).join("");

  return `
  <div class="popup">
    <div class="h">
      ${logo}
      <div style="flex:1">
        <div class="clubRow"><div class="club">${esc(c.nom)}</div>${labelBadge(c.label_club)}</div>
        <div class="addr"><strong>Président :</strong> ${esc(c.president || "Non renseigné")}</div>
      </div>
    </div>
    <div class="grid3 compact-stats">
      <div class="box"><div class="t">Total</div><div class="v">${c.licences_total}</div></div>
      <div class="box"><div class="t">Jeunes</div><div class="v">${(c.pourcentage_jeunes || 0).toFixed(1)}%</div></div>
      <div class="box"><div class="t">Para</div><div class="v">${(c.pct_para || 0).toFixed(1)}%</div></div>
    </div>
    <div class="split">
      <div class="box wide">
        <div class="t">Féminisation</div>
        <div class="genderRow">
          <div class="pieWrap">${pieSvg(c.pct_femmes)}</div>
          <div class="legend" style="font-size:10px">
            <div><span class="sw sF"></span> F : <b>${c.nb_femmes}</b></div>
            <div><span class="sw sH"></span> H : <b>${c.nb_hommes}</b></div>
          </div>
        </div>
      </div>
      <div class="box wide">
        <div class="t">Arbitres</div>
        <div class="v">${c.a_arbitre ? "Oui" : "Non"} <span class="sub-val">(${c.nb_arbitres})</span></div>
      </div>
    </div>
    <div class="scroll-section">
        <div class="box-full"><div class="t">Diplômes Entraîneurs</div>${coachLevelsHtml}</div>
        <div class="box-full"><div class="t">Liste Arbitres</div>${renderNamedPeople(c.arbitres, "Aucun", "niveau")}</div>
    </div>
    <div class="links">${links || `<span class="muted">Aucun lien.</span>`}</div>
  </div>`;
}

function syncFilters(){
  const depts = [...new Set(clubs.map(c => String(c.departement || "").trim()).filter(Boolean))].sort();
  const practices = [...new Set(clubs.flatMap(c => c.pratiques || []))].sort();
  const coachLvls = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs?.map(n => n.niveau) || []))].sort();

  elDept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
  elPractice.innerHTML = `<option value="">Toutes pratiques</option>` + practices.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
  if(elCoachLevel) elCoachLevel.innerHTML = `<option value="">Tous les diplômes</option>` + coachLvls.map(l => `<option value="${esc(l)}">${esc(l)}</option>`).join("");
}

function applyFilters(){
  const q = (elSearch.value || "").toLowerCase().trim();
  const dept = elDept.value;
  const practice = elPractice.value;
  const coachLvl = elCoachLevel?.value;

  filtered = clubs.filter(c => {
    const text = [c.nom, c.departement, c.president].join(" ").toLowerCase();
    const okQ = !q || text.includes(q);
    const okDept = !dept || c.departement === dept;
    const okPrac = !practice || c.pratiques.includes(practice);
    const okCoach = !coachLvl || c.niveaux_entraineurs.some(n => n.niveau === coachLvl);
    const okYouth = !elOnlyYouth.checked || c.pourcentage_jeunes > 0;
    const okRef = !elOnlyRef.checked || c.a_arbitre;
    return okQ && okDept && okPrac && okCoach && okYouth && okRef;
  });

  recomputeScale();
  renderAll();
}

function renderMarkers(){
  if(clustersLayer) clustersLayer.clearLayers();
  if(plainLayer) plainLayer.clearLayers();

  filtered.forEach(c => {
    const r = 6 + Math.sqrt(c.licences_total) * 1.6;
    const m = L.circleMarker([c.lat, c.lng], { radius: r, weight: 2, color: "#fff", fillColor: colorForMode(c), fillOpacity: 0.9 });
    m.bindPopup(makePopupHtml(c), { maxWidth: 400 });
    if(elClusterToggle?.checked) clustersLayer.addLayer(m); else plainLayer.addLayer(m);
  });
}

function renderList(){
  const top10 = filtered.slice().sort((a,b) => b.licences_total - a.licences_total).slice(0, 10);
  elList.innerHTML = `<h3 class="top-title">Top 10 Clubs (Licenciés)</h3>` + top10.map(c => `
    <button class="clubItem" data-id="${c.code_structure}">
      <div style="flex:1"><b>${esc(c.nom)}</b><br><small>${esc(c.departement)}</small></div>
      <div class="licence-count">${c.licences_total}</div>
    </button>`).join("");

  elList.querySelectorAll(".clubItem").forEach(btn => {
    btn.addEventListener("click", () => {
      const c = clubs.find(x => String(x.code_structure) === btn.dataset.id);
      map.setView([c.lat, c.lng], 12);
      setTimeout(() => L.popup({maxWidth:400}).setLatLng([c.lat, c.lng]).setContent(makePopupHtml(c)).openOn(map), 150);
    });
  });
}

function renderAll(){
  renderMarkers();
  renderList();
  elStats.innerHTML = `<div class="stat-main"><b>${filtered.length}</b> clubs affichés</div>`;
  if(elLegend) {
      if(displayMode === "licences") elLegend.innerHTML = "Taille = Licenciés";
      else elLegend.innerHTML = `Couleur = ${displayMode}`;
  }
}

async function loadData(){
  const res = await fetch("./clubs.json");
  clubs = (await res.json()).map(c => ({
    ...c,
    lat: Number(c.lat), lng: Number(c.lng ?? c.lon),
    licences_total: Number(c.licences_total || 0),
    niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
  })).filter(c => !isNaN(c.lat));
  syncFilters();
  applyFilters();
}

function init(){
  map = L.map("map").setView(MAP_CENTER, MAP_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
  plainLayer = L.layerGroup().addTo(map);
  clustersLayer = L.markerClusterGroup().addTo(map);

  [elSearch, elDept, elPractice, elCoachLevel, elOnlyYouth, elOnlyRef].forEach(el => el?.addEventListener("change", applyFilters));
  elSearch.addEventListener("input", applyFilters);
  
  elModeButtons.forEach(btn => btn.addEventListener("click", () => {
    displayMode = btn.dataset.mode;
    elModeButtons.forEach(b => b.classList.toggle("active", b === btn));
    recomputeScale(); renderAll();
  }));

  loadData();
}

init();
