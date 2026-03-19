/** 1. CONFIGURATION **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;
let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; 

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 2. MOTEUR GRAPHIQUE **/
function labelBadge(label) {
    if (!label || label === "Non" || label === "Aucun") return "";
    let fileName = String(label).toLowerCase().replace("label ", "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_'); 
    return `<img src="assets/label_${fileName}.png" title="${esc(label)}" style="height: 25px; margin-left: 10px; vertical-align: middle;">`;
}

/** 3. RENDU DU POPUP CORRIGÉ **/
function makePopupHtml(c) {
    // Rétablissement des arbitres et entraîneurs
    const listE = c.entraineurs?.length ? c.entraineurs.map(e => `<li>${esc(e.nom)} <span style="color:#64748b">(${esc(e.diplome)})</span></li>`).join("") : "<li><em>Aucun</em></li>";
    const listA = c.arbitres?.length ? c.arbitres.map(a => `<li>${esc(a.nom)} <span style="color:#64748b">(${esc(a.niveau)})</span></li>`).join("") : "<li><em>Aucun</em></li>";
    const listP = c.pratiques?.length ? c.pratiques.map(p => `<span style="display:inline-block; background:#e2e8f0; padding:2px 8px; border-radius:10px; margin:2px; font-size:10px; font-weight:600;">${esc(p)}</span>`).join("") : "";

    return `
    <div style="width: 360px; font-family: 'Inter', sans-serif; color: #1e293b; padding: 5px;">
        <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #f1f5f9; padding-bottom:12px; margin-bottom:12px;">
            <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="width:55px; height:55px; object-fit:contain;" onerror="this.src='assets/logo_placeholder.svg'">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; flex-wrap:wrap;">
                    <span style="font-weight:900; font-size:15px; text-transform:uppercase;">${esc(c.nom)}</span>
                    ${labelBadge(c.label_club)}
                </div>
                <div style="font-size:11px; color:#64748b;">${esc(c.ville)} • Prés : <strong>${esc(c.president || 'N/C')}</strong></div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:15px;">
            <div style="background:#eff6ff; padding:8px; border-radius:10px; text-align:center; border:1px solid #dbeafe;">
                <div style="font-size:8px; font-weight:800; color:#1e40af;">LICENCIÉS</div>
                <div style="font-size:16px; font-weight:900; color:#1e40af;">${c.licences_total}</div>
            </div>
            <div style="background:#fdf2f8; padding:8px; border-radius:10px; text-align:center; border:1px solid #fce7f3;">
                <div style="font-size:8px; font-weight:800; color:#9d174d;">ARCHERS PARA</div>
                <div style="font-size:16px; font-weight:900; color:#9d174d;">${Math.round(c.pct_para || 0)}%</div>
            </div>
            <div style="background:#f0fdf4; padding:8px; border-radius:10px; text-align:center; border:1px solid #dcfce7;">
                <div style="font-size:8px; font-weight:800; color:#166534;">% JEUNES</div>
                <div style="font-size:16px; font-weight:900; color:#166534;">${Math.round(c.pourcentage_jeunes || 0)}%</div>
            </div>
            <div style="background:#fff7ed; padding:8px; border-radius:10px; text-align:center; border:1px solid #ffedd5;">
                <div style="font-size:8px; font-weight:800; color:#9a3412;">COMPÉTITEURS</div>
                <div style="font-size:16px; font-weight:900; color:#9a3412;">${Math.round(c.pct_jeunes_competiteurs_18m || 0)}%</div>
            </div>
        </div>

        <div style="margin-bottom:12px;">${listP}</div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; font-size:11px; max-height:150px; overflow-y:auto;">
            <div style="font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:5px;">🎯 Technique</div>
            <ul style="margin:0 0 10px 0; padding-left:15px;">${listE}</ul>
            <div style="font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:5px;">⚖️ Arbitres</div>
            <ul style="margin:0; padding-left:15px;">${listA}</ul>
        </div>

        <div style="margin-top:12px; display:flex; justify-content:center; gap:20px; border-top:1px solid #f1f5f9; padding-top:10px;">
            <a href="mailto:${esc(c.email)}" style="color:#002395; font-weight:800; text-decoration:none; font-size:12px;">✉ Mail</a>
            ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color:#002395; font-weight:800; text-decoration:none; font-size:12px;">🌐 Site</a>` : ''}
        </div>
    </div>`;
}

/** 4. LOGIQUE FILTRES **/
function applyFilters(){
    const q = document.getElementById("search").value.toLowerCase().trim();
    const dept = document.getElementById("dept").value;
    const practice = document.getElementById("practice").value;
    const coach = document.getElementById("coachLevel").value;
    const onlyJeunes = document.getElementById("checkJeunes").checked;
    const withArbitre = document.getElementById("checkArbitre").checked;

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
    const isClustered = document.getElementById("clusterToggle").checked;
    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        const color = "#002395";
        let m = L.circleMarker([c.lat, c.lng], { radius: 8 + Math.sqrt(c.licences_total), color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
        m.bindPopup(makePopupHtml(c), { maxWidth: 400 });
        if(isClustered) clustersLayer.addLayer(m);
        else plainLayer.addLayer(m);
    });

    const topClubs = [...filtered].sort((a, b) => b.licences_total - a.licences_total).slice(0, 10);
    document.getElementById("list").innerHTML = topClubs.map(c => `
        <div class="list-item" onclick="map.setView([${c.lat}, ${c.lng}], 15)" style="display:flex; justify-content:space-between; padding:12px; cursor:pointer;">
            <div>
                <div style="font-weight:800; font-size:12px;">${esc(c.nom)}</div>
                <div style="font-size:10px; color:#64748b;">${esc(c.ville)}</div>
            </div>
            <div style="background:#e6e9f5; color:#002395; font-weight:800; padding:4px 8px; border-radius:6px;">${c.licences_total}</div>
        </div>
    `).join("");
    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs affichés`;
}

/** 5. INIT & CHARGEMENT DES FILTRES **/
async function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    const btn = document.getElementById('panelBtn'), side = document.querySelector('.sidebar'), over = document.getElementById('overlay');
    btn.onclick = () => { side.classList.toggle('open'); over.classList.toggle('show'); };
    over.onclick = () => { side.classList.remove('open'); over.classList.remove('show'); };

    document.getElementById("searchValidate").onclick = applyFilters;
    ["dept", "practice", "coachLevel", "clusterToggle", "checkJeunes", "checkArbitre"].forEach(id => {
        document.getElementById(id).onchange = applyFilters;
    });

    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        
        clubs = data.map((c, i) => ({ 
            ...c, 
            id: c.id || i, 
            lat: Number(c.lat), 
            lng: Number(c.lon || c.lng),
            arbitres: Array.isArray(c.arbitres) ? c.arbitres : [], // Sécurité
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : [] // Sécurité
        }));
        
        // Remplissage menu Départements
        const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
        document.getElementById("dept").innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        
        // CORRECTION : Remplissage menu Entraîneurs
        const coachs = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();
        document.getElementById("coachLevel").innerHTML = `<option value="">Entraîneurs</option>` + coachs.map(l => `<option value="${l}">${l}</option>`).join("");

        applyFilters();
    } catch (e) { console.error("Erreur chargement JSON:", e); }
}

document.addEventListener("DOMContentLoaded", init);
