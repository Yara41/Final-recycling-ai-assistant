// Photo preparation: phones produce large (often HEIC) photos. The browser decodes them,
// and we send a JPEG whose longest side is at most 1024 px (about 100-400 KB).

export function fitSize(width, height, max = 1024) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read the image')); };
    img.src = url;
  });
}

export async function prepareImage(file, max = 1024, quality = 0.82) {
  const img = await loadImage(file);
  const { width, height } = fitSize(img.naturalWidth || img.width, img.naturalHeight || img.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return { data: dataUrl.split(',')[1], mimeType: 'image/jpeg', preview: dataUrl };
}
