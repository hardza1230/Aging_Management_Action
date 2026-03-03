import { dataStore, getActionColor } from './state.js';
import { openModal } from './ui.js';

export function updateCharts(reasonMap, ageBuckets, salesmanMap, actionCounts) {
    const charts = dataStore.charts;
    ['reason', 'aging', 'salesman', 'action'].forEach(c => {
        if (charts[c]) charts[c].destroy();
    });

    const tf = { callbacks: { label: (ctx) => ' ' + ctx.raw.toLocaleString() + ' ชิ้น' } };
    const tfAction = { callbacks: { label: (ctx) => ' ' + ctx.raw.toLocaleString() + ' ใบ' } };
    const tfReason = { callbacks: { label: (ctx) => ' ' + ctx.raw.toLocaleString() + ' รายการ' } };

    // DataLabels plugins disable mostly for global, enable only where needed
    Chart.defaults.set('plugins.datalabels', { display: false });

    // 1. Action Progress (Donut)
    const actLabels = Object.keys(actionCounts).filter(k => actionCounts[k] > 0);
    const actData = actLabels.map(k => actionCounts[k]);
    const actColors = actLabels.map(k => getActionColor(k));
    const totalAct = actData.reduce((a, b) => a + b, 0);

    charts.action = new Chart(document.getElementById('actionChart'), {
        type: 'doughnut',
        data: { labels: actLabels, datasets: [{ data: actData, backgroundColor: actColors, borderWidth: 1 }] },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            layout: { padding: 30 },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10, font: { size: 9, weight: 'bold' },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const val = data.datasets[0].data[i];
                                    const pct = Math.round((val / totalAct) * 100);
                                    return {
                                        text: `${label} (${pct}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].backgroundColor[i],
                                        lineWidth: 0,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: tfAction,
                datalabels: {
                    display: true,
                    color: (ctx) => ctx.dataset.backgroundColor[ctx.dataIndex],
                    font: { weight: 'bold', size: 10 },
                    anchor: 'end',
                    align: 'end',
                    offset: 8,
                    formatter: (value) => value.toLocaleString()
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    // 2. Reason (Bar) - Top 15 + Other
    let sortedR = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]);
    let topR = sortedR.slice(0, 15);
    if (sortedR.length > 15) topR.push(['อื่นๆ', sortedR.slice(15).reduce((s, i) => s + i[1], 0)]);

    charts.reason = new Chart(document.getElementById('reasonChart'), {
        type: 'bar',
        data: { labels: topR.map(r => r[0]), datasets: [{ data: topR.map(r => r[1]), backgroundColor: '#6366f1', borderRadius: 4, barThickness: 12 }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            layout: { padding: { right: 60, top: 10, bottom: 10 } },
            scales: {
                y: { ticks: { autoSkip: false, font: { size: 10 }, color: '#475569' }, grid: { display: false } },
                x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 } } }
            },
            plugins: {
                legend: { display: false }, tooltip: tfReason,
                datalabels: {
                    display: true, color: '#6366f1', anchor: 'end', align: 'right',
                    formatter: (val) => val.toLocaleString(), font: { weight: 'bold', size: 10 }
                }
            },
            onClick: (e, els) => {
                if (els.length && topR[els[0].index][0] !== 'อื่นๆ') {
                    openModal('สาเหตุ: ' + topR[els[0].index][0], r => r.reason === topR[els[0].index][0]);
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    // 3. Aging (Bar) 1-12 Months
    charts.aging = new Chart(document.getElementById('agingChart'), {
        type: 'bar',
        data: { labels: Object.keys(ageBuckets), datasets: [{ data: Object.values(ageBuckets), backgroundColor: ['#10b981', '#10b981', '#facc15', '#f59e0b', '#f97316', '#ef4444', '#ef4444', '#ef4444', '#ef4444', '#b91c1c', '#b91c1c', '#b91c1c', '#7f1d1d'], borderRadius: 4 }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: true, grid: { color: '#f1f5f9' } } },
            plugins: {
                legend: { display: false }, tooltip: tf,
                datalabels: {
                    display: true, color: '#475569', anchor: 'end', align: 'top',
                    formatter: (val) => val > 0 ? val.toLocaleString() : '', font: { size: 10, weight: 'bold' }
                }
            },
            onClick: (e, els) => {
                if (els.length) {
                    let label = Object.keys(ageBuckets)[els[0].index];
                    let filterFn = r => true;
                    if (label === '1 เดือน') filterFn = r => r.age <= 1;
                    else if (label === '> 1 ปี') filterFn = r => r.age > 12;
                    else filterFn = r => r.age === parseInt(label);
                    openModal('อายุสต็อก: ' + label, filterFn);
                }
            }
        },
        plugins: [ChartDataLabels]
    });

    // 4. Salesman (Bar)
    let topS = Object.entries(salesmanMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
    charts.salesman = new Chart(document.getElementById('salesmanChart'), {
        type: 'bar',
        data: { labels: topS.map(s => s[0]), datasets: [{ data: topS.map(s => s[1]), backgroundColor: '#8b5cf6', borderRadius: 4 }] },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            layout: { padding: { right: 50 } },
            plugins: {
                legend: { display: false }, tooltip: tf,
                datalabels: { display: true, color: '#475569', anchor: 'end', align: 'right', formatter: (val) => val.toLocaleString() }
            },
            onClick: (e, els) => {
                if (els.length) {
                    openModal('พนักงานขาย: ' + topS[els[0].index][0], r => r.saleman === topS[els[0].index][0]);
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}
