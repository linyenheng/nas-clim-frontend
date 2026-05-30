import { updateSurgeCharts, updateFragilityCharts, drawPrecipChart, clearRainCharts} from "./chart.js"
// const API = "https://nas-clim-api.onrender.com"; 
const API = "https://nas-clim-api-ih6l.onrender.com";

let currentMode = "wave";
let currentRP   =  null;
let currentCircle= null; 
let id2circles  = {};
let gridMarker  = null;
let astLayer    = null;



let GATES = null;

// Controls precip state
let ctrl = {
  "Model" : "dynamic",           // dynamic | statistical
  "Period" : "2030_2060",    // 2030_2060 | 2070_2100
  "Tc"     : "all",          // all | minor | major
  "Cat"    : "mean",         // mean | h95
};
//const map = L.map("map").fitBounds([[24,-98],[45,-67]]);
//L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
//  {attribution:"© OpenStreetMap"}).addTo(map);

let activeGateId = null;
let precipLayer = null


  
  
  

//Leaflet map and styles. I'd normally put styles in the css file, but Leaflet is finicky. 
const houstonBounds = [[29.3, -95.5], [30.1, -94.5]];
const usBounds = [[24,-98],[45,-67]];
const map = L.map("map", {
  zoom: 10, 
  minZoom: 5, 
  maxZoom: 17
  }
  ).fitBounds(houstonBounds);
let circleStyleDefault = {
        radius:      5,
        color:       "#6b0202",
        fillColor:   "#ad3444",
        fillOpacity: 0.85,
        weight:      1.5,
      };
      
let circleStyleSelected = {
    radius:      9,
    color:       "#800414",
    fillColor:   "red",
    fillOpacity: 0.95,
    weight:      2.5,
  }
  
