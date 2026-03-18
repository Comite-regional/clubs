function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  const src = `assets/label_${key}.png`;
  return `<img class="labelBadge" src="${esc(src)}" alt="Label ${esc(label)}" title="Label ${esc(label)}" />`;
}

const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

const elSearch = document.getElementById("search");
const elOnlyYouth = document.getElementById("onlyYouth");
const elOnlyRef = document.getElementById("onlyRef");
const elDept = document.getElementById("dept");
const elPractice = document.getElementById("practice");
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
    if(elClusterToggle) elClusterToggle.checked = false;
let modeScale = {min:0, max:100};

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
  if(displayMode==="femmes") return Number(c.pct_femmes||0);            // 0..100
  if(displayMode==="para") return Number(c.pct_para||0);               // 0..100
  if(displayMode==="jcomp") return Number(c.pct_jeunes_competiteurs_18m||0); // 0..100
  return Number(c.licences_total||0);                                  // licences
}
function colorForMode(c){
  if(displayMode==="licences") return "#2563eb";
  const v=valueForMode(c);
  const denom = (modeScale.max - modeScale.min) || 1;
  let t = clamp((v - modeScale.min)/denom, 0, 1);
  t = Math.pow(t, 0.75);
  const low="94a3b8";   // slate-400
  const mid="3b82f6";   // blue-500
  const high="a855f7";  // purple-500
  return t<0.5 ? colorLerp(low, mid, t*2) : colorLerp(mid, high, (t-0.5)*2);
}
function legendHtml(){
  if(!elLegend) return;
  if(displayMode==="licences"){
    elLegend.innerHTML = `<span class="legendLabel"><span class="legendDot"></span>Taille = licenciés actifs</span>`;
    return;
  }
  const label = displayMode==="femmes" ? "% femmes"
              : displayMode==="para" ? "% para"
              : "% jeunes compétiteurs 18m";
  const steps = [0, .25, .5, .75, 1].map(t=>{
    const c = t<0.5 ? colorLerp("94a3b8","3b82f6",t*2) : colorLerp("3b82f6","a855f7",(t-0.5)*2);
    const v = (modeScale.min + t*(modeScale.max-modeScale.min)).toFixed(0);
    return `<span class="legStep"><i style="background:${c}"></i>${v}</span>`;
  }).join("");
  elLegend.innerHTML = `<span class="legendLabel">Couleur = ${label}</span><span class="legScale">${steps}</span>`;
}

function radiusForClub(c){
  const n = Math.max(0, Number(c.licences_total||0));
  return 6 + Math.sqrt(n) * 1.6;
}

function pieSvg(pct){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  return `
  <svg viewBox="0 0 56 56" class="pie" aria-hidden="true">
    <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" stroke-width="8"></circle>
    <circle cx="28" cy="28" r="22" fill="none" stroke="#ec4899" stroke-width="8"
      stroke-linecap="round"
      stroke-dasharray="${filled} ${c-filled}"
      transform="rotate(-90 28 28)"></circle>
    <text x="28" y="31" text-anchor="middle" font-size="11" font-weight="800" fill="#0f172a">${Math.round(p)}%</text>
  </svg>`;
}

function renderNamedPeople(list, emptyText, valueKey){
  if(!Array.isArray(list) || !list.length){
    return `<div style="font-size:12px;color:#64748b;margin-top:6px">${emptyText}</div>`;
  }
  const sorted = list.slice().sort((a,b) => String(a.nom || "").localeCompare(String(b.nom || ""), "fr"));
  return `<ul>${sorted.map(x => {
    const detail = x && x[valueKey] ? ` — <b>${esc(x[valueKey])}</b>` : "";
    return `<li>${esc(x?.nom || "Nom non renseigné")}${detail}</li>`;
  }).join("")}</ul>`;
}

