// ================= CONFIG =================
const DATA_URL = "./clubs.json";

// ================= UTILS =================
function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ================= NOUVEAU : AFFICHAGE PERSONNES =================
function renderNamedPeople(list, emptyText, valueKey){
  if(!Array.isArray(list) || !list.length){
    return `<div style="font-size:12px;color:#64748b;margin-top:6px">${emptyText}</div>`;
  }

  const sorted = list.slice().sort((a,b) =>
    String(a.nom || "").localeCompare(String(b.nom || ""), "fr")
  );

  return `<ul>${sorted.map(x => {
    const detail = x && x[valueKey] ? ` — <b>${esc(x[valueKey])}</b>` : "";
    return `<li>${esc(x?.nom || "Nom non renseigné")}${detail}</li>`;
  }).join("")}</ul>`;
}

// ================= POPUP =================
function makePopupHtml(c){

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

  return `
  <div class="popup">

    <h3>${esc(c.nom)}</h3>

    <div class="split">
      <div class="box wide">
        <div class="t">Licenciés</div>
        <div class="v">${c.licences_total}</div>
      </div>

      <div class="box wide">
        <div class="t">Arbitres</div>
        <div class="v">${c.nb_arbitres}</div>
      </div>
    </div>

    <!-- ✅ NOUVEAU -->
    <div class="split">
      <div class="box wide">
        <div class="t">Arbitres (détail)</div>
        ${arbitresLines}
      </div>

      <div class="box wide">
        <div class="t">Entraîneurs</div>
        ${entraineursLines}
      </div>
    </div>

  </div>
  `;
}

// ================= MAP =================
let map = L.map('map').setView([46.5, 2.5], 6);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// ================= LOAD DATA =================
fetch(DATA_URL)
  .then(res => res.json())
  .then(data => {

    data.forEach(c => {

      if(!c.lat || !c.lon) return;

      const marker = L.marker([c.lat, c.lon]).addTo(map);

      marker.on("click", () => {
        marker.bindPopup(makePopupHtml(c)).openPopup();
      });

    });

  })
  .catch(err => {
    console.error("Erreur chargement JSON :", err);
  });
