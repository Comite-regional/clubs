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
    if (!label || label === "Non") return "";
    // On adapte le nom du label pour correspondre au nom de fichier image (ex: "Label Citoyen" -> "citoyen")
    const key = String(label).toLowerCase().replace("label ", "").trim();
    return `<img src="assets/label_${key}.png" title="${esc(label)}" style="height: 24px; vertical-align: middle; margin-left: 8px;" onerror="this.style.display='none'">`;
}

function pieSvg(pct, color = "#2563eb", size = 40, showText = true) {
    const p = Math.max(0, Math.min(100, Number(pct||0)));
    const r = 22, c = 2 * Math.PI * r;
    const filled = c * (p/100);
    return `
    <svg viewBox="0 0 56 56" width="${size}" height="${size}" style="display:block">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#e2e8f0" stroke-width="9"></circle>
        <circle cx="28" cy="28" r="22" fill="none" stroke="${color}" stroke-width="9"
            stroke-linecap="round" stroke-dasharray="${filled} ${c-filled}" transform="rotate(-90 28 28)"></circle>
        ${showText ? `<text x="28" y="33" text-anchor="middle" font-size="11" font-weight="800" fill="#1e293b">${Math.round(p)}%</text>` : ''}
    </svg>`;
}

/** 3. RENDU DU POPUP ENRICHI **/

function makePopupHtml(c) {
    const listE = c.entraineurs?.length ? c.entraineurs.map(e => `<li>${esc(e.nom)} <span style="color:#64748b">(${esc(e.diplome)})</span></li>`).join("") : "<li><em>Aucun</em></li>";
    const listA = c.arbitres?.length ? c.arbitres.map(a => `<li>${esc(a.nom)} <span style="color:#64748b">(${esc(a.niveau)})</span></li>`).join("") : "<li><em>Aucun</em></li>";
    const listP = c.pratiques?.length ? c.pratiques.map(p => `<span style="display:inline-block; background:#e2e8f0; padding:2px 8px; border-radius:10px; margin:2px; font-size:10px; font-weight:600;">${esc(p)}</span>`).join("") : "";

    return `
    <div style="width: 360px; font-family: 'Inter', sans-serif; color: #1e293b; padding: 5px;">
        <div style="display:flex; align-items:center; gap:12px; border-bottom:2px solid #f1f5f9; padding-bottom:12px; margin-bottom:12px;">
            <img src="${c.logo_url || 'assets/logo_placeholder.svg'}" style="width:60px; height:60px; object-fit:contain;" onerror="this.src='assets/logo_placeholder.svg'">
            <div style="flex:1; min-width:0;">
                <div style="display:flex; align-items:center; flex-wrap:wrap;">
                    <span style="font-weight:900; font-size:16px; text-transform:uppercase;">${esc(c.nom)}</span>
                    ${labelBadge(c.label_club)}
                </div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">${esc(c.ville)} • Prés : <strong>${esc(c.president || 'N/C')}</strong></div>
            </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; margin-bottom:15px;">
            <div style="background:#eff6ff; padding:10px; border-radius:10px; text-align:center; border:1px solid #dbeafe;">
                <div style="font-size:9px; font-weight:800; color:#1e40af; margin-bottom:4px;">LICENCIÉS</div>
                <div style="font-size:16px; font-weight:900; color:#1e40af;">${c.licences_total}</div>
            </div>
            <div style="background:#f0fdf4; padding:10px; border-radius:10px; text-align:center; border:1px solid #dcfce7;">
                <div style="font-size:9px; font-weight:800; color:#166534; margin-bottom:4px;">% JEUNES</div>
                <div style="font-size:16px; font-weight:900; color:#166534;">${Math.round(c.pourcentage_jeunes)}%</div>
            </div>
            <div style="background:#fff7ed; padding:10px; border-radius:10px; text-align:center; border:1px solid #ffedd5;">
                <div style="font-size:9px; font-weight:800; color:#9a3412; margin-bottom:4px;">COMPÉTITION</div>
                <div style="font-size:16px; font-weight:900; color:#9a3412;">${Math.round(c.pct_jeunes_competiteurs_18m || 0)}%</div>
            </div>
        </div>

        <div style="margin-bottom:15px; display:flex; flex-wrap:wrap; gap:4px;">${listP}</div>

        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; max-height:160px; overflow-y:auto; font-size:12px;">
            <div style="font-weight:800; text-transform:uppercase; font-size:10px; color:#475569; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span>🎯 Équipe Technique</span>
            </div>
            <ul style="margin:0 0 12px 0; padding-left:18px; list-style-type: square;">${listE}</ul>
            
            <div style="font-weight:800; text-transform:uppercase; font-size:10px; color:#475569; border-bottom:1px solid #e2e8f0; padding-bottom:4px; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
                <span>⚖️ Corps Arbitral</span>
            </div>
            <ul style="margin:0; padding-left:18px; list-style-type: square;">${listA}</ul>
        </div>

        <div style="margin-top:15px; display:flex; justify-content:center; gap:25px; border-top:1px solid #f1f5f9; padding-top:12px;">
            <a href="mailto:${esc(c.email)}" style="color:#2563eb; font-weight:800; text-decoration:none; font-size:13px;">✉ Envoyer un mail</a>
            ${c.site ? `<a href="${esc(c.site)}" target="_blank" style="color:#2563eb; font-weight:800; text-decoration:none; font-size:13px;">🌐 Site Internet</a>` : ''}
        </div>
    </div>`;
}

