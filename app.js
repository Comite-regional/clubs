
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
  elLegend.innerHTML = `<span class="legendLabel"><span class="legendDot"></span>Couleur = ${label}</span><span class="legendBar" aria-hidden="true"></span><span style="color:rgba(226,232,240,.65)">${modeScale.min.toFixed(1)} → ${modeScale.max.toFixed(1)}%</span>`;
}

function radiusForLicences(n){
  const v = Math.max(0, Number(n||0));
  return Math.max(5, Math.min(18, 4 + Math.sqrt(v) * 1.0));
}

function initMap(){
  map = L.map("map", { preferCanvas: true }).setView(MAP_CENTER, MAP_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  clustersLayer = L.markerClusterGroup({
    showCoverageOnHover:false,
    iconCreateFunction: function(cluster){
      const children = cluster.getAllChildMarkers();
      const n = children.length;
      let sum = 0, cnt = 0;
      for(const m of children){
        const c = m.__clubData;
        if(!c) continue;
        const v = valueForMode(c);
        if(Number.isFinite(v)){ sum += v; cnt++; }
      }
      const avg = cnt ? (sum/cnt) : 0;
      const denom = (modeScale.max - modeScale.min) || 1;
      let t = clamp((avg - modeScale.min)/denom, 0, 1);
      t = Math.pow(t, 0.75);
      const low="94a3b8", mid="3b82f6", high="a855f7";
      const col = (displayMode==="licences") ? "rgba(96,165,250,.32)" : (t<0.5 ? colorLerp(low, mid, t*2) : colorLerp(mid, high, (t-0.5)*2));
      return L.divIcon({
        html: `<div style="background:rgba(255,255,255,.10);border-radius:999px;padding:2px"><div style="background:${col};border:1px solid rgba(226,232,240,.25);border-radius:999px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;box-shadow:var(--shadow)">${n}</div></div>`,
        className: "",
        iconSize: [46,46]
      });
    },
    spiderfyOnMaxZoom:true,
    disableClusteringAtZoom:13,
    maxClusterRadius:50
  });
  plainLayer = L.layerGroup().addTo(map);
  map.addLayer(clustersLayer);

  // Mini légende (sur la carte)
  const legendCtl = L.control({position:'bottomright'});
  legendCtl.onAdd = function(){
    const div = L.DomUtil.create('div','legendCtl leaflet-control');
    div.innerHTML = '<div class="t">Légende</div><div id="mapLegend"></div>';
    return div;
  };
  legendCtl.addTo(map);

}


function pieSvg(pctWomen){
  const p = Math.max(0, Math.min(100, Number(pctWomen||0)));
  // Donut chart via stroke-dasharray
  const r = 16;
  const c = 2 * Math.PI * r;
  const w = (p/100) * c;
  const m = c - w;
  return `
  <svg width="44" height="44" viewBox="0 0 44 44" aria-label="Répartition femmes / hommes">
    <g transform="translate(22,22) rotate(-90)">
      <circle r="${r}" cx="0" cy="0" fill="none" stroke="#e2e8f0" stroke-width="10"></circle>
      <circle r="${r}" cx="0" cy="0" fill="none" stroke="#a855f7" stroke-width="10"
              stroke-dasharray="${w.toFixed(2)} ${m.toFixed(2)}" stroke-linecap="butt"></circle>
    </g>
    <text x="22" y="26" text-anchor="middle" font-size="10" font-weight="800" fill="#0f172a">${p.toFixed(0)}%</text>
  </svg>`;
}

function makePopupHtml(c){
  const coachLines = (c.niveaux_entraineurs?.length)
    ? `<ul>${c.niveaux_entraineurs
        .sort((a,b)=> String(a.niveau).localeCompare(String(b.niveau), "fr"))
        .map(x => `<li>${esc(x.niveau)} : <b>${esc(x.nb)}</b></li>`).join("")}</ul>`
    : `<div style="font-size:12px;color:#64748b;margin-top:6px">Aucun diplôme entraîneur actif détecté.</div>`;

  const youth = (typeof c.pourcentage_jeunes === "number")
    ? `${c.pourcentage_jeunes.toFixed(1)}%`
    : "—";

  const pctF = (typeof c.pct_femmes === "number") ? c.pct_femmes : 0;
  const pctP = (typeof c.pct_para === "number") ? c.pct_para : 0;

  const logo = c.logo_url
    ? `<img class="logo" src="${esc(c.logo_url)}" alt="Logo ${esc(c.nom)}" onerror="this.onerror=null;this.src=\'assets/logo_placeholder.svg\';" />`
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

    <div style="margin-top:10px;font-weight:700">Diplômes entraîneur (niveau)</div>
    ${coachLines}

    <div class="links">${links || `<span style="font-size:12px;color:#64748b">Aucun lien renseigné.</span>`}</div>
  </div>`;
}



function markerForClub(c){
  const size = radiusForLicences(c.licences_total) * 2.2; // circleMarker radius -> px diameter scaling
  const color = colorForMode(c);
  const icon = L.divIcon({
    className: "club-marker",
    html: `<div class="dotMarker" style="--s:${size.toFixed(1)}px;--c:${esc(color)}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size/2, size/2],
    popupAnchor: [0, -size/2]
  });

  const marker = L.marker([c.lat, c.lon], { icon });
  marker.__clubData = c;
  marker.bindPopup(makePopupHtml(c), { maxWidth: 360 });
  return marker;
}


