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

export async function photoToBlob(photo) {
  if (photo.url) {
    const res = await fetch(photo.url);
    return res.blob();
  }
  const [c1, c2] = photo.grad || ['#F0D8DD', '#C75C84'];
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