function makePopupHtml(c){
  const coachLines = (c.niveaux_entraineurs?.length)
    ? `<ul>${c.niveaux_entraineurs
        .slice()
        .sort((a,b)=> String(a.niveau).localeCompare(String(b.niveau), "fr"))
        .map(x => `<li>${esc(x.niveau)} : <b>${esc(x.nb)}</b></li>`).join("")}</ul>`
    : `<div style="font-size:12px;color:#64748b;margin-top:6px">Aucun diplôme entraîneur actif détecté.</div>`;

  const arbitresLines = renderNamedPeople(
    c.arbitres,
    "Aucun arbitre renseigné.",
    "niveau"
  );

  const entraineursLines = renderNamedPeople(
    c.entraineurs,
    "Aucun entraîneur renseigné.",
    "diplome"
  );

  const youth = (typeof c.pourcentage_jeunes === "number")
    ? `${c.pourcentage_jeunes.toFixed(1)}%`
    : "—";

  const pctF = (typeof c.pct_femmes === "number") ? c.pct_femmes : 0;
  const pctP = (typeof c.pct_para === "number") ? c.pct_para : 0;

  const logo = c.logo_url
    ? `<img class="logo" src="${esc(c.logo_url)}" alt="Logo ${esc(c.nom)}" onerror="this.onerror=null;this.src='assets/logo_placeholder.svg';" />`
    : `<div class="logo" style="display:flex;align-items:center;justify-content:center;font-size:12px;color:#64748b">LOGO</div>`;

  const links = [
    c.site ? `<a href="${esc(c.site)}" target="_blank" rel="noopener">Site</a>` : "",
    c.email ? `<a href="mailto:${esc(c.email)}">Email</a>` : "",
  ].filter(Boolean).join("");

  return `
  <div class="popup">
    <div class="h">
      ${logo}
      <div style="flex:1">
        <div class="clubRow"><div class="club">${esc(c.nom)}</div>${labelBadge(c.label_club)}</div>
        <div class="addr"><strong>Président :</strong> ${c.president ? esc(c.president) : "Non renseigné"}</div>
        <div class="badges">
          ${(c.pratiques && c.pratiques.length) ? c.pratiques.map(p => `<span class="pill">${esc(p)}</span>`).join("") : `<span class="pill muted">Pratique non renseignée</span>`}
        </div>
      </div>
    </div>

    <div class="grid3">
      <div class="box">
        <div class="t">Licenciés (actifs)</div>
        <div class="v">${esc(c.licences_total ?? 0)}</div>
      </div>
      <div class="box">
        <div class="t">Jeunes</div>
        <div class="v">${youth}</div>
      </div>
      <div class="box">
        <div class="t">Jeunes compétiteurs 18m</div>
        <div class="v">${(c.jeunes_competiteurs_18m ?? "—")} <span style="font-weight:600;color:#64748b">(${(typeof c.pct_jeunes_competiteurs_18m==="number") ? c.pct_jeunes_competiteurs_18m.toFixed(1)+"%" : "—"})</span></div>
      </div>
      <div class="box">
        <div class="t">Para</div>
        <div class="v">${pctP.toFixed(1)}% <span style="font-weight:600;color:#64748b">(${esc(c.nb_para ?? 0)})</span></div>
      </div>
    </div>

    <div class="split">
      <div class="box wide">
        <div class="t">Femmes / Hommes</div>
        <div class="genderRow">
          <div class="pieWrap">${pieSvg(pctF)}</div>
          <div class="legend">
            <div><span class="sw sF"></span> Femmes : <b>${esc(c.nb_femmes ?? 0)}</b> (${pctF.toFixed(1)}%)</div>
            <div><span class="sw sH"></span> Hommes : <b>${esc(c.nb_hommes ?? 0)}</b> (${(100-pctF).toFixed(1)}%)</div>
          </div>
        </div>
      </div>
      <div class="box wide">
        <div class="t">Arbitres (actifs, uniques)</div>
        <div class="v">${c.a_arbitre ? "Oui" : "Non"} <span style="font-weight:600;color:#64748b">(${esc(c.nb_arbitres)})</span></div>
      </div>
    </div>

    <div style="margin-top:10px;font-weight:700">Arbitres</div>
    ${arbitresLines}

    <div style="margin-top:10px;font-weight:700">Entraîneurs</div>
    ${entraineursLines}

    <div style="margin-top:10px;font-weight:700">Diplômes entraîneur (niveau)</div>
    ${coachLines}

    <div class="links">${links || `<span style="font-size:12px;color:#64748b">Aucun lien renseigné.</span>`}</div>
  </div>`;
}


