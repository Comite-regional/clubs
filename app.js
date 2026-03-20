/** 1. CONFIGURATION **/
const MAP_CENTER = [47.35, -1.75];
const MAP_ZOOM = 8;
const RADIUS_KM = 20; 

let map, clustersLayer, plainLayer, clubs = [], filtered = [];
let displayMode = "licences"; 
let userCoords = null; 

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
}[c]));

/** 2. UTILITAIRES **/

function getDeptColor(cpOrCode) {
    const dept = String(cpOrCode).substring(0, 2);
    switch(dept) {
        case '44': return '#002395'; 
        case '49': return '#8B4513'; 
        case '53': return '#ef4444'; 
        case '72': return '#22c55e'; 
        case '85': return '#ec4899'; 
        default: return '#64748b';   
    }
}

function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function pieSvg(pct, color = "#2563eb", size = 40) {
    const p = Math.max(0, Math.min(100, Number(pct||0)));
    const r = 22, c = 2 * Math.PI * r;
    const filled = c * (p/100);
    return `
    <svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display:block">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="9"></circle>
        <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="9"
            stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
        <text x="28" y="33" text-anchor="middle" font-size="11" font-weight="800" fill="#1e293b">${Math.round(p)}%</text>
    </svg>`;
}

function labelBadge(label) {
    if (!label || label === "Non" || label === "Aucun") return "";
    const fileName = "label_" + label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + ".png";
    return `<img src="assets/${fileName}" title="${esc(label)}" style="height: 24px; margin-left: 8px; vertical-align: middle;" onerror="this.style.display='none'">`;
}

