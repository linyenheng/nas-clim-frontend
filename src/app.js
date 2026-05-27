import { initCharts, updateSurgeCharts, updateFragilityCharts } from "./charts.js"

// const API = "https://nas-clim-api.onrender.com"; 
const API = "https://nas-clim-api-ih6l.onrender.com";
const appState = {
  mode         : "wave",
  rp           : null,   
  circleMarker : null,   
  gridMarker   : null,   
  id2circles   : {},       
  rp2tileLayer : {},
  astLayer     : null,
}


//Leaflet map and styles. I'd normally put styles in the css file, but Leaflet is finicky. 
const map = L.map("map", {
  zoom: 10, 
  minZoom: 10, 
  maxZoom: 17
  }
  ).fitBounds([
  [29.3, -95.5],
  [30.1, -94.5]
]);
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

const stm = L.tileLayer("https://cartodb-basemaps-b.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png", {
  attribution:"© Stamen"
}).addTo(map);


//stm = L.tileLayer("https://tiles.stadiamaps.com/tiles/stamen_toner-lite/{z}/{x}/{y}.png", {
//  attribution:"© Stamen"
//}).addTo(map);

//stm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
//  attribution:"© OpenStreetMap"
//}).addTo(map);

// Floodmap tilesets. Hosted on mappinest because it's free
appState.rp2tileLayer = {
  'f25yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.25yrflood/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}),
  'f50yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.50yrflood/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}),
  'f100yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.100yrflood/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}), 
  's100yr': L.tileLayer("https://api.mappinest.com/v1/tiles/sustielz.s100_mean/{z}/{x}/{y}.png?key=df10599d-b326-494d-ab3f-bab6b231c3c0", 
  {opacity: 0.8, attribution: '(c) Mappinest'}), 
}

// Event listeners. NOTE: the names of tab elements are important; see setRP and setMODE
map.addEventListener("click", clickMap);
document.getElementById("show-tanks"       ).addEventListener("change", toggleAST)
document.getElementById("map-extent-button").addEventListener("click",  applyRange)
document.getElementById("custom-range"     ).addEventListener("change", toggleRange)
document.getElementById("tab-f25yr"        ).addEventListener("click",  setRP); 
document.getElementById("tab-f50yr"        ).addEventListener("click",  setRP); 
document.getElementById("tab-f100yr"       ).addEventListener("click",  setRP); 
document.getElementById("tab-s25yr"        ).addEventListener("click",  setRP); 
document.getElementById("tab-s50yr"        ).addEventListener("click",  setRP); 
document.getElementById("tab-s100yr"       ).addEventListener("click",  setRP); 
document.getElementById("tab-wave"         ).addEventListener("click",  setMode); 
document.getElementById("tab-wind"         ).addEventListener("click",  setMode); 
document.getElementById("tab-rain"         ).addEventListener("click",  setMode); 
document.getElementById("tab-frag"         ).addEventListener("click",  setMode); 


// Handle map clicks (not tank clicks)
function clickMap(event) {

  if (appState.circleMarker) { appState.circleMarker.setStyle(circleStyleDefault); }
  appState.circleMarker = null;
  const lat = parseFloat(event.latlng.lat.toFixed(4));
  const lon = parseFloat(event.latlng.lng.toFixed(4));
  document.getElementById("point-info").innerHTML =
    `Lat: <span>${lat}</span><br>Lon: <span>${lon}</span>`;
  if (appState.gridMarker) {   appState.gridMarker.remove(); appState.gridMarker = null; }
  appState.gridMarker = L.marker([lat, lon]).addTo(map);
  queryWaveSurge(lat, lon);
}

// Handle tank clicks
function clickCircle(event) {
  L.DomEvent.stopPropagation(event); // Prevent double-clicking on the map
  if (appState.circleMarker) {  
    appState.circleMarker.setStyle(circleStyleDefault); 
    if (appState.circleMarker.ast_id === event.target.ast_id) {  appState.circleMarker=null; return; }
  }
  if (appState.gridMarker) { appState.gridMarker.remove(); appState.gridMarker = null; }
  appState.circleMarker = event.target;
  appState.circleMarker.setStyle(circleStyleSelected);
  appState.circleMarker.remove();
  appState.circleMarker.addTo(map);
  queryAST(appState.circleMarker.ast_id);
}

// Handle side-buttons for setting return period
async function setRP(event) {
  const tab = event.target
  const rp = tab.id.slice(4);                            // All connected buttons have id of form "tab-{rp}"
  Object.values(appState.rp2tileLayer).forEach(layer => {    // Remove all flood layers
      if (map.hasLayer(layer)) {  map.removeLayer(layer);
  } });
  [25, 50, 100].forEach( yr => {                   // Unhighlight all buttons
    ['f', 's'].forEach(     c => {
      document.getElementById(`tab-${c}${yr}yr`).className = 'tab';
    });
  });
  
  if (rp === appState.rp) {  
      rp = null;
  } else {
      tab.className = `tab active-${rp[0]}rp`;
      map.addLayer(appState.rp2tileLayer[rp]);
      if ( (appState.astLayer !== null) && (map.hasLayer(appState.astLayer))) { 
        map.removeLayer(appState.astLayer); // Bring AST layer to front 
        map.addLayer(appState.astLayer);
      }
  }
  appState.rp = rp;  
  if (appState.astLayer) {  updateCircles(); }
}

