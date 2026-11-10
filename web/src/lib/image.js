// Réduit une photo avant l'envoi (plus grand côté 1600 px, JPEG) : envoi plus rapide, moins de stockage.
// Renvoie le fichier d'origine s'il est déjà léger, si ce n'est pas une photo, ou si la réduction échoue.
export async function shrinkImage(file, max = 1600, quality = 0.82) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) || file.size < 400e3) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
  } catch { return file; }
}
