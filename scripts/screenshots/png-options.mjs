// Lossless PNG settings for every image written to docs/screenshots/. Palette quantization was
// tried and rejected: it merges small accent colors (severity ticks turn the wrong hue).
export const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: true, effort: 10 }
