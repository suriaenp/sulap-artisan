import JSZip from 'jszip';

// Photos are objects: { id, name, url?, grad? }
// - url:  a data URL from a real file upload
// - grad: [color1, color2] placeholder used by demo data; rendered to a real
//         image at download time so ZIPs always contain actual files.

export const safeName = (s = '') => s.replace(/[\\/:*?"<>|]/g, '-').trim();

export const photoExt = (photo) => {
  const m = /\.([a-zA-Z0-9]+)$/.exec(photo?.name || '');
  return m ? m[1].toLowerCase() : 'jpg';
};

// "Vendor Name - 001 - Event Name.jpg"
export const renamedFile = (business, idx, eventName, ext) =>
  `${safeName(business)} - ${String(idx + 1).padStart(3, '0')} - ${safeName(eventName)}.${ext}`;

export function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({
      id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
      name: file.name,
      url: r.result,
    });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Downscaled variant of fileToPhoto — same shape, but the data URL is a
// resized JPEG instead of the raw file. Used only for vendor-registration
// photos (logo + product photos), which must survive in a localStorage
// draft across the email-confirmation gap (store.jsx completes the vendor
// row once a confirmed session appears); full-resolution camera photos
// routinely exceed a browser's few-MB per-origin localStorage quota on
// their own, which used to mean registration photos were silently dropped.
// Not used anywhere photos are uploaded directly against a live session
// (Photos tab, docs, event photos, pass photos) since those go straight to
// Supabase and have no such size constraint.
export function fileToResizedPhoto(file, maxDim = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale) || 1;
        const h = Math.round(img.height * scale) || 1;
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({
          id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
          name: file.name,
          url: canvas.toDataURL('image/jpeg', quality),
        });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function photoToBlob(photo) {
  if (photo.url) {
    const res = await fetch(photo.url);
    return res.blob();
  }
  const [c1, c2] = photo.grad || ['#F0D8DD', '#B97434'];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 900;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 900, 900);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 900, 900);
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function downloadPhoto(photo, filename) {
  const blob = await photoToBlob(photo);
  downloadBlob(blob, filename || photo.name || 'photo.jpg');
}

// entries: [{ folder?, filename, photo }] — folder groups files inside the ZIP
export async function downloadZip(entries, zipName) {
  const zip = new JSZip();
  for (const e of entries) {
    const blob = await photoToBlob(e.photo);
    const path = e.folder ? `${safeName(e.folder)}/${e.filename}` : e.filename;
    zip.file(path, blob);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, zipName);
}
