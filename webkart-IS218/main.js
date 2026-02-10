// 1) Start kartet (midt på Norge-ish)
const map = L.map("map").setView([59.91, 10.75], 6);

// 2) Basiskart
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap contributors",
}).addTo(map);

// 3) Last inn GeoJSON (Agder-fylke)
fetch("data/fylker_agder.geojson")
  .then((res) => {
    if (!res.ok) throw new Error("Fant ikke GeoJSON-fila. Sjekk path/filnavn.");
    return res.json();
  })
  .then((data) => {
    const fylkeLayer = L.geoJSON(data, {
      style: () => ({
        color: "blue",
        weight: 2,
        fillOpacity: 0.25,
      }),
      onEachFeature: (feature, layer) => {
        // viser alle attributter i popup (enkelt og robust)
        const props = feature.properties || {};
        const html = Object.entries(props)
          .map(([k, v]) => `<strong>${k}</strong>: ${v}`)
          .join("<br>");

        layer.bindPopup(html || "Ingen attributter funnet");
      },
    }).addTo(map);

    // Zoom automatisk til fylket (så du faktisk ser det)
    map.fitBounds(fylkeLayer.getBounds());
  })
  .catch((err) => {
    console.error(err);
    alert("Feil ved lasting av