let circleStyleUnflooded = {
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
const floodLayers = {
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
document.getElementById("tab-precipitation").addEventListener("click",  setMode); 
document.getElementById("tab-frag"         ).addEventListener("click",  setMode); 

document.getElementById("m-dynamic"        ).addEventListener("click",  setCtrl); 
document.getElementById("m-statistical"    ).addEventListener("click",  setCtrl); 
document.getElementById("p-2030"           ).addEventListener("click",  setCtrl); 
document.getElementById("p-2070"           ).addEventListener("click",  setCtrl); 
document.getElementById("tc-all"           ).addEventListener("click",  setCtrl); 
document.getElementById("tc-minor"         ).addEventListener("click",  setCtrl); 
document.getElementById("tc-major"         ).addEventListener("click",  setCtrl); 
document.getElementById("cat-mean"         ).addEventListener("click",  setCtrl); 
document.getElementById("cat-h95"          ).addEventListener("click",  setCtrl); 

// Handle map clicks (not tank clicks)
function clickMap(event) {
  if(currentMode === "precipitation") return;
  if (currentCircle) { currentCircle.setStyle(circleStyleDefault); }
  currentCircle = null;
  const lat = parseFloat(event.latlng.lat.toFixed(4));
  const lon = parseFloat(event.latlng.lng.toFixed(4));
  document.getElementById("point-info").innerHTML =
    `Lat: <span>${lat}</span><br>Lon: <span>${lon}</span>`;
  if (gridMarker) {   gridMarker.remove(); gridMarker = null; }
  gridMarker = L.marker([lat, lon]).addTo(map);
  queryWaveSurge(lat, lon);
}

// Handle tank clicks
function clickCircle(event) {
  L.DomEvent.stopPropagation(event); // Prevent double-clicking on the map
  if (currentCircle) {  
    currentCircle.setStyle(circleStyleDefault); 
    if (currentCircle.ast_id === event.target.ast_id) {  currentCircle=null; return; }
  }
  if (gridMarker) { gridMarker.remove(); gridMarker = null; }
  currentCircle = event.target;
  currentCircle.setStyle(circleStyleSelected);
  currentCircle.remove();
  currentCircle.addTo(map);
  queryAST(currentCircle.ast_id);
}

// Handle side-buttons for setting return period
async function setRP(event) {
  const tab = event.target
  const rp = tab.id.slice(4);                   // All connected buttons have id of form "tab-{rp}"
  Object.values(floodLayers).forEach(layer => {    // Remove all flood layers
      if (map.hasLayer(layer)) {  map.removeLayer(layer);
  } });
  [25, 50, 100].forEach( yr => {                   // Unhighlight all buttons
    ['f', 's'].forEach(     c => {
      document.getElementById(`tab-${c}${yr}yr`).className = 'tab';
    });
  });
  
  if (rp === currentRP) {  
      rp = null;
  } else {
      tab.className = `tab active-${rp[0]}rp`;
      map.addLayer(floodLayers[rp]);
      if ( (astLayer !== null) && (map.hasLayer(astLayer))) { 
        map.removeLayer(astLayer); // Bring AST layer to front 
        map.addLayer(astLayer);
      }
  }
  currentRP = rp;  
  if (astLayer) {  updateCircles(); }
}
  
  
  
  
  // ── Mode switching ────────────────────────────────────────────────────────
function setMode(event) {
  const mode = event.target.id.slice(4);  // All connected buttons have id of form "tab-{mode}"
  if (mode === currentMode) {  return; }
  if (mode === 'precipitation') { map.fitBounds(usBounds); }         // Zoom out to US for rain
  if (currentMode === 'precipitation') { map.fitBounds(houstonBounds); } // Zoom back into Houston for other stuff
  currentMode = mode;  
  ["tab-wave","tab-precipitation","tab-frag"].forEach(id => {
    document.getElementById(id).className = "tab";
  });
  if(mode==="wave")    document.getElementById("tab-wave").className   = "tab active-wave";
  if(mode==="precipitation") document.getElementById("tab-precipitation").className = "tab active-precipitation";
  if(mode==="frag")     document.getElementById("tab-frag").className   = "tab active-frag";

  document.getElementById("precip-controls").style.display = mode==="precipitation" ? "block":"none";

//  clearCharts();
  Object.values(document.getElementById("charts-area").children).forEach(box => {
    box.style.display="none";
  });
  document.getElementById("point-info").textContent = mode==="precipitation" ? "No gate selected yet." : "No location selected yet.";
  document.getElementById("status").textContent = "";
  activeGateId = null;

  
  if (currentCircle) { currentCircle.fire('click');}
  if (astLayer) {  updateCircles(); }
  if (mode==="precipitation") { loadPrecipGates(); } 
}
    

// Update circle markers to highlight tanks within the selected flood extent 
function updateCircles() {
  astLayer.eachLayer((circle) => {   circle.setStyle(circleStyleDefault); });
  if (currentRP) { 
    astLayer.eachLayer((circle) => { 
      (circle[currentRP.slice(1)] > 0) ? circle.bringToFront() : circle.setStyle(circleStyleUnflooded);
    });
  }
  if (currentCircle) {   currentCircle.setStyle(circleStyleSelected); }
}

function highlightCircles(data) {
  updateCircles();
  console.log(data);
  data['ids'].forEach(id => {
    id2circles[id].setStyle(circleStyleSelected);
    id2circles[id].bringToFront();
  });
}

// Load tank data
async function loadASTPoints() {
  document.getElementById("status").textContent = "Loading AST locations...";
  try {
    const res  = await fetch("./data/tanks_withflood.json");
    const data = await res.json();
    if(astLayer){ astLayer.clearLayers(); } else { astLayer=L.layerGroup().addTo(map); }



    Object.keys(data).forEach(ast_id => {
      const pt = data[ast_id]
      const circle = L.circleMarker([pt.lat, pt.lon], circleStyleDefault).addTo(astLayer);
      circle.addEventListener("click", clickCircle);
      circle.ast_id   = ast_id
      circle["25yr"]  = pt.flood25;
      circle["50yr"]  = pt.flood50;
      circle["100yr"] = pt.flood100;
      id2circles[ast_id] = circle;
      circle.bindTooltip(
        `AST ${ast_id} | ${pt.type}`,
        { permanent:false, direction:"top", offset:[0,-5] }
      );
    });
    document.getElementById("status").textContent =
      `${Object.keys(data).length} ASTs loaded. Click a circle to view charts.`;
  } catch(e) {
    document.getElementById("status").textContent =
      `Failed to load ASTs: ${e.message}`;
  }
}
  
// Toggle AST layer on and off
async function toggleAST() {
  if (astLayer === null)      { await loadASTPoints();     }
  if (document.getElementById("show-tanks").checked) {
    if (!(map.hasLayer(astLayer))) { 
	    map.addLayer(astLayer); 
    }
  } else { 
    if (  map.hasLayer(astLayer) ) { 
	    map.removeLayer(astLayer); 
  	    if (gridMarker) { gridMarker.remove(); gridMarker = null; }
    }
  }
  updateCircles();
}

// Query flood at a particular gridpoint
async function queryWaveSurge(lat, lon) {
  const status = document.getElementById("status");
  status.textContent = "Querying...";
  console.log('query start');
  try {
    console.log(currentMode);
    if (currentMode === 'wave') {
      const res  = await fetch(`${API}/query/wave_surge/point?lat=${lat}&lon=${lon}`);
      console.log(res);
      const data = await res.json();
      console.log("surge query");
      console.log(data);
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
  //clearCharts();
	
  try {
    const res  = await fetch(`${API}/fragility/ast/${ast_id}`);
    const data = await res.json();
    console.log("AST data:", JSON.stringify(data)); 
    if (currentMode === "wave") {
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
// ── Precip control buttons ────────────────────────────────────────────────
function setCtrl(event) {
  const btn = event.target;
  const type = btn.dataset.type;
  const val = btn.dataset.val;
  const onClass = {model:"on-model", period:"on-period", tc:"on-tc", cat:"on-cat"}[type];
  const groupMap = {model:["m-dynamic","m-statistical"], period:["p-2030","p-2070"],
                    tc:["tc-all","tc-minor","tc-major"], cat:["cat-mean","cat-h95"]};
  groupMap[type].forEach(id => {
    const el = document.getElementById(id);
    el.className = "ctrl-btn";
  });
  btn.className = `ctrl-btn on ${onClass}`;
  if(type==="model")  ctrl.Model  = val;
  if(type==="period") ctrl.Period = val;
  if(type==="tc")     ctrl.Tc     = val;
  if(type==="cat")    ctrl.Cat    = val;

  // When switching to 24-hr extreme: force All TCs, disable Minor/Major buttons
  if(type === "cat" && val === "h95") {
    ctrl.Tc = "all";
    document.getElementById("tc-all").className   = "ctrl-btn on on-tc";
    document.getElementById("tc-minor").className = "ctrl-btn disabled";
    document.getElementById("tc-major").className = "ctrl-btn disabled";
  }
  // When switching back to mean: re-enable Minor/Major
  if(type === "cat" && val === "mean") {
    document.getElementById("tc-minor").className = "ctrl-btn";
    document.getElementById("tc-major").className = "ctrl-btn";
  }

  if (activeGateId)  { drawPrecipChart(activeGateId, ctrl); }
}

// ── Gate layer ────────────────────────────────────────────────────────────
async function loadPrecipGates() {
  if (precipLayer) {
      precipLayer.clearLayers();
  } else { 
      precipLayer = L.layerGroup().addTo(map);
      const res = await fetch('./gates.json');
      GATES = await res.json();
  }
  console.log(GATES);
  Object.entries(GATES.LINES).forEach(([gateId, coords]) => {
    const gc = GATES.COLORS[gateId] || "#22d3ee";
    const line = L.polyline(coords, {color:gc, weight:3, opacity:0.75}).addTo(precipLayer);
    line.on("mouseover", ()=> line.setStyle({weight:5, opacity:1}));
    line.on("mouseout",  ()=> { if(activeGateId!==gateId) line.setStyle({weight:3, opacity:0.75}); });
    line.on("click", ()=> selectGate(gateId));

    const num = gateId.replace("gate","");
    const icon = L.divIcon({
      className:"",
      html:`<div class="gate-label" id="gl-${gateId}" style="background:${gc};border-color:${gc}aa">${num}</div>`,
      iconSize:[26,26], iconAnchor:[13,13]
    });
    const lm = L.marker(GATES.MIDS[gateId], {icon}).addTo(precipLayer);
    lm.bindTooltip(`<b>${gateId.toUpperCase()} — ${GATES.NAMES[gateId]}</b>`,
      {permanent:false, direction:"top", offset:[0,-16]});
    lm.on("click",     ()=> selectGate(gateId));
    lm.on("mouseover", ()=> lm.openTooltip());
  });

  document.getElementById("status").textContent = "13 gates loaded — click a gate to view precipitation charts.";
}
  


function selectGate(gateId) {
  if(activeGateId) {
    const prev = document.getElementById(`gl-${activeGateId}`);
    if(prev) prev.classList.remove("active");
  }
  activeGateId = gateId;
  const el = document.getElementById(`gl-${gateId}`);
  if(el) el.classList.add("active");
  
  const gc = GATES.COLORS[gateId];
  document.getElementById("point-info").innerHTML =
    `<div class="gate-info">
      <span class="gate-badge" style="background:${gc}22;color:${gc};border:1px solid ${gc}55">
        ${gateId.toUpperCase()}</span>
      <b>${GATES.NAMES[gateId]}</b>
    </div>`;
  
   document.getElementById("status").textContent = `${gateId.toUpperCase()} (${GATES.NAMES[gateId]}) selected.`;
  drawPrecipChart(gateId, ctrl);
}


// Toggle and apply custom map extent
function toggleRange() {
  document.getElementById("range-inputs").style.display =
    document.getElementById("custom-range").checked ? "block" : "none";
}
function applyRange(){
  const latMin=parseFloat(document.getElementById("lat-min").value)||24;
  const latMax=parseFloat(document.getElementById("lat-max").value)||45;
  const lonMin=parseFloat(document.getElementById("lon-min").value)||-98;
  const lonMax=parseFloat(document.getElementById("lon-max").value)||-67;
  map.fitBounds([[latMin,lonMin],[latMax,lonMax]]);
}

// ── Init ──────────────────────────────────────────────────────────────────
loadPrecipGates();
