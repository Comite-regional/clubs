/** 1. CONFIGURATION **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; 

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 2. RENDU VISUEL **/

function labelBadge(label){
  if(!label) return "";
  const key = String(label).toLowerCase();
  return `<img src="assets/label_${key}.png" style="height: 20px; margin-left: 5px; vertical-align: middle;" onerror="this.style.display='none'"/>`;
}

function pieSvg(pct, color = "#2563eb", size = 40){
  const p = Math.max(0, Math.min(100, Number(pct||0)));
  const r = 22, c = 2 * Math.PI * r;
  const filled = c * (p/100);
  return `<svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display:block"><circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="8"></circle><circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle><text x="28" y="32" text-anchor="middle" font-size="12" font-weight="bold" fill="#1e293b">${Math.round(p)}%</text></svg>`;
}

function makePopupHtml(c) {
    const listE = c.entraineurs && c.entraineurs.length ? c.entraineurs.map(e => `• ${esc(e.nom)}`).join("<br>") : "Aucun";
    return `<div style="width: 250px; font-family: sans-serif;">
        <div style="font-weight:bold; border-bottom:1px solid #eee; padding-bottom:5px; margin-bottom:5px;">${esc(c.nom)} ${labelBadge(c.label_club)}</div>
        <div style="font-size:11px; color:#666; margin-bottom:10px;">${esc(c.ville)} • Prés : ${esc(c.president || 'N/C')}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-bottom:10px;">
            <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
                <div style="font-size:9px;">TOTAL</div><div style="font-weight:bold;">${c.licences_total}</div>
            </div>
            <div style="background:#f1f5f9; padding:5px; border-radius:4px; text-align:center;">
                <div style="font-size:9px;">JEUNES</div><div style="font-weight:bold;">${Math.round(c.pourcentage_jeunes)}%</div>
            </div>
        </div>
        <div style="font-size:11px; background:#fafafa; padding:5px; border-radius:4px; border:1px solid #eee;">
            <strong>Staff :</strong><br>${listE}
        </div>
        <div style="margin-top:10px; text-align:center;"><a href="mailto:${esc(c.email)}" style="color:#2563eb; font-weight:bold; text-decoration:none;">✉ Contacter</a></div>
    </div>`;
}

/** 3. LOGIQUE **/

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
        const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : (displayMode === "jeunes" ? "#3b82f6" : "#2563eb"));
        let m;
        if (displayMode === "licences") {
            const radius = 8 + Math.sqrt(c.licences_total) * 1.5;
            m = L.circleMarker([c.lat, c.lng], { radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
        } else {
            const pct = (displayMode === "femmes") ? (c.pct_femmes||0) : (displayMode === "para" ? (c.pct_para||0) : (c.pourcentage_jeunes||0));
            const icon = L.divIcon({ html: `<div style="transform:translate(-20px,-20px)">${pieSvg(pct, color, 40)}</div>`, className: '', iconSize: [40, 40] });
            m = L.marker([c.lat, c.lng], { icon });
        }
        m.bindPopup(makePopupHtml(c));
        if(isClustered && displayMode === "licences") clustersLayer.addLayer(m);
        else plainLayer.addLayer(m);
    });

    const st = document.getElementById("stats");
    if(st) st.innerHTML = `<strong>${filtered.length}</strong> clubs affichés`;
}

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map(c => ({
            ...c, lat: Number(c.lat), lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
            pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
        }));

        const elDept = document.getElementById("dept");
        if(elDept) {
            const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
            elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        }
        applyFilters();
    } catch (e) { console.error("Erreur JSON:", e); }
}

function init() {
    if (map) return;
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    document.getElementById("searchValidate").onclick = applyFilters;
    ["dept", "practice", "coachLevel", "clusterToggle"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = applyFilters;
    });

    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    loadData();
}

document.addEventListener("DOMContentLoaded", init);
/** FIN DU FICHIER - RIEN NE DOIT ETRE EN DESSOUS **/
