/** 1. CONFIGURATION **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; 

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 2. RENDU DU POPUP (STYLE DASHBOARD) **/

function pieSvg(pct, color = "#2563eb", size = 120) {
    const p = Math.max(0, Math.min(100, Number(pct||0)));
    const r = 40, c = 2 * Math.PI * r;
    const filled = c * (p/100);
    return `
    <svg viewBox="0 0 100 100" width="${size}" height="${size}">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f5f9" stroke-width="12"></circle>
        <circle cx="50" cy="50" r="40" fill="none" stroke="${color}" stroke-width="12"
            stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 50 50)"></circle>
        <text x="50" y="55" text-anchor="middle" font-size="20" font-weight="800" fill="#1e293b">${Math.round(p)}%</text>
    </svg>`;
}

function makePopupHtml(c) {
    const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : "#2563eb");
    const val = (displayMode === "femmes") ? c.pct_femmes : (displayMode === "para" ? c.pct_para : c.pourcentage_jeunes);
    
    return `
    <div style="width: 450px; font-family: 'Inter', sans-serif; padding: 10px;">
        <div style="text-align:center; margin-bottom:15px;">
            <h2 style="margin:0; font-size:18px; text-transform:uppercase;">${esc(c.nom)}</h2>
            <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="max-width:100%; height:80px; margin:10px 0; object-fit:contain;">
            <div style="font-size:12px; font-weight:bold;">Président : ${esc(c.president || 'Non renseigné')}</div>
        </div>

        <div style="display: flex; justify-content: space-between; gap: 10px; margin-bottom: 20px;">
            <div style="flex:1; background:#f8fafc; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:10px; color:#64748b;">TOTAL</div>
                <div style="font-size:18px; font-weight:bold;">${c.licences_total}</div>
            </div>
            <div style="flex:1; background:#f8fafc; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:10px; color:#64748b;">JEUNES</div>
                <div style="font-size:18px; font-weight:bold;">${Math.round(c.pourcentage_jeunes)}%</div>
            </div>
            <div style="flex:1; background:#f8fafc; padding:10px; border-radius:8px; text-align:center;">
                <div style="font-size:10px; color:#64748b;">PARA</div>
                <div style="font-size:18px; font-weight:bold;">${(c.pct_para || 0).toFixed(1)}%</div>
            </div>
        </div>

        <div style="text-align:center; background:#f1f7ff; padding:20px; border-radius:12px;">
            <div style="font-size:11px; font-weight:bold; color:#2563eb; text-transform:uppercase; margin-bottom:10px;">${displayMode.toUpperCase()}</div>
            ${pieSvg(val, color)}
        </div>
    </div>`;
}

/** 3. FILTRAGE AVANCÉ **/

function applyFilters(){
    const q = document.getElementById("search")?.value.toLowerCase().trim() || "";
    const dept = document.getElementById("dept")?.value || "";
    const practice = document.getElementById("practice")?.value || "";
    const coach = document.getElementById("coachLevel")?.value || "";
    
    // Nouveaux filtres checkbox
    const onlyJeunes = document.getElementById("checkJeunes")?.checked;
    const withArbitre = document.getElementById("checkArbitre")?.checked;

    filtered = clubs.filter(c => {
        const okSearch = !q || `${c.nom} ${c.ville} ${c.cp}`.toLowerCase().includes(q);
        const okDept = !dept || c.departement === dept;
        const okPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
        const okCoach = !coach || (c.niveaux_entraineurs && c.niveaux_entraineurs.some(n => n.niveau === coach));
        
        const okJeunes = !onlyJeunes || (c.pourcentage_jeunes > 0);
        const okArbitre = !withArbitre || (c.arbitres && c.arbitres.length > 0);

        return okSearch && okDept && okPrac && okCoach && okJeunes && okArbitre;
    });
    renderAll();
}

function renderAll(){
    if(!map) return;
    const isClustered = document.getElementById("clusterToggle")?.checked;
    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : (displayMode === "jeunes" ? "#3b82f6" : "#2563eb"));
        const radius = 6 + Math.sqrt(c.licences_total) * 1.8;
        
        const m = L.circleMarker([c.lat, c.lng], {
            radius: radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8
        });

        m.bindPopup(makePopupHtml(c), { maxWidth: 500 });
        
        if(isClustered && displayMode === "licences") clustersLayer.addLayer(m);
        else plainLayer.addLayer(m);
    });

    // Mise à jour de la liste latérale (TOP 10)
    const elList = document.getElementById("list");
    if(elList) {
        const top = [...filtered].sort((a,b) => b.licences_total - a.licences_total).slice(0, 10);
        elList.innerHTML = top.map(c => `
            <div class="list-item" onclick="map.setView([${c.lat}, ${c.lng}], 13)" style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                <div style="font-weight:bold; font-size:11px; text-transform:uppercase;">${esc(c.nom)}</div>
                <div style="font-weight:bold; color:#2563eb;">${c.licences_total}</div>
            </div>
        `).join("");
    }

    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs affichés`;
}

/** 4. INITIALISATION **/

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map(c => ({
            ...c, lat: Number(c.lat), lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            pct_femmes: Number(c.pct_femmes || 0),
            pct_para: Number(c.pct_para || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
            arbitres: Array.isArray(c.arbitres) ? c.arbitres : [],
            pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
        }));

        // Remplissage dynamique des menus
        const elDept = document.getElementById("dept");
        if(elDept) {
            const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
            elDept.innerHTML = `<option value="">Tous départements</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        }

        applyFilters();
    } catch (e) { console.error("Erreur chargement :", e); }
}

function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    
    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    // Événements
    document.getElementById("searchValidate").onclick = applyFilters;
    
    ["dept", "practice", "coachLevel", "clusterToggle", "checkJeunes", "checkArbitre"].forEach(id => {
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
