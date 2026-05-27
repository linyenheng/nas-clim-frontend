//Leaflet map
const map = L.map("map", {
  zoom: 10, 
  minZoom: 10, 
  maxZoom: 17
  }
  ).fitBounds([
  [29.3, -95.5],
  [30.1, -94.5]
]);

// Layers
const astLayer     = null;
const stm = L.tileLayer("https://cartodb-basemaps-b.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png", {
  attribution:"© Stamen"
}).addTo(map);
const rp2tileLayer = {           // Floodmap tilesets. Hosted on mappinest because it's free
  'f25yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.25yrflood/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}),
  'f50yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.50yrflood/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}),
  'f100yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.100yrflood/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}), 
  's100yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.s100_mean/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}), 
};


// Markers and marker styles
let circleMarker   = null;   
let gridMarker     = null;  
const id2circles   = {};    
const circleStyleDefault = {
        radius:      5,
        color:       "#6b0202",
        fillColor:   "#ad3444",
        fillOpacity: 0.85,
        weight:      1.5,
      };
const circleStyleSelected = {
    radius:      9,
    color:       "#800414",
    fillColor:   "red",
    fillOpacity: 0.95,
    weight:      2.5,
  }
const circleStyleUnflooded = {
  radius:      4,
  color:       "gray",
  fillColor:   "darkgray",
  fillOpacity: 0.6,
  opacity:     0.6,
  weight:      .6,
}