function markerForClub(c){
  const r = radiusForClub(c);
  const color = colorForMode(c);
  return L.circleMarker([c.lat, c.lng], {
    radius: r,
    weight: 2,
    color: "#ffffff",
    fillColor: color,
    fillOpacity: 0.9
  });
}

function itemHtml(c){
  return `
    <button class="clubItem" data-id="${esc(c.code_structure)}">
      <div>
        <div class="clubName">${esc(c.nom)}</div>
        <div class="clubMeta">${esc(c.departement || "")} • ${Number(c.licences_total||0)} licenciés</div>
      </div>
      <div class="clubRight">
        ${c.a_arbitre ? `<span class="miniBadge">Arbitre</span>` : ""}
      </div>
    </button>`;
}

function statsHtml(list){
  const nb = list.length;
  const totalLic = list.reduce((s,c)=>s + Number(c.licences_total||0), 0);
  const avgF = nb ? list.reduce((s,c)=>s + Number(c.pct_femmes||0), 0)/nb : 0;
  const avgP = nb ? list.reduce((s,c)=>s + Number(c.pct_para||0), 0)/nb : 0;
  return `
    <div class="stat"><span>Clubs</span><strong>${nb}</strong></div>
    <div class="stat"><span>Licenciés</span><strong>${totalLic}</strong></div>
    <div class="stat"><span>% femmes (moy.)</span><strong>${avgF.toFixed(1)}%</strong></div>
    <div class="stat"><span>% para (moy.)</span><strong>${avgP.toFixed(1)}%</strong></div>`;
}

function syncDeptAndPracticeOptions(){
  const depts = [...new Set(clubs.map(c => String(c.departement || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));
  const practices = [...new Set(clubs.flatMap(c => Array.isArray(c.pratiques) ? c.pratiques : []).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"fr"));

  elDept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
  elPractice.innerHTML = `<option value="">Toutes pratiques</option>` + practices.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");
}

function applyFilters(){
  const q = (elSearch.value || "").toLowerCase().trim();
  const dept = elDept.value;
  const practice = elPractice.value;
  const onlyYouth = !!elOnlyYouth.checked;
  const onlyRef = !!elOnlyRef.checked;

  filtered = clubs.filter(c => {
    const text = [c.nom, c.departement, c.president].filter(Boolean).join(" ").toLowerCase();
    const okQ = !q || text.includes(q);
    const okDept = !dept || String(c.departement||"") === dept;
    const okPractice = !practice || (Array.isArray(c.pratiques) && c.pratiques.includes(practice));
    const okYouth = !onlyYouth || Number(c.pourcentage_jeunes||0) > 0;
    const okRef = !onlyRef || !!c.a_arbitre;
    return okQ && okDept && okPractice && okYouth && okRef;
  });

  recomputeScale();
  renderAll();
}

function clearLayers(){
  if(clustersLayer){ clustersLayer.clearLayers(); }
  if(plainLayer){ plainLayer.clearLayers(); }
}

function renderMarkers(){
  clearLayers();

  filtered.forEach(c => {
    if(!Number.isFinite(Number(c.lat)) || !Number.isFinite(Number(c.lng))) return;
    const m = markerForClub(c);
    m.bindPopup(makePopupHtml(c), { maxWidth: 430 });
    m.on("click", ()=> map.setView([c.lat, c.lng], Math.max(map.getZoom(), 10)));
    if(elClusterToggle && elClusterToggle.checked){
      clustersLayer.addLayer(m);
    }else{
      plainLayer.addLayer(m);
    }
  });

  if(elClusterToggle && elClusterToggle.checked){
    if(!map.hasLayer(clustersLayer)) map.addLayer(clustersLayer);
    if(map.hasLayer(plainLayer)) map.removeLayer(plainLayer);
  }else{
    if(!map.hasLayer(plainLayer)) map.addLayer(plainLayer);
    if(map.hasLayer(clustersLayer)) map.removeLayer(clustersLayer);
  }
}

function renderList(){
  elList.innerHTML = filtered.map(itemHtml).join("");
  elList.querySelectorAll(".clubItem").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const c = filtered.find(x => String(x.code_structure) === String(id));
      if(!c) return;
      map.setView([c.lat, c.lng], 11);
      setTimeout(() => {
        const popup = L.popup({maxWidth:430})
          .setLatLng([c.lat, c.lng])
          .setContent(makePopupHtml(c))
          .openOn(map);
      }, 120);
      if(window.innerWidth < 1024){
        elSidebar.classList.remove("open");
        elOverlay.classList.remove("show");
      }
    });
  });
}