/** 3. RENDU DU POPUP **/
function makePopupHtml(c) {
    const listE = c.entraineurs?.length ? c.entraineurs.map(e => `<li>${esc(e.nom)} <span style="color:#64748b">(${esc(e.diplome)})</span></li>`).join("") : "<li><em>Aucun entraîneur</em></li>";
    const listA = c.arbitres?.length ? c.arbitres.map(a => `<li>${esc(a.nom)} <span style="color:#64748b">(${esc(a.niveau)})</span></li>`).join("") : "<li><em>Aucun arbitre</em></li>";
    const tagsPratiques = c.pratiques?.length ? c.pratiques.map(p => `<span style="display:inline-block; background:#e2e8f0; padding:2px 8px; border-radius:10px; margin:2px; font-size:10px; font-weight:600;">${esc(p)}</span>`).join("") : "";
    const deptColor = getDeptColor(c.cp);

    return `
    <div style="width: 360px; font-family: 'Inter', sans-serif; color: #1e293b; padding: 5px;">
        <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #f1f5f9; padding-bottom:12px; margin-bottom:12px;">
            <img src="${c.logo_url || 'Unknown.png'}" style="width:55px; height:55px; object-fit:contain;" onerror="this.src='Unknown.png'">
            <div style="flex:1;">
                <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                    <span style="font-weight:900; font-size:15px; text-transform:uppercase; color:${deptColor}">${esc(c.nom)}</span>
                    ${labelBadge(c.label_club)}
                </div>
                <div style="font-size:11px; color:#64748b; font-weight:600;">Président : ${esc(c.president || 'Non renseigné')}</div>
                <div style="font-size:11px; color:#94a3b8;">${esc(c.ville)} (${c.cp})</div>
            </div>
        </div>

        <div style="margin-bottom:15px;">
            <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:800; margin-bottom:4px;">
                <span style="color:#ec4899;">FEMMES ${Math.round(c.pct_femmes)}%</span>
                <span style="color:#002395;">HOMMES ${Math.round(100 - c.pct_femmes)}%</span>
            </div>
            <div style="display:flex; height:8px; border-radius:4px; overflow:hidden; background:#eee;">
                <div style="width:${c.pct_femmes}%; background:#ec4899;"></div>
                <div style="width:${100 - c.pct_femmes}%; background:#002395;"></div>
            </div>
        </div>

        <div style="margin-bottom:15px; background:#f8fafc; padding:10px; border-radius:8px; border:1px solid #e2e8f0;">
            <div style="font-size:10px; font-weight:800; color:#475569; margin-bottom:8px; text-transform:uppercase;">📊 Répartition des Licences</div>
            <div style="font-size:10px; margin-bottom:4px; display:flex; justify-content:space-between;">
                <span>Compétition: <b>${c.pct_licences_competition}%</b></span>
                <span>Loisir: <b>${c.pct_licences_loisir}%</b></span>
            </div>
            <div style="display:flex; height:6px; border-radius:3px; overflow:hidden; background:#e2e8f0; margin-bottom:10px;">
                <div style="width:${c.pct_licences_competition}%; background:${deptColor};"></div>
                <div style="width:${c.pct_licences_loisir}%; background:#94a3b8;"></div>
                <div style="width:${c.pct_licences_dirigeant}%; background:#cbd5e1;"></div>
            </div>
            <div style="font-size:10px; color:#1e40af; font-weight:700;">
                🎯 Taux de compétiteurs réels (18m) : ${Math.round(c.pct_competiteurs_18m_licence_competition)}%
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:15px;">
            <div style="background:#eff6ff; padding:8px; border-radius:10px; text-align:center; border:1px solid #dbeafe;">
                <div style="font-size:8px; font-weight:800; color:#1e40af;">TOTAL LICENCIÉS</div>
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
                <div style="font-size:8px; font-weight:800; color:#9a3412;">JEUNES COMP.</div>
                <div style="font-size:16px; font-weight:900; color:#9a3412;">${Math.round(c.pct_jeunes_competiteurs_18m || 0)}%</div>
            </div>
        </div>

        <div style="margin-bottom:12px;">${tagsPratiques}</div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px; font-size:11px; max-height:120px; overflow-y:auto;">
            <div style="font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:5px;">🎯 Entraîneurs</div>
            <ul style="margin:0 0 10px 0; padding-left:15px;">${listE}</ul>
            <div style="font-weight:800; text-transform:uppercase; color:#475569; margin-bottom:5px;">⚖️ Arbitres</div>
            <ul style="margin:0; padding-left:15px;">${listA}</ul>
        </div>
        
        <div style="margin-top:12px; display:flex; justify-content:center; gap:20px; border-top:1px solid #f1f5f9; padding-top:10px;">
            <a href="mailto:${esc(c.email)}" style="color:${deptColor}; font-weight:800; text-decoration:none; font-size:12px;">✉ Mail</a>
            ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color:${deptColor}; font-weight:800; text-decoration:none; font-size:12px;">🌐 Site Web</a>` : ''}
        </div>
    </div>`;
}

/** 4. FILTRES ET DESSIN **/
function applyFilters(){
    const q = document.getElementById("search").value.toLowerCase().trim();
    const dept = document.getElementById("dept").value;
    const practice = document.getElementById("practice").value;
    const coach = document.getElementById("coachLevel").value;
    
    const withArbitreEl = document.getElementById("checkArbitre");
    const withArbitre = withArbitreEl ? withArbitreEl.checked : false;

    filtered = clubs.filter(c => {
        const okSearch = !q || `${c.nom} ${c.ville} ${c.cp}`.toLowerCase().includes(q);
        const okDept = !dept || c.departement === dept;
        const okPrac = !practice || (c.pratiques && c.pratiques.includes(practice));
        const okCoach = !coach || (c.entraineurs && c.entraineurs.some(e => e.diplome === coach));
        const okArbitre = !withArbitre || (c.a_arbitre === true);
        
        let okDist = true;
        if(userCoords) {
            const d = getDistance(userCoords.lat, userCoords.lng, c.lat, c.lng);
            okDist = d <= RADIUS_KM;
        }
        return okSearch && okDept && okPrac && okCoach && okArbitre && okDist;
    });
    renderAll();
}

function renderAll(){
    if(!map) return;
    
    clustersLayer.clearLayers();
    plainLayer.clearLayers();
    
    filtered.forEach(c => {
        let m;
        const colorDept = getDeptColor(c.cp);

        if (displayMode === "licences") {
            m = L.circleMarker([c.lat, c.lng], { 
                radius: 6 + Math.sqrt(c.licences_total), 
                color: "#fff", weight: 2, 
                fillColor: colorDept, 
                fillOpacity: 0.9 
            });
        } else {
            let pct = 0, colorMode = colorDept;
            if (displayMode === "femmes") { pct = c.pct_femmes; colorMode = "#ec4899"; }
            else if (displayMode === "para") { pct = c.pct_para; colorMode = "#a855f7"; }
            else if (displayMode === "jeunes") { pct = c.pourcentage_jeunes; colorMode = "#3b82f6"; }

            const icon = L.divIcon({
                html: `<div style="transform:translate(-20px,-20px)">${pieSvg(pct, colorMode, 40)}</div>`,
                className: '', iconSize: [40, 40]
            });
            m = L.marker([c.lat, c.lng], { icon });
        }
        m.bindPopup(makePopupHtml(c), { maxWidth: 400 });
        plainLayer.addLayer(m);
    });

    let topClubs = [...filtered];
    if (displayMode === "licences") topClubs.sort((a, b) => b.licences_total - a.licences_total);
    else if (displayMode === "femmes") topClubs.sort((a, b) => b.pct_femmes - a.pct_femmes);
    else if (displayMode === "para") topClubs.sort((a, b) => b.pct_para - a.pct_para);
    else if (displayMode === "jeunes") topClubs.sort((a, b) => b.pourcentage_jeunes - a.pourcentage_jeunes);

    // MISE À JOUR : Ajout du style pour le SCROLL (max-height et overflow)
    const listContainer = document.getElementById("list");
    listContainer.style.maxHeight = "400px"; 
    listContainer.style.overflowY = "auto";
    listContainer.style.paddingRight = "5px";

    listContainer.innerHTML = topClubs.slice(0, 10).map(c => {
        let valToDisplay, valColor;
        if (displayMode === "licences") { valToDisplay = c.licences_total; valColor = getDeptColor(c.cp); }
        else if (displayMode === "femmes") { valToDisplay = Math.round(c.pct_femmes) + "%"; valColor = "#ec4899"; }
        else if (displayMode === "para") { valToDisplay = Math.round(c.pct_para) + "%"; valColor = "#a855f7"; }
        else if (displayMode === "jeunes") { valToDisplay = Math.round(c.pourcentage_jeunes) + "%"; valColor = "#3b82f6"; }

        return `
        <div class="list-item" onclick="map.setView([${c.lat}, ${c.lng}], 15)" style="border-left: 4px solid ${getDeptColor(c.cp)}; display: flex; justify-content: space-between; align-items: center; padding: 10px; cursor: pointer; background: white; margin-bottom: 5px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <div>
                <div style="font-weight:700; font-size:12px;">${esc(c.nom)}</div>
                <div style="font-size:10px; color:#64748b;">${esc(c.ville)}</div>
            </div>
            <div style="font-weight:800; font-size:11px; color:${valColor}; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; min-width: 45px; text-align: center;">
                ${valToDisplay}
            </div>
        </div>`
    }).join("");

    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs affichés`;
}