// Handle side-buttons for setting chart data type
function setMode(event) {
  const mode = event.target.id.slice(4);  // All connected buttons have id of form "tab-{mode}"
  if (mode === appState.mode) {  return; }
  appState.mode = mode;
  document.getElementById("tab-wave").className = "tab";
  document.getElementById("tab-frag").className = "tab";
  if (mode === "wave") {
    document.getElementById("tab-wave").className = "tab active-wave";
  } else {
    document.getElementById("tab-frag").className = "tab active-frag";
  }
  Object.values(document.getElementById("appState.charts-area").children).forEach(box => {
    box.style.display="none";
  });
  document.getElementById("point-info").textContent = "No location selected yet.";
  document.getElementById("status").textContent = "";
  
  if (appState.circleMarker) { appState.circleMarker.fire('click');}
  if (appState.astLayer) {  updateCircles(); }
}

// Update circle markers to highlight tanks within the selected flood extent 
function updateCircles() {
  appState.astLayer.eachLayer((circle) => {   circle.setStyle(circleStyleDefault); });
  if (appState.rp) { 
    appState.astLayer.eachLayer((circle) => { 
      (circle[appState.rp.slice(1)] > 0) ? circle.bringToFront() : circle.setStyle(circleStyleUnflooded);
    });
  }
  if (appState.circleMarker) {   appState.circleMarker.setStyle(circleStyleSelected); }
}

function highlightCircles(data) {
  updateCircles();
  console.log(data);
  data['ids'].forEach(id => {
    appState.id2circles[id].setStyle(circleStyleSelected);
    appState.id2circles[id].bringToFront();
    });
  }
  

// Load tank data
async function loadASTPoints() {
  document.getElementById("status").textContent = "Loading AST locations...";
  try {
    const res  = await fetch("./data/tanks_withflood.json");
    const data = await res.json();
    
    if (appState.astLayer) {
      appState.astLayer.clearLayers();
    } else {
      appState.astLayer = L.layerGroup().addTo(map);
    }

    Object.keys(data).forEach(ast_id => {
      let pt = data[ast_id]
      const circle = L.circleMarker([pt.lat, pt.lon], circleStyleDefault).addTo(appState.astLayer);
      circle.addEventListener("click", clickCircle);
      circle.ast_id   = ast_id
      circle["25yr"]  = pt.flood25;
      circle["50yr"]  = pt.flood50;
      circle["100yr"] = pt.flood100;
      appState.id2circles[ast_id] = circle;
      
      circle.bindTooltip(
        `AST ${ast_id} | ${pt.type}`,
        { permanent:false, direction:"top", offset:[0,-5] }
      );
    });
    document.getElementById("status").textContent =
      `${Object.keys(data).length} ASTs loaded. Click a circle to view appState.charts.`;
  } catch(e) {
    document.getElementById("status").textContent =
      `Failed to load ASTs: ${e.message}`;
  }
}

// Toggle AST layer on and off
async function toggleAST() {
  if (appState.astLayer === null)      { await loadASTPoints();     }
  if (document.getElementById("show-tanks").checked) {
    if (!(map.hasLayer(appState.astLayer))) { 
	    map.addLayer(appState.astLayer); 
    }
  } else { 
    if (  map.hasLayer(appState.astLayer) ) { 
	    map.removeLayer(appState.astLayer); 
  	    if (appState.gridMarker) { appState.gridMarker.remove(); appState.gridMarker = null; }
    }
  }
  updateCircles();
}



// Query flood at a particular gridpoint
async function queryWaveSurge(lat, lon) {
  const status = document.getElementById("status");
  status.textContent = "Querying...";
  try {
    if (appState.mode === 'wave') {
      const res  = await fetch(`${API}/query/wave_surge/point?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      updateSurgeCharts(data);
    } else {
      const res  = await fetch(`${API}/query/s100yr/whichtanks?lat=${lat}&lon=${lon}`);
      const data = await res.json();
      highlightCircles(data);
    } 
    status.textContent = "Done. Click another location to update.";
  
  } catch(e) {
    status.textContent = `Error: ${e.message}`;
  }
}

// Query flood/wind/spill/fragility for a particular tank
async function queryAST(ast_id) {
  const status = document.getElementById("status");
  status.textContent = "Loading AST data...";
  //clearappState.charts();
	
  try {
    const res  = await fetch(`${API}/fragility/ast/${ast_id}`);
    const data = await res.json();
    console.log("AST data:", JSON.stringify(data)); 
    if (appState.mode === "wave") {
	    updateSurgeCharts({"values":data, "lat": data.lat, "lon": data.lon});
    } else {
      updateFragilityCharts(data);
    }
    document.getElementById("point-info").innerHTML =  
          `<div class="ast-info">
            <b>AST ID:</b> ${ast_id}<br>
            <b>Type:</b> ${data.type}<br>
            <b>Height:</b> ${data.height} m<br>
            <b>Lat:</b> ${data.lat} &nbsp; <b>Lon:</b> ${data.lon}
          </div>`;
    status.textContent = `AST ${ast_id} — Click another tank to update.`;
  } catch(e) {
    status.textContent = `Error: ${e.message}`;
  }
}

// Toggle and apply custom map extent
function toggleRange() {
  document.getElementById("range-inputs").style.display =
    document.getElementById("custom-range").checked ? "block" : "none";
}

function applyRange() {
  const latMin = parseFloat(document.getElementById("lat-min").value) || 29.3;
  const latMax = parseFloat(document.getElementById("lat-max").value) || 30.1;
  const lonMin = parseFloat(document.getElementById("lon-min").value) || -95.5;
  const lonMax = parseFloat(document.getElementById("lon-max").value) || -94.5;
  map.fitBounds([[latMin, lonMin],[latMax, lonMax]]);
}
