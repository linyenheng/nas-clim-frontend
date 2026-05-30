let charts      = {};
let rainCharts = [];
let PR = null;

const SSPS = ["ssp245","ssp370","ssp585"];
const SSP_COLORS = {ssp245:"#38bdf8", ssp370:"#fb923c", ssp585:"#f87171"};
const SSP_LABELS = {ssp245:"SSP2-4.5", ssp370:"SSP3-7.0", ssp585:"SSP5-8.5"};
let GATE_NAMES = null;



async function init() {
  let res = await fetch('../pr.json');
  console.log(res);
  PR = await res.json();
  console.log("PR on init:");
  console.log(PR);
  let res2 = await fetch('../gates.json');   // We're loading this a second time... should consider an api module
  res2 = await res2.json();
  GATE_NAMES = res2.NAMES;
  const groups = [
    {
      chartID: 'flood',
      labels: ['100-year', '50-year', '25-year'],
      ylabel: 'meters',
      colors: ["#0ea5e9","#0284c7","#0369a1"],
      yMax: 4.0,
    },
    {
      chartID: 'surge',
      labels: ['100-year', '50-year', '25-year'],
      ylabel: 'meters',
      colors: ["#8b5cf6","#7c3aed","#6d28d9"],
      yMax: 6.0,
    },
    {
      chartID: 'wind',
      labels: ['100-year', '50-year', '25-year'],
      ylabel: 'meters/second',
      colors: ["#1d4227","#417d51","#73d18c"],
      yMax: 50.0,
    },
    {
      chartID: 'pf',
      labels:   ["Mean ± 1.5 STD"],
      ylabel: 'probability (0 - 1)',
      colors: ["#ef444488"],
      yMax: 1.0,
    },
    {
      chartID: 'sv',
      labels:   ["Mean ± 1.5 STD"],
      ylabel: 'cubic meters',
      colors: ["#f9731688"],
      yMax: 100.0,
    },
  ];
  
  groups.forEach(g => {
    const box = document.getElementById(`chartbox-${g.chartID}`);
    const chart = charts[g.chartID];
    try {
      charts[g.chartID] = new Chart(box.querySelector("canvas"), {
        type: "bar",
        data: {
          labels: g.labels,
          datasets: [{
            data:            [],
            backgroundColor: g.colors,
            borderColor:     "black",
            borderRadius:    5,
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display:false },
            errorBar: {
              qMean: 0,
              qErr: 0,
            }
          },
          scales: {
            y: { min:0, max:g.yMax, title:{ display:true, text:g.ylabel } }
          }
        },
        plugins: [myErrorBarPlugin]
      });

    } catch(e) {
      console.log(`failed to load chart: ${e}`);
    } 
  });
  charts['flood'].options.plugins.errorBar = false;
  charts['surge'].options.plugins.errorBar = false;
  charts['wind'].options.plugins.errorBar = false;
}


export function updateSurgeCharts(data) { 
  const values = data.values;
  
  ['flood', 'surge', 'wind'].forEach(chartID => {
    document.getElementById(`chartbox-${chartID}`).style.display = 'block';
    const chart = charts[chartID];
    const keys = ['100', '50', '25'].map(yr => chartID + yr);
    const vals = keys.map(k => values[k]);
    const displayVals = vals.map(v => v === null ? 0 : v);
    const nullCount   = vals.filter(v => v === null).length;
    chart.data.datasets.forEach(ds => {
      ds.data = [];
      displayVals.forEach(v => { ds.data.push(v); });
      chart.options.plugins.tooltip.callbacks.label = ctx => {   
          const orig = vals[ctx.dataIndex];
          return orig === null ? "No data" : `${orig.toFixed(4)} m`;
      };
    });
    chart.update();
  });
}


//Mostly the same as above, except different charts and different vals
export function updateFragilityCharts(data) { 
  if ( !Object.keys(charts).includes('pf') ) {  initCharts(); }
  const STD = 1.5;
  ['pf', 'sv'].forEach(chartID => {
    document.getElementById(`chartbox-${chartID}`).style.display = 'block';
    const chart = charts[chartID];
    const qMean = data[chartID].mean;
    const qErr = data[chartID].std * STD;
    const displayVals = [qMean];
    chart.data.datasets.forEach(ds => {
      ds.data = [];
      displayVals.forEach(v => { ds.data.push(v); });
      chart.options.plugins.tooltip.callbacks.label = () => {
              `Mean: ${qMean.toFixed(4)} | ±1.5σ: [${Math.max(0,qMean-qErr).toFixed(4)}, ${Math.min(1,qMean+qErr).toFixed(4)}]`;} ;
      });
    chart.options.plugins.errorBar.qMean=qMean;
    chart.options.plugins.errorBar.qErr = qErr;
    chart.update();
  });
}