function renderMarkers(){
  recomputeScale();
  legendHtml();
  plainLayer.clearLayers();
  clustersLayer.clearLayers();
  const useClusters = elClusterToggle ? elClusterToggle.checked : true;
  filtered.forEach(c => {
    const m = markerForClub(c);
    if(useClusters) clustersLayer.addLayer(m);
    else plainLayer.addLayer(m);
  });
  if(useClusters){
    if(!map.hasLayer(clustersLayer)) map.addLayer(clustersLayer);
  } else {
    if(map.hasLayer(clustersLayer)) map.removeLayer(clustersLayer);
  }
}

function renderStats(){
  const total = filtered.length;
  const withRef = filtered.filter(c => c.a_arbitre).length;
  const sumLic = filtered.reduce((a,c)=>a+Number(c.licences_total||0),0);
  const avgYouth = (() => {
    const vals = filtered.map(c => c.pourcentage_jeunes).filter(v => typeof v === "number");
    if (!vals.length) return null;
    return vals.reduce((a,b)=>a+b,0) / vals.length;
  })();

  elStats.innerHTML = `
    <div class="kpi"><div class="label">Clubs affichés</div><div class="value">${total}</div></div>
    <div class="kpi"><div class="label">Avec arbitre</div><div class="value">${withRef}</div></div>
    <div class="kpi"><div class="label">Licences (total)</div><div class="value">${sumLic}</div></div>
    <div class="kpi"><div class="label">% jeunes moyen</div><div class="value">${avgYouth===null ? "—" : avgYouth.toFixed(1)+"%"}</div></div>
  `;
}

function renderList(){
  elList.innerHTML = "";
  const frag = document.createDocumentFragment();
  filtered.slice().sort((a,b)=> (Number(b.licences_total||0) - Number(a.licences_total||0))).forEach(c => {
    const div = document.createElement("div");
    div.className = "item";
    const youth = (typeof c.pourcentage_jeunes === "number") ? `${c.pourcentage_jeunes.toFixed(1)}%` : "—";
    div.innerHTML = `
      <div class="name">${esc(c.nom)}</div>
      <div class="meta">
        <span class="badge">${esc(c.ville)}</span>
        <span class="badge">Licenciés: ${esc(c.licences_total ?? 0)}</span>
        <span class="badge">Jeunes: ${youth}</span>
        <span class="badge">Arbitres: ${esc(c.nb_arbitres)}</span>
      </div>
    `;
    div.addEventListener("click", () => {
      map.setView([c.lat, c.lon], Math.max(map.getZoom(), 12), { animate: true });
      clustersLayer.eachLayer(layer => {
        const ll = layer.getLatLng?.();
        if(ll && Math.abs(ll.lat - c.lat) < 1e-6 && Math.abs(ll.lng - c.lon) < 1e-6){
          layer.openPopup();
        if(window.innerWidth <= 720) closeSidebar();
        }
      });
    });
    frag.appendChild(div);
  });
  elList.appendChild(frag);
}

function applyFilters(){
  const q = elSearch.value.trim().toLowerCase();
  const onlyYouth = elOnlyYouth.checked;
  const onlyRef = elOnlyRef.checked;
  const dept = elDept?.value || "";
  const practice = elPractice?.value || "";

  filtered = clubs.filter(c => {
    if (q){
      const hay = `${c.nom} ${c.ville} ${c.cp}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (onlyYouth){
      if (!(typeof c.pourcentage_jeunes === "number" && c.pourcentage_jeunes >= 30)) return false;
    }
    if (onlyRef && !c.a_arbitre) return false;
    if (dept && String(c.departement||"") !== dept) return false;
    if (practice){
      const arr = c.pratiques || [];
      if (!arr.includes(practice)) return false;
    }
    return true;
  });

  renderMarkers();
  renderStats();
  renderList();
}

async function main(){
  initMap();
  const res = await fetch("./data/clubs.json");
  clubs = await res.json();
  filtered = clubs.slice();

  // Remplir listes déroulantes
  const depts = Array.from(new Set(clubs.map(c => c.departement).filter(Boolean))).sort();
  elDept.innerHTML = `<option value="">Tous</option>` + depts.map(d => `<option value="${esc(d)}">${esc(d)}</option>`).join("");

  const practices = Array.from(new Set(clubs.flatMap(c => c.pratiques || []).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'fr'));
  elPractice.innerHTML = `<option value="">Toutes</option>` + practices.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join("");

  applyFilters();

  elSearch.addEventListener("input", applyFilters);
  elOnlyYouth.addEventListener("change", applyFilters);
  elOnlyRef.addEventListener("change", applyFilters);
  elDept && elDept.addEventListener("change", applyFilters);
  elPractice && elPractice.addEventListener("change", applyFilters);
  elClusterToggle && elClusterToggle.addEventListener("change", () => { renderMarkers(); });

  elModeButtons && elModeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      elModeButtons.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      displayMode = btn.dataset.mode || "licences";
      renderMarkers();
    });
  });

  elPanelBtn && elPanelBtn.addEventListener('click', () => {
    if(elSidebar?.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  elOverlay && elOverlay.addEventListener('click', closeSidebar);

  elReset.addEventListener("click", () => {
    elSearch.value = "";
    elOnlyYouth.checked = false;
    elOnlyRef.checked = false;
    if (elDept) elDept.value = "";
    if (elPractice) elPractice.value = "";
    displayMode = "licences";
    if(elClusterToggle) elClusterToggle.checked = false;
    elModeButtons && elModeButtons.forEach((b,i)=>{b.classList.toggle("active", i===0);});
    applyFilters();
    map.setView(MAP_CENTER, MAP_ZOOM);
  });
}

main().catch(err => { console.error(err); alert("Erreur au chargement des données (voir console)."); });
