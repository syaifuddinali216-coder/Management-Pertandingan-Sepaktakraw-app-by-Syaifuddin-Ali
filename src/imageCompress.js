// Compresses an uploaded image file into a small base64 data URL so it can
// be stored directly on the team document in Firestore (no Storage bucket
// setup required). Resizes to fit within maxSize x maxSize and re-encodes
// as JPEG, which keeps most team-logo uploads well under ~30KB.
export function compressImage(file, maxSize = 200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('File is not an image'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load image'))
      img.onload = () => {
        let { width, height } = img
        if (width > height) {
          if (width > maxSize) { height = Math.round(height * (maxSize / width)); width = maxSize }
        } else {
          if (height > maxSize) { width = Math.round(width * (maxSize / height)); height = maxSize }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        // white background so transparent PNG logos don't turn black on JPEG
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
