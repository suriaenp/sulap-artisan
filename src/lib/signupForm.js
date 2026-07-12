import JSZip from 'jszip';
import { downloadBlob, safeName } from './photoFiles';
import { EINVOICE_FIELDS, DETAILS_FIELDS, einvoiceComplete } from './helpers';

// Generates a vendor's sign-up & T&C acceptance form as a self-contained,
// print-ready HTML file (there's no PDF generator in this project — pdfjs-dist
// only reads PDFs — so the form opens in any browser and prints cleanly to
// PDF via the browser's own Print dialog; @media print styles included).
// Single download saves as "<Vendor Name>.html"; bulk saves a ZIP with one
// file per vendor, named the same way.

let logoDataUrl = null;
async function getLogo() {
  if (logoDataUrl) return logoDataUrl;
  try {
    const res = await fetch('/assets/sulap-lockup.png');
    const blob = await res.blob();
    logoDataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    logoDataUrl = ''; // form still renders, just without the logo image
  }
  return logoDataUrl;
}

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const row = (label, value) => `
  <tr>
    <td class="lbl">${esc(label)}</td>
    <td class="val">${esc(value || '—')}</td>
  </tr>`;

export async function buildSignupFormHtml(vendor, terms) {
  const logo = await getLogo();
  const v = vendor;
  const ei = v.einvoice || {};
  const eiRows = einvoiceComplete(v)
    ? EINVOICE_FIELDS.map(([k, label]) => row(label, ei[k])).join('')
    : `<tr><td class="val" colspan="2" style="color:#8a8a8a">Not yet submitted by the vendor.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(v.business)} — Vendor Sign-up &amp; Terms Acceptance</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color:#1C1A17; background:#fff; padding:48px 56px; max-width:820px; margin:0 auto; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:3px solid #A6364E; padding-bottom:18px; }
  .head img { width:190px; height:auto; }
  .head .doc { text-align:right; font-size:12px; color:#6B6560; line-height:1.6; }
  h1 { font-size:22px; font-weight:600; margin:26px 0 4px; }
  .sub { font-size:13px; color:#6B6560; margin-bottom:22px; }
  h2 { font-size:13px; letter-spacing:0.08em; text-transform:uppercase; color:#A6364E; margin:26px 0 8px; }
  table { width:100%; border-collapse:collapse; }
  td { border:1px solid #ddd2c4; padding:8px 12px; font-size:13px; vertical-align:top; }
  td.lbl { width:240px; background:#FBF7F1; color:#6B6560; }
  td.val { font-weight:600; }
  .terms { border:1px solid #ddd2c4; background:#FBF7F1; padding:16px 18px; font-size:11.5px; line-height:1.65; white-space:pre-wrap; }
  .accept { border:2px solid #2D6A4F; background:#F4FAF7; padding:16px 18px; margin-top:14px; font-size:13px; line-height:1.6; }
  .accept b { color:#2D6A4F; }
  .stamp { margin-top:10px; font-size:12.5px; }
  .stamp span { display:inline-block; border-bottom:1px solid #1C1A17; min-width:220px; font-weight:600; padding:0 6px 2px; }
  .foot { margin-top:34px; padding-top:12px; border-top:1px solid #ddd2c4; font-size:10.5px; color:#8a8a8a; line-height:1.6; }
  @media print { body { padding:24px 28px; } .accept { break-inside:avoid; } }
</style>
</head>
<body>
  <div class="head">
    ${logo ? `<img src="${logo}" alt="Sulap Artisan">` : `<div style="font-size:24px;font-weight:700">Sulap Artisan</div>`}
    <div class="doc">
      VENDOR SIGN-UP &amp; TERMS ACCEPTANCE FORM<br>
      Reference: SA-REG-${esc((v.id || '').toUpperCase())}<br>
      Registered: ${esc(v.regDate || '—')}
    </div>
  </div>

  <h1>${esc(v.business)}</h1>
  <div class="sub">Vendor registration details as submitted to Sulap Artisan.</div>

  <h2>Business details</h2>
  <table>
    ${DETAILS_FIELDS.map(([k, label]) => row(label, v[k])).join('')}
  </table>

  <h2>Social media &amp; logistics</h2>
  <table>
    ${row('Instagram', v.ig)}
    ${row('Facebook', v.fb)}
    ${row('TikTok', v.tiktok)}
    ${row('Power supply needs', v.power)}
    ${row('Product photos submitted', String((v.productPhotos || []).length))}
  </table>

  <h2>E-Invoice &amp; bank details</h2>
  <table>${eiRows}</table>

  <h2>Market terms &amp; conditions</h2>
  <div class="terms">${esc(terms)}</div>

  <div class="accept">
    <b>Declaration of acceptance.</b> The applicant named below confirmed that they have read and
    agree to the Sulap Artisan market terms, vendor conduct &amp; cancellation policy shown above,
    as presented at the time of registration.
    <div class="stamp">Accepted by: <span>${esc(v.owner || '')}</span> &nbsp; on behalf of &nbsp; <span>${esc(v.business || '')}</span></div>
    <div class="stamp">Date &amp; time of acceptance: <span>${esc(v.tcAcceptedAt || 'Not recorded')}</span></div>
  </div>

  <div class="foot">
    Generated from the Sulap Artisan Admin Console. This document reproduces the registration
    details and terms acceptance recorded in the vendor portal at the time of sign-up.
  </div>
</body>
</html>`;
}

export async function downloadSignupForm(vendor, terms) {
  const html = await buildSignupFormHtml(vendor, terms);
  const blob = new Blob([html], { type: 'text/html' });
  downloadBlob(blob, `${safeName(vendor.business)}.html`);
}

export async function downloadSignupFormsZip(vendors, terms) {
  const zip = new JSZip();
  for (const v of vendors) {
    const html = await buildSignupFormHtml(v, terms);
    zip.file(`${safeName(v.business)}.html`, html);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, 'Sulap Artisan - Vendor sign-up forms.zip');
}