const myErrorBarPlugin = {
  id: "errorBar",
  afterDatasetsDraw: (chart, args, options) => {
    const ctx  = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    const bar  = meta.data[0];
    const x    = bar.x;
    const qMean = chart.options.plugins.errorBar.qMean;
    const qErr = chart.options.plugins.errorBar.qErr;
    const yTop    = chart.scales.y.getPixelForValue(qMean + qErr);
    const yBottom = chart.scales.y.getPixelForValue(Math.max(0, qMean - qErr));
    ctx.save();
    ctx.strokeStyle = "#c2410c";
    ctx.lineWidth   = 2;

    ctx.beginPath();
    ctx.moveTo(x, yTop);
    ctx.lineTo(x, yBottom);
    ctx.stroke();

    [-1, 1].forEach(dir => {
      const y = dir === 1 ? yTop : yBottom;
      ctx.beginPath();
      ctx.moveTo(x - 8, y);
      ctx.lineTo(x + 8, y);
      ctx.stroke();
      
    });
    ctx.restore();
  }
};
  
 


// ── Main chart renderer ───────────────────────────────────────────────────
export function drawPrecipChart(gateId, ctrl) {
  clearRainCharts();
  console.log('draw prec');
  console.log(PR);
  console.log(ctrl);
  const area = document.getElementById("rain-charts-area");
  const gateIdx = parseInt(gateId.replace("gate","")) - 1;
  const src     = ctrl.Model === "dynamic" ? PR.PRD : PR.PRS;
  const prefix  = ctrl.Model === "dynamic" ? "prD" : "prS";
  const modelLabel  = ctrl.Model === "dynamic" ? "Dynamic" : "Statistical";
  const periodLabel = ctrl.Period === "2030_2060" ? "2030–2060" : "2070–2100";
  const tcLabel     = {all:"All TCs", minor:"Minor TCs", major:"Major TCs"}[ctrl.Tc];

  if (ctrl.Cat === "mean") {

    // ── Category 1: TC Precip CCdelta — real data, H95 as error bars ──
    const means = [], errs = [], colors = [], labels = [];
    SSPS.forEach(ssp => {
      const meanKey = `${prefix}_${ssp}_${ctrl.Period}_${ctrl.Tc}_gate_ccdelta_mean`;
      const errKey  = `${prefix}_${ssp}_${ctrl.Period}_${ctrl.Tc}_gate_ccdelta_H95`;
      const mean = src[meanKey] ? src[meanKey][gateIdx] : 0;
      const err  = src[errKey]  ? src[errKey][gateIdx]  : 0;
      means.push(mean);
      errs.push(err);
      colors.push(SSP_COLORS[ssp]);
      labels.push(SSP_LABELS[ssp]);
    });

    // Y-axis: must include mean+H95 (top) and mean-H95 (bottom), which can be negative
    const yTop = Math.max(...means.map((m,i) => m + errs[i]));
    const yBot = Math.min(0, Math.min(...means.map((m,i) => m - errs[i])));
    const yMax =  yTop * 1.2 || 10;
    const yMin = yBot < 0 ? yBot * 1.2 : 0;

    const box = document.createElement("div");
    box.className = "chart-box";
    box.style.display = "block";
    box.innerHTML = `
      <h4>🌧 TC Precip CCdelta (mean and significant range)</h4>
      <small>${GATE_NAMES[gateId]} &nbsp;|&nbsp; ${modelLabel} &nbsp;|&nbsp; ${periodLabel} &nbsp;|&nbsp; ${tcLabel}</small>
      <canvas id="precip-canvas"></canvas>`;
    area.appendChild(box);

    const errorBarPlugin = {
      id:"errorBarPlugin",
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        ctx.save(); ctx.lineWidth = 2.5;
        meta.data.forEach((bar, i) => {
          const err = errs[i]; if(!err) return;
          const x   = bar.x;
          const yT  = chart.scales.y.getPixelForValue(means[i] + err);
          const yB  = chart.scales.y.getPixelForValue(means[i] - err);
          ctx.strokeStyle = colors[i];
          ctx.beginPath(); ctx.moveTo(x, yT); ctx.lineTo(x, yB); ctx.stroke();
          [yT, yB].forEach(y => {
            ctx.beginPath(); ctx.moveTo(x-8, y); ctx.lineTo(x+8, y); ctx.stroke();
          });
        });
        ctx.restore();
      }
    };
    console.log(means);
    rainCharts.push(new Chart(document.getElementById("precip-canvas"), {
      type:"bar",
      data:{ labels, datasets:[{
        data: means,
        backgroundColor: colors.map(c => c + "99"),
        borderColor: colors, borderWidth: 2, borderRadius: 5,
      }]},
      options:{
        responsive:true,
        plugins:{
          legend:{display:false},
          tooltip:{ callbacks:{ label: ctx => {
            const m = means[ctx.dataIndex], e = errs[ctx.dataIndex];
            return [`Mean: ${m.toFixed(2)}%`, `Range: [${(m-e).toFixed(2)}%, ${(m+e).toFixed(2)}%]`];
          }}}
        },
        scales:{
          y:{
            min: yMin, max: yMax,
            title:{display:true, text:"CCdelta (%)"},
            grid:{
              color: ctx => ctx.tick.value === 0 ? "#374151" : "#e5e7eb",
              lineWidth: ctx => ctx.tick.value === 0 ? 2.5 : 1,
            },
            ticks:{callback: v => v.toFixed(0)+"%"}
          },
          x:{ grid:{display:false} }
        }
      },
      plugins:[errorBarPlugin]
    }));

  } else {
    // ── Category 2: 24-hour 95th Extreme — real data (all TCs only) ──────
    const extSrc  = ctrl.Model === "dynamic" ? PR.PRD_EXT : PR.PRS_EXT;
    const extPfx  = ctrl.Model === "dynamic" ? "prD" : "prS";
    const means2 = [], errs2 = [], colors2 = [], labels2 = [];

    SSPS.forEach(ssp => {
      const meanKey = `${extPfx}_${ssp}_${ctrl.Period}_allgate_ccdelta_mean`;
      const errKey  = `${extPfx}_${ssp}_${ctrl.Period}_allgate_ccdelta_H95`;
      const mean = extSrc[meanKey] ? extSrc[meanKey][gateIdx] : 0;
      const err  = extSrc[errKey]  ? extSrc[errKey][gateIdx]  : 0;
      means2.push(mean);
      errs2.push(err);
      colors2.push(SSP_COLORS[ssp]);
      labels2.push(SSP_LABELS[ssp]);
    });

    const yTop2 = Math.max(...means2.map((m,i) => m + errs2[i]));
    const yBot2 = Math.min(0, Math.min(...means2.map((m,i) => m - errs2[i])));
    const yMax2 = yTop2 * 1.2 || 10;
    const yMin2 = yBot2 < 0 ? yBot2 * 1.2 : 0;

    const box2 = document.createElement("div");
    box2.className = "chart-box";
    box2.style.display = "block";
    box2.innerHTML = `
      <h4>🌧 24-hour 95th Extreme CCdelta (mean and significant range)</h4>
      <small>${GATE_NAMES[gateId]} &nbsp;|&nbsp; ${modelLabel} &nbsp;|&nbsp; ${periodLabel} &nbsp;|&nbsp; All TCs only</small>
      <canvas id="precip-canvas-ext"></canvas>`;
    area.appendChild(box2);

    const errPlugin2 = {
      id:"errPlugin2",
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        ctx.save(); ctx.lineWidth = 2.5;
        meta.data.forEach((bar, i) => {
          const err = errs2[i]; if(!err) return;
          const x  = bar.x;
          const yT = chart.scales.y.getPixelForValue(means2[i] + err);
          const yB = chart.scales.y.getPixelForValue(means2[i] - err);
          ctx.strokeStyle = colors2[i];
          ctx.beginPath(); ctx.moveTo(x, yT); ctx.lineTo(x, yB); ctx.stroke();
          [yT, yB].forEach(y => {
            ctx.beginPath(); ctx.moveTo(x-8, y); ctx.lineTo(x+8, y); ctx.stroke();
          });
        });
        ctx.restore();
      }
    };

    rainCharts.push(new Chart(document.getElementById("precip-canvas-ext"), {
      type:"bar",
      data:{ labels: labels2, datasets:[{
        data: means2,
        backgroundColor: colors2.map(c => c + "99"),
        borderColor: colors2, borderWidth: 2, borderRadius: 5,
      }]},
      options:{
        responsive:true,
        plugins:{
          legend:{display:false},
          tooltip:{ callbacks:{ label: ctx => {
            const m = means2[ctx.dataIndex], e = errs2[ctx.dataIndex];
            return [`Mean: ${m.toFixed(2)}%`, `Range: [${(m-e).toFixed(2)}%, ${(m+e).toFixed(2)}%]`];
          }}}
        },
        scales:{
          y:{
            min: yMin2, max: yMax2,
            title:{display:true, text:"CCdelta (%)"},
            grid:{
              color: ctx => ctx.tick.value === 0 ? "#374151" : "#e5e7eb",
              lineWidth: ctx => ctx.tick.value === 0 ? 2.5 : 1,
            },
            ticks:{callback: v => v.toFixed(0)+"%"}
          },
          x:{ grid:{display:false} }
        }
      },
      plugins:[errPlugin2]
    }));
  }

  // Info / legend box
  const legendBox = document.createElement("div");
  legendBox.className = "chart-box";
  legendBox.innerHTML = `
    <h4>📋 Legend</h4>
    <small style="display:block;line-height:2.2;color:#475569;margin-top:4px">
      <span style="color:#38bdf8">■</span> SSP2-4.5 &nbsp;
      <span style="color:#fb923c">■</span> SSP3-7.0 &nbsp;
      <span style="color:#f87171">■</span> SSP5-8.5<br>
      <b>Error bars</b> = significant range (mean ± H95)<br>
      <b>CCdelta</b> = % change vs historical (1985–2014)<br>
      ${ctrl.Cat==="h95" ? "<i>24-hr extreme: All TCs only (no minor/major split)</i>" : ""}
    </small>`;
  area.appendChild(legendBox);
}





// ── Utilities ─────────────────────────────────────────────────────────────
export function clearRainCharts() {
  rainCharts.forEach(c=>c.destroy()); 
  rainCharts=[]; 
  document.getElementById("rain-charts-area").innerHTML="";
  }
init();

