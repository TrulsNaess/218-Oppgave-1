// =======================
// Webkart – Agder
// =======================

// 1) Start kartet
const map = L.map("map").setView([59.91, 10.75], 6);
map.doubleClickZoom.disable(); // vi bruker dblclick til reset

// 2) Basiskart (OSM)
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

// Layer control
const baseMaps = { OpenStreetMap: osm };
const overlays = {};
const layerControl = L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

// -----------------------
// Popup-stil for fylke
// -----------------------
function formatDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function popupHtml(props) {
  const navn = props.fylkesnavn || props.navn || "Ukjent område";
  const nr = props.fylkesnummer ?? props.fylkenummer ?? "";

  const rows = [
    ["Fylkesnavn", navn],
    ["Fylkesnummer", nr],
    ["Gyldig fra", formatDate(props.gyldigFra)],
    ["Oppdatert", formatDate(props.oppdateringsdato)],
    ["Versjon", props.versjonId ?? ""],
  ];

  const tableRows = rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
    .join("");

  return `
    <div class="popup">
      <div class="popup-title">${navn}</div>
      <table class="popup-table">${tableRows}</table>
    </div>
  `;
}

function defaultStyle() {
  return { color: "blue", weight: 2, fillOpacity: 0.25, opacity: 1 };
}

function highlightStyle() {
  return { color: "blue", weight: 3, fillOpacity: 0.35, opacity: 1 };
}

// -----------------------
// Romlig filtrering (30 km)
// -----------------------
let filterCircle = null;

function setVisible(layer, visible) {
  if (layer.setStyle) {
    // polygon/linje/punkt (circleMarker har setStyle)
    layer.setStyle(
      visible
        ? { opacity: 1, fillOpacity: 0.85 }
        : { opacity: 0, fillOpacity: 0 }
    );
  } else if (layer.setOpacity) {
    // marker
    layer.setOpacity(visible ? 1 : 0);
  }
}

function filterGeoJsonLayerWithinRadius(geoJsonLayer, centerLatLng, radiusMeters) {
  const center = turf.point([centerLatLng.lng, centerLatLng.lat]);

  geoJsonLayer.eachLayer((featureLayer) => {
    const feature = featureLayer.feature;
    if (!feature) return;

    // centroid fungerer for punkt/linje/polygon
    const c = turf.centroid(feature);
    const distKm = turf.distance(center, c, { units: "kilometers" });
    const inside = distKm * 1000 <= radiusMeters;

    setVisible(featureLayer, inside);
  });
}

function resetGeoJsonFilter(geoJsonLayer) {
  geoJsonLayer.eachLayer((featureLayer) => setVisible(featureLayer, true));
  if (filterCircle) {
    map.removeLayer(filterCircle);
    filterCircle = null;
  }
}

// -----------------------
// Lag 1: Fylke (Agder)
// -----------------------
fetch("data/fylker_agder.geojson")
  .then((res) => {
    if (!res.ok) throw new Error("Fant ikke data/fylker_agder.geojson (404).");
    return res.json();
  })
  .then((data) => {
    const fylkeLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature: (feature, layer) => {
        layer.bindPopup(popupHtml(feature.properties || {}), { maxWidth: 320 });
        layer.on("mouseover", () => layer.setStyle(highlightStyle()));
        layer.on("mouseout", () => layer.setStyle(defaultStyle()));
      },
    }).addTo(map);

    layerControl.addOverlay(fylkeLayer, "Fylke (GeoJSON)");
    map.fitBounds(fylkeLayer.getBounds(), { padding: [20, 20] });
  })
  .catch((err) => console.error(err));

// -----------------------
// Lag 2: Brannstasjoner (punkt)
// -----------------------
let brannLayer = null;

fetch("data/brannstasjon.geojson")
  .then((res) => {
    if (!res.ok) throw new Error("Fant ikke data/brannstasjon.geojson (404).");
    return res.json();
  })
  .then((data) => {
    brannLayer = L.geoJSON(data, {
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, {
          radius: 6,
          color: "red",
          fillColor: "red",
          fillOpacity: 0.85,
        }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};

        // Robust navne-håndtering (felt kan variere)
        const navn =
          p.navn ||
          p.NAVN ||
          p.stasjonsnavn ||
          p.STASJONSNAVN ||
          p.name ||
          "Brannstasjon";

        const kommune =
          p.kommune ||
          p.kommunenavn ||
          p.KOMMUNE ||
          "";

        const adresse =
          p.adresse ||
          p.vegadresse ||
          p.ADRESSE ||
          "";

        // Popup ved klikk
        layer.bindPopup(`
          <strong>${navn}</strong><br>
          ${kommune ? `Kommune: ${kommune}<br>` : ""}
          ${adresse ? `Adresse: ${adresse}` : ""}
        `);

      },
    }).addTo(map);

    layerControl.addOverlay(brannLayer, "Brannstasjoner");
  })
  .catch((err) => console.error(err));




  // SKRED //
  let skredLayer = null;

fetch("data/skred.geojson")
  .then((res) => {
    if (!res.ok) throw new Error("Fant ikke data/skred.geojson (404).");
    return res.json();
  })
  .then((data) => {
    console.log("Skredfaresoner:", data.features?.length);

    skredLayer = L.geoJSON(data, {
      style: (feature) => {
        const p = feature.properties || {};
        const fare = p.faregrad || p.klasse || p.nivaa || p.fare || "";

        const high =
          String(fare).toLowerCase().includes("høy") ||
          String(fare).includes("3") ||
          String(fare).toLowerCase().includes("high");

        return {
          color: high ? "darkred" : "orange",
          weight: 2,
          fillOpacity: 0.25,
        };
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        const title = p.navn || p.omrade || p.id || "Skredfaresone";
        const fare = p.faregrad || p.klasse || p.nivaa || p.fare || "";
        const type = p.skredtype || p.type || "";

        layer.bindPopup(`
          <strong>${title}</strong><br>
          ${fare ? `Faregrad/klasse: ${fare}<br>` : ""}
          ${type ? `Type: ${type}` : ""}
        `);
      },
    }).addTo(map);

    layerControl.addOverlay(skredLayer, "Skredfaresoner");
  })
  .catch((err) => console.error(err));


// -----------------------
// Interaksjon: SHIFT+klikk filtrerer, dblclick reset
// -----------------------
const radiusMeters = 30000;

// SHIFT + klikk = filtrer brannstasjoner innen 30 km
map.on("click", (e) => {
  if (!brannLayer) return;

  // Bare filtrer når du holder SHIFT
  if (!e.originalEvent.shiftKey) return;

  if (filterCircle) map.removeLayer(filterCircle);
  filterCircle = L.circle(e.latlng, { radius: radiusMeters }).addTo(map);

  filterGeoJsonLayerWithinRadius(brannLayer, e.latlng, radiusMeters);
});

// Dobbelklikk = reset filter
map.on("dblclick", () => {
  if (!brannLayer) return;
  resetGeoJsonFilter(brannLayer);
});

