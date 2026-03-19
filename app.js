/** 1. CONFIGURATION & VARIABLES **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; 

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 2. FONCTIONS DE RENDU (POPUP & ICONS) **/

function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  return `<img src="assets/label_${key}.png" style="height: 20px; margin-left: 5px; vertical-align: middle;" onerror="this.style.display='none'"/>`;
}

function pieSvg(pct, color = "#2563eb", size = 40){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  return `
  <svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display:block">
    <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="8"></circle>
    <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="8"
      stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
    <text x="28" y="32" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">${Math.round(p)}%</text>
  </svg>`;
}

function makePopupHtml(c) {
    const listEntraineurs = c.entraineurs && c.entraineurs.length 
        ? c.entraineurs.map(e => `• ${esc(e.nom)} (${esc(e.diplome)})`).join("<br>")
        : "<em>Aucun entraîneur</em>";

    return `
    <div style="width: 280px; font-family: 'Inter', sans-serif;">
        <div style="display: flex; gap: 10px; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 8px; margin-bottom: 10px;">
            <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="width: 45px; height: 45px; object-fit: contain;">
            <div style="min-width:0; flex:1">
                <div style="font-weight: bold; font-size: 14px;">${esc(c.nom)} ${labelBadge(c.label_club)}</div>
                <div style="font-size: 11px; color: #666;">${esc(c.ville)} • Prés : ${esc(c.president || 'N/C')}</div>
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
            <div style="background:#eff6ff; padding:8px; border-radius:6px; text-align:center;">
                <div style="font-size:9px; font-weight:700; color:#1e40af;">LICENCIÉS</div>
                <div style="font-weight:800; font-size:15px; color:#1e40af;">${c.licences_total}</div>
            </div>
            <div style="background:#f0fdf4; padding:8px; border-radius:6px; text-align:center;">
                <div style="font-size:9px; font-weight:700; color:#166534;">% JEUNES</div>
                <div style="font-weight:800; font-size:15px; color:#166534;">${Math.round(c.pourcentage_jeunes)}%</div>
            </div>
        </div>
        <div style="font-size: 11px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; max-height: 80px; overflow-y: auto;">
            <strong>Équipe technique :</strong><br>${listEntraineurs}
        </div>
        <div style="margin-top: 12px; display: flex; justify-content: space-around; border-top: 1px solid #eee; padding-top: 10px;">
            <a href="mailto:${esc(c.email)}" style="color: #2563eb; text-decoration: none; font-weight: bold; font-size: 12px;">✉ Email</a>
            ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color: #2563eb; text-decoration: none; font-weight: bold; font-size: 12px;">🌐 Site Web</a>` : ''}
        </div>
    </div>`;
}

/** 3. FILTRES ET CARTE **/

function applyFilters(){
    const q = document.getElementById("search")?.value.toLowerCase().trim() || "";
    const dept = document.getElementById("dept")?.value || "";
    const practice = document.getElementById("practice")?.value || "";
    const coach = document.getElementById("coachLevel")?.value || "";

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
    const isClustered = document.getElementById("clusterToggle")?.checked;
    
    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        if(!c.lat || !c.lng) return;
        
        let m;
        const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : (displayMode === "jeunes" ? "#3b82f6" : "#2563eb"));
        
        if (displayMode === "licences") {
            const radius = 8 + Math.sqrt(c.licences_total) * 1.5;
            m = L.circleMarker([c.lat, c.lng], { radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
        } else {
            const pct = (displayMode === "femmes") ? c.pct_femmes : (displayMode === "para" ? c.pct_para : c.pourcentage_jeunes);
            const icon = L.divIcon({
                html: `<div style="transform:translate(-20px,-20px)">${pieSvg(pct, color, 40)}</div>`,
                className: '', iconSize: [40, 40]
            });
            m = L.marker([c.lat, c.lng], { icon });
        }

        m.bindPopup(makePopupHtml(c));
        if(isClustered && displayMode === "licences") clustersLayer.addLayer(m);
        else plainLayer.addLayer(m);
    });

    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs trouvés`;
}

/** 4. CHARGEMENT & INIT **/

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map(c => ({
            ...c, 
            lat: Number(c.lat), lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
            pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
        }));

        // Remplissage selects
        const elDept = document.getElementById("dept");
        if(elDept) {
            const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
            elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        }

        const elCoach = document.getElementById("coachLevel");
        if(elCoach) {
            const coachs = [...new Set(clubs.flatMap(c => (c.niveaux_entraineurs || []).map(n => n.niveau)))].filter(Boolean).sort();
            elCoach.innerHTML = `<option value="">Tous les diplômes</option>` + coachs.map(l => `<option value="${l}">${l}</option>`).join("");
        }

        applyFilters();
    } catch (e) { console.error("Erreur JSON:", e); }
}

function init() {
    if (map) return;
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);

    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // Bouton Recherche
    document.getElementById("searchValidate").onclick = () => {
        applyFilters();
        if(window.innerWidth < 1024) document.querySelector(".sidebar").classList.remove("open");
    };

    // Filtres automatiques
    ["dept", "practice", "coachLevel", "clusterToggle"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = applyFilters;
    });

    // Onglets de mode
    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    // Toggle Mobile
    document.getElementById("panelBtn").onclick = () => {
        document.querySelector(".sidebar").classList.toggle("open");
        document.getElementById("overlay").classList.toggle("show");
    };

    loadData();
}

document.addEventListener("DOMContentLoaded", init);
