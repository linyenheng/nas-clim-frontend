//import Chart from "https://cdn.jsdelivr.net/npm/chart.js@latest/auto/auto.js"
//import Chart from "https://cdn.jsdelivr.net/npm/chart.js/+esm"
import {Chart, 
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip
} from "https://cdn.jsdelivr.net/npm/chart.js/+esm"

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip
 );

const charts = {};

// ── Wave Surge Bar Charts ─────────────────────────────────────
export function initCharts() {
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
  if ( !Object.keys(charts).includes('flood') ) {  initCharts(); }
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
    console.log('plugin start');
    const ctx  = chart.ctx;
    const meta = chart.getDatasetMeta(0);
    const bar  = meta.data[0];
    const x    = bar.x;
    const qMean = chart.options.plugins.errorBar.qMean;
    const qErr = chart.options.plugins.errorBar.qErr;
    const yTop    = chart.scales.y.getPixelForValue(qMean + qErr);
    const yBottom = chart.scales.y.getPixelForValue(Math.max(0, qMean - qErr));
    console.log(options.qErr);
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
    console.log('plugin fin');
  }
};
