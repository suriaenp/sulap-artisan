import html2pdf from 'html2pdf.js';
import { safeName } from './photoFiles';
import { getLogo } from './signupForm';

// Vendor Pass report — one PDF per event, grouped by vendor/booth, for the
// Sulap team / mall security to check against at the door. Portrait, sorted
// by booth number, one box per vendor (booth prefix + vendor name shown once)
// holding all of that vendor's approved pass holder photos at a consistent size.

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Booths with no number sort to the end; otherwise natural/alphanumeric order
// (so "A2" comes before "A10").
function boothCompare(a, b) {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function photoCellHtml(photo, name) {
  if (photo?.url) return `<img src="${photo.url}" alt="${esc(name)}" class="pic">`;
  const g = photo?.grad || ['#F0D8DD', '#B97434'];
  return `<div class="pic" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></div>`;
}

export async function buildPassReportHtml(event, groups) {
  const logo = await getLogo();
  const totalPeople = groups.reduce((n, g) => n + g.people.length, 0);

  const groupsHtml = groups.map(g => `
    <div class="vbox">
      <div class="vname">${g.boothNumber ? `<span class="booth">${esc(g.boothNumber)}</span> — ` : ''}${esc(g.vendorName)}</div>
      <div class="people">
        ${g.people.map(p => `
          <div class="person">
            ${photoCellHtml(p.photo, p.name)}
            <div class="pname">${esc(p.name)}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(event.name)} — Vendor Pass Report</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#1C1A17; background:#fff; padding:30px 34px; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #9A5B26; padding-bottom:14px; }
  .head img { width:150px; height:auto; }
  .head .doc { text-align:right; font-size:11px; color:#6B6560; line-height:1.6; }
  h1 { font-size:19px; font-weight:600; margin:16px 0 3px; }
  .sub { font-size:12px; color:#6B6560; margin-bottom:18px; }
  .vbox { border:1px solid #ddd2c4; border-radius:10px; padding:14px 16px; margin-bottom:12px; break-inside:avoid; }
  .vname { font-size:14.5px; font-weight:700; color:#1C1A17; margin-bottom:12px; }
  .vname .booth { color:#9A5B26; }
  .people { display:flex; flex-wrap:wrap; gap:16px; }
  .person { width:104px; text-align:center; }
  .pic { width:100px; height:100px; border-radius:10px; object-fit:cover; display:block; margin:0 auto 6px; }
  .pname { font-size:11.5px; font-weight:600; line-height:1.3; }
  .empty { text-align:center; color:#8a8a8a; padding:30px; border:1px dashed #ddd2c4; border-radius:10px; }
  .foot { margin-top:14px; padding-top:10px; border-top:1px solid #ddd2c4; font-size:10px; color:#8a8a8a; line-height:1.5; }
</style>
</head>
<body>
  <div class="head">
    ${logo ? `<img src="${logo}" alt="Sulap Artisan">` : `<div style="font-size:20px;font-weight:700">Sulap Artisan</div>`}
    <div class="doc">VENDOR PASS REPORT<br>Generated ${esc(new Date().toLocaleString())}</div>
  </div>

  <h1>${esc(event.name)}</h1>
  <div class="sub">${esc(event.dateRange || '')} · ${groups.length} vendor${groups.length !== 1 ? 's' : ''} · ${totalPeople} approved pass holder${totalPeople !== 1 ? 's' : ''} · sorted by booth number</div>

  ${groupsHtml || `<div class="empty">No approved pass holders for this event yet.</div>`}

  <div class="foot">Includes approved pass holders only — pending/rejected applications are not shown. Generated from the Sulap Artisan Admin Console.</div>
</body>
</html>`;
}

const PDF_OPT = (filename) => ({
  margin: [10, 10, 10, 10],
  filename,
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { scale: 2, windowWidth: 780 },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['css', 'legacy'] },
});

function htmlToElement(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const wrapper = document.createElement('div');
  wrapper.appendChild(doc.querySelector('style').cloneNode(true));
  wrapper.appendChild(doc.body);
  return wrapper;
}

// Builds one group per vendor (approved pass holders only), sorted by booth
// number, and downloads them as a portrait PDF.
export async function downloadPassReport(event, passApps, vendors) {
  const groups = passApps
    .filter(p => p.eventId === event.id)
    .map(p => {
      const v = vendors.find(x => x.id === p.vendorId) || {};
      const people = p.people.filter(person => person.status === 'approved');
      return { vendorName: v.business || 'Unknown vendor', boothNumber: p.boothNumber, people };
    })
    .filter(g => g.people.length > 0)
    .sort((a, b) => boothCompare(a.boothNumber, b.boothNumber));

  const html = await buildPassReportHtml(event, groups);
  const element = htmlToElement(html);
  return html2pdf().set(PDF_OPT(`${safeName(event.name)} - Vendor Pass report.pdf`)).from(element).save();
}