function renderStats(){
  elStats.innerHTML = statsHtml(filtered);
}

function renderAll(){
  renderMarkers();
  renderList();
  renderStats();
  legendHtml();
}

async function loadData(){
  const res = await fetch("./clubs.json", {cache:"no-store"});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  clubs = await res.json();

  clubs = clubs.map(c => ({
    ...c,
    lat: Number(c.lat),
    lng: Number(c.lng ?? c.lon),
    licences_total: Number(c.licences_total || 0),
    pct_femmes: Number(c.pct_femmes || 0),
    pct_para: Number(c.pct_para || 0),
    pct_jeunes_competiteurs_18m: Number(c.pct_jeunes_competiteurs_18m || 0),
    a_arbitre: !!c.a_arbitre,
    pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
    arbitres: Array.isArray(c.arbitres) ? c.arbitres : [],
    entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
    niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
  })).filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng));

  syncDeptAndPracticeOptions();
  filtered = clubs.slice();
  recomputeScale();
  renderAll();
}

function initMap(){
  map = L.map("map", { zoomControl: true }).setView(MAP_CENTER, MAP_ZOOM);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  plainLayer = L.layerGroup().addTo(map);
  clustersLayer = L.markerClusterGroup({
    showCoverageOnHover:false,
    spiderfyOnMaxZoom:true,
    maxClusterRadius: 50
  });
}

function initUI(){
  elSearch.addEventListener("input", applyFilters);
  elOnlyYouth.addEventListener("change", applyFilters);
  elOnlyRef.addEventListener("change", applyFilters);
  elDept.addEventListener("change", applyFilters);
  elPractice.addEventListener("change", applyFilters);

  if(elReset){
    elReset.addEventListener("click", () => {
      elSearch.value = "";
      elOnlyYouth.checked = false;
      elOnlyRef.checked = false;
      elDept.value = "";
      elPractice.value = "";
      displayMode = "licences";
      elModeButtons.forEach(b => b.classList.toggle("active", b.dataset.mode === displayMode));
      if(elClusterToggle) elClusterToggle.checked = false;
      applyFilters();
    });
  }

  if(elPanelBtn){
    elPanelBtn.addEventListener("click", () => {
      elSidebar.classList.toggle("open");
      elOverlay.classList.toggle("show");
    });
  }
  if(elOverlay){
    elOverlay.addEventListener("click", () => {
      elSidebar.classList.remove("open");
      elOverlay.classList.remove("show");
    });
  }

  elModeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      displayMode = btn.dataset.mode || "licences";
      elModeButtons.forEach(b => b.classList.toggle("active", b === btn));
      recomputeScale();
      renderAll();
    });
  });

  if(elClusterToggle){
    elClusterToggle.addEventListener("change", renderMarkers);
  }
}

(async function boot(){
  try{
    initMap();
    initUI();
    await loadData();
  }catch(err){
    console.error(err);
    alert("Impossible de charger les données clubs.json");
  }
})();