/** 5. INIT **/
async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        clubs = data.map((c, i) => ({ 
            ...c, 
            id: c.id || i, 
            lat: Number(c.lat), 
            lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pct_femmes: Number(c.pct_femmes || 0),
            pct_para: Number(c.pct_para || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            pct_licences_competition: Number(c.pct_licences_competition || 0),
            pct_licences_loisir: Number(c.pct_licences_loisir || 0),
            pct_licences_dirigeant: Number(c.pct_licences_dirigeant || 0),
            pct_competiteurs_18m_licence_competition: Number(c.pct_competiteurs_18m_licence_competition || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : []
        }));
        
        const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
        document.getElementById("dept").innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        
        const coachLevels = [...new Set(clubs.flatMap(c => c.entraineurs.map(e => e.diplome)))].filter(Boolean).sort();
        const coachSelect = document.getElementById("coachLevel");
        if(coachSelect) coachSelect.innerHTML = `<option value="">Entraîneurs</option>` + coachLevels.map(l => `<option value="${l}">${l}</option>`).join("");

        applyFilters();
    } catch (e) { console.error("Erreur chargement clubs.json", e); }
}

async function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png').addTo(map);

    // Frontières départementales
    try {
        const geoRes = await fetch("https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson");
        const geoData = await geoRes.json();
        const pdlDepts = ["44", "49", "53", "72", "85"];
        L.geoJSON(geoData, {
            filter: (f) => pdlDepts.includes(f.properties.code),
            style: (f) => ({ color: getDeptColor(f.properties.code), weight: 2, fillOpacity: 0.02, dashArray: '5, 8' })
        }).addTo(map);
    } catch (e) { console.log("Erreur GeoJSON frontières", e); }

    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

    const panelBtn = document.getElementById('panelBtn');
    if(panelBtn) panelBtn.onclick = () => { document.querySelector('.sidebar').classList.toggle('open'); document.getElementById('overlay').classList.toggle('show'); };

    document.querySelectorAll(".segBtn").forEach(btn => {
        btn.onclick = () => {
            displayMode = btn.dataset.mode;
            document.querySelectorAll(".segBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            applyFilters();
        };
    });

    ["dept", "practice", "coachLevel", "checkArbitre"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = applyFilters;
    });
    document.getElementById("search").oninput = applyFilters;

    await loadData();
}

document.addEventListener("DOMContentLoaded", init);