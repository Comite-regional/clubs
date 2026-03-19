const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

// Récupération sécurisée des éléments
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

// --- RENDU VISUEL ---

function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  return `<img src="assets/label_${key}.png" alt="${esc(label)}" style="height: 20px; margin-left: 5px; vertical-align: middle;" onerror="this.style.display='none'"/>`;
}

function pieSvg(pct, color = "#2563eb", size = 40){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  return `
  <svg viewBox="0 0 56 56" width="${size}" height="${size}">
    <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="8"></circle>
    <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
    <text x="28" y="32" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">${Math.round(p)}%</text>
  </svg>`;
}

function makePopupHtml(c){
  return `
  <div style="width: 280px; font-family: sans-serif;">
    <div style="display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 8px;">
      <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="width: 40px; height: 40px; object-fit: contain;">
      <div>
        <div style="font-weight: bold; font-size: 14px;">${esc(c.nom)} ${labelBadge(c.label_club)}</div>
        <div style="font-size: 11px; color: #666;">${esc(c.ville)} • Prés : ${esc(c.president || 'N/C')}</div>
      </div>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-bottom: 10px;">
        <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
            <div style="font-size:9px;">LICENCIÉS</div>
            <div style="font-weight:bold;">${c.licences_total}</div>
        </div>
        <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
            <div style="font-size:9px;">% JEUNES</div>
            <div style="font-weight:bold;">${Math.round(c.pourcentage_jeunes)}%</div>
        </div>
    </div>
    <div style="font-size: 11px; max-height: 80px; overflow-y: auto; background: #fafafa; padding: 5px; border-radius: 4px;">
        <strong>Entraîneurs :</strong><br>
        ${c.entraineurs && c.entraineurs.length ? c.entraineurs.map(e => `• ${esc(e.nom)}`).join("<br>") : "Aucun"}
    </div>
    <div style="margin-top: 10px; display: flex; gap: 10px; font-size: 12px;">
        <a href="mailto:${esc(c.email)}" style="color: #2563eb; text-decoration: none; font-weight: bold;">✉ Email</a>
        ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: bold;">🌐 Site</a>` : ''}
    </div>
  </div>`;
}

// --- LOGIQUE CARTE & FILTRES ---

function createMarker(c) {
    const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : (displayMode === "jeunes" ? "#3b82f6" : "#2563eb"));
    if (displayMode === "licences") {
        const radius = 8 + Math.sqrt(c.licences_total) * 1.2;
        return L.circleMarker([c.lat, c.lng], { radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
    } else {
        const pct = (displayMode === "femmes") ? c.pct_femmes : (displayMode === "para" ? c.pct_para : c.pourcentage_jeunes);
        const icon = L.divIcon({
            html: `<div style="transform: translate(-10px, -10px);">${pieSvg(pct, color, 40)}</div>`,
            className: '', iconSize: [40, 40]
        });
        return L.marker([c.lat, c.lng], { icon });
    }
}

function applyFilters(){
    const q = elSearch ? elSearch.value.toLowerCase().trim() : "";
    const dept = elDept ? elDept.value : "";
    const practice = elPractice ? elPractice.value : "";
    const coach = elCoachLevel ? elCoachLevel.value : "";

    filtered = clubs.filter(c => {
        const matchSearch = !q || `${c.nom} ${c.ville} ${c.cp}`.toLowerCase().includes(q);
        const matchDept = !dept || c.departement === dept;
        const matchPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
        const matchCoach = !coach || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === coach));
        return matchSearch && matchDept && matchPrac && matchCoach;
    });
    renderAll();
}

function renderAll(){
    if(!map) return;
    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        if(!c.lat || !c.lng) return;
        const m = createMarker(c);
        m.bindPopup(makePopupHtml(c));
        if(elClusterToggle && elClusterToggle.checked && displayMode === "licences") clustersLayer.addLayer(m);
        else plainLayer.addLayer(m);
    });

    if(elStats) elStats.innerHTML = `<strong>${filtered.length}</strong> clubs trouvés`;
    
    if(elList) {
        const top = filtered.sort((a,b) => b.licences_total - a.licences_total).slice(0, 15);
        elList.innerHTML = top.map(c => `
            <div class="list-item" onclick="map.setView([${c.lat}, ${c.lng}], 13)" style="padding: 8px; border-bottom: 1px solid #eee; cursor: pointer;">
                <div style="font-weight: bold; font-size: 12px;">${esc(c.nom)}</div>
                <div style="font-size: 10px; color: #666;">${esc(c.ville)} • ${c.licences_total} licenciés</div>
            </div>
        `).join("");
    }
}

// --- INITIALISATION ---

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map(c => ({
            ...c, 
            lat: Number(c.lat), 
            lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
            pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
        }));

        // Remplir les menus déroulants
        if(elDept) {
            const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
            elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        }
        if(elCoachLevel) {
            const coachs = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();
            elCoachLevel.innerHTML = `<option value="">Tous diplômes</option>` + coachs.map(l => `<option value="${l}">${l}</option>`).join("");
        }
        
        applyFilters();
    } catch (e) { console.error("Erreur chargement JSON:", e); }
}

function init() {
    if (map) return;
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);

    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // Événements
    if(elSearchBtn) elSearchBtn.onclick = () => { applyFilters(); if(window.innerWidth < 1024) elSidebar.classList.remove("open"); };
    if(elSearch) elSearch.onkeypress = (e) => { if(e.key === "Enter") { applyFilters(); if(window.innerWidth < 1024) elSidebar.classList.remove("open"); } };
    
    [elDept, elPractice, elCoachLevel, elClusterToggle].forEach(el => { if(el) el.onchange = applyFilters; });

    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    if(elPanelBtn) {
        elPanelBtn.onclick = () => {
            elSidebar.classList.toggle("open");
            if(elOverlay) elOverlay.classList.toggle("show");
        };
    }

    loadData();
}

document.addEventListener("DOMContentLoaded", init);
