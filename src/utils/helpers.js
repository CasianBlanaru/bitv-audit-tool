// src/utils/helpers.js
function getContrastRatio(color1, color2) {
  const luminance1 = getLuminance(color1);
  const luminance2 = getLuminance(color2);
  const lighter = Math.max(luminance1, luminance2);
  const darker = Math.min(luminance1, luminance2);
  return (lighter + 0.05) / (darker + 0.05);
}

function getLuminance(color) {
  const rgb = color.match(/\d+/g)?.map(Number);
  if (!rgb || rgb.length < 3) return 0;
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

module.exports = {
  getContrastRatio,
  getLuminance
};