/** 4. LOGIQUE FILTRES & TOP CLUBS **/

function applyFilters(){
    const q = document.getElementById("search")?.value.toLowerCase().trim() || "";
    const dept = document.getElementById("dept")?.value || "";
    const practice = document.getElementById("practice")?.value || "";
    const coach = document.getElementById("coachLevel")?.value || "";
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
        let m;
        const color = (displayMode === "femmes") ? "#ec4899" : (displayMode === "para" ? "#10b981" : (displayMode === "jeunes" ? "#3b82f6" : "#2563eb"));
        
        if (displayMode === "licences") {
            const radius = 6 + Math.sqrt(c.licences_total) * 1.8;
            m = L.circleMarker([c.lat, c.lng], { radius, color: "#fff", weight: 2, fillColor: color, fillOpacity: 0.8 });
        } else {
            const pct = (displayMode === "femmes") ? c.pct_femmes : (displayMode === "para" ? c.pct_para : c.pourcentage_jeunes);
            const icon = L.divIcon({
                html: `<div style="transform:translate(-20px,-20px)">${pieSvg(pct, color, 40)}</div>`,
                className: '', iconSize: [40, 40]
            });
            m = L.marker([c.lat, c.lng], { icon });
        }

        m.bindPopup(makePopupHtml(c), { maxWidth: 450 });
        if(isClustered && displayMode === "licences") clustersLayer.addLayer(m);
        else plainLayer.addLayer(m);
    });

    // --- MISE À JOUR DU TOP 10 (Gauché) ---
    const elList = document.getElementById("list");
    if (elList) {
        // On trie par nombre de licenciés décroissant
        const topClubs = [...filtered].sort((a, b) => b.licences_total - a.licences_total).slice(0, 10);
        
        elList.innerHTML = topClubs.map(c => `
            <div class="list-item" onclick="map.setView([${c.lat}, ${c.lng}], 14); clubs.find(cl => cl.id === ${c.id}) ? null : null;" 
                 style="display:flex; justify-content:space-between; align-items:center; padding:12px; border-bottom:1px solid #f1f5f9; cursor:pointer;">
                <div style="flex:1; min-width:0; padding-right:10px;">
                    <div style="font-weight:700; font-size:12px; color:#1e293b; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(c.nom)}</div>
                    <div style="font-size:10px; color:#64748b;">${esc(c.ville)}</div>
                </div>
                <div style="background:#eff6ff; color:#2563eb; font-weight:800; font-size:13px; padding:4px 10px; border-radius:6px; min-width:45px; text-align:center;">
                    ${c.licences_total}
                </div>
            </div>
        `).join("");
    }

    document.getElementById("stats").innerHTML = `<strong>${filtered.length}</strong> clubs affichés`;
}

/** 5. CHARGEMENT & INIT **/

async function loadData() {
    try {
        const res = await fetch("./clubs.json");
        const data = await res.json();
        // Attribution d'un ID unique si absent pour faciliter la gestion de la liste
        clubs = data.map((c, index) => ({
            ...c,
            id: c.id || index,
            lat: Number(c.lat), lng: Number(c.lon || c.lng),
            licences_total: Number(c.licences_total || 0),
            pourcentage_jeunes: Number(c.pourcentage_jeunes || 0),
            pct_femmes: Number(c.pct_femmes || 0),
            pct_para: Number(c.pct_para || 0),
            pct_jeunes_competiteurs_18m: Number(c.pct_jeunes_competiteurs_18m || 0),
            entraineurs: Array.isArray(c.entraineurs) ? c.entraineurs : [],
            arbitres: Array.isArray(c.arbitres) ? c.arbitres : [],
            pratiques: Array.isArray(c.pratiques) ? c.pratiques : [],
            niveaux_entraineurs: Array.isArray(c.niveaux_entraineurs) ? c.niveaux_entraineurs : []
        }));

        // Remplissage dynamique des menus
        const elDept = document.getElementById("dept");
        if(elDept) {
            const depts = [...new Set(clubs.map(c => c.departement))].filter(Boolean).sort();
            elDept.innerHTML = `<option value="">Département</option>` + depts.map(d => `<option value="${d}">${d}</option>`).join("");
        }

        const elCoach = document.getElementById("coachLevel");
        if(elCoach) {
            const coachs = [...new Set(clubs.flatMap(c => c.niveaux_entraineurs.map(n => n.niveau)))].filter(Boolean).sort();
            elCoach.innerHTML = `<option value="">Diplômes</option>` + coachs.map(l => `<option value="${l}">${l}</option>`).join("");
        }

        applyFilters();
    } catch (e) { console.error(e); }
}

function init() {
    map = L.map("map", { zoomControl: false }).setView(MAP_CENTER, MAP_ZOOM);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png").addTo(map);
    plainLayer = L.layerGroup().addTo(map);
    clustersLayer = L.markerClusterGroup().addTo(map);

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
