// Fotos verkleinern und Dateien für den Upload vorbereiten.

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.78;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fallback unten, z. B. für ältere Safari-Versionen
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Gibt ein verkleinertes JPEG zurück. Wenn das nicht geht (z. B. HEIC in
// einem Browser, der es nicht lesen kann), bleibt die Originaldatei erhalten.
export async function prepareFile(file) {
  const isPhoto = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type);
  if (!isPhoto) return { blob: file, name: file.name, type: file.type || 'application/octet-stream' };

  try {
    const img = await decode(file);
    const w = img.width;
    const h = img.height;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    if (img.close) img.close();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || (blob.size >= file.size && file.type === 'image/jpeg')) {
      return { blob: file, name: file.name, type: file.type };
    }
    return { blob, name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg' };
  } catch {
    return { blob: file, name: file.name, type: file.type };
  }
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function slug(text) {
  return (text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

// Dateiname für das Repo: sicher, eindeutig innerhalb des Berichts.
export function safeFileName(name, taken) {
  const m = /^(.*?)(\.[a-z0-9]{1,8})?$/i.exec(name || 'datei');
  const base = slug(m[1]) || 'datei';
  const ext = (m[2] || '').toLowerCase();
  let candidate = base + ext;
  let i = 2;
  while (taken.has(candidate)) candidate = `${base}-${i++}${ext}`;
  taken.add(candidate);
  return candidate;
}
