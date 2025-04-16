/**
 * Calculate relative luminance of a color
 * @param {number} r Red component (0-255)
 * @param {number} g Green component (0-255)
 * @param {number} b Blue component (0-255)
 * @returns {number} Relative luminance value
 */
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Parse color string to RGB values
 * @param {string} color CSS color string
 * @returns {Object} RGB values
 */
function parseColor(color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  const [r, g, b] = ctx.fillStyle.match(/\d+/g).map(Number);
  return { r, g, b };
}

/**
 * Calculate contrast ratio between two colors
 * @param {string} color1 First color
 * @param {string} color2 Second color
 * @returns {number} Contrast ratio
 */
export function getContrastRatio(color1, color2) {
  const c1 = parseColor(color1);
  const c2 = parseColor(color2);
  const l1 = getLuminance(c1.r, c1.g, c1.b);
  const l2 = getLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Clean up screenshot files from the screenshots directory
 * @returns {Promise<void>}
 */
export async function cleanupScreenshots() {
  try {
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    const files = await fs.readdir(screenshotsDir);
    await Promise.all(
      files.map(file => fs.unlink(path.join(screenshotsDir, file)))
    );
  } catch (error) {
    console.warn('Error cleaning up screenshots:', error);
  }
}

// Add imports at the top
import path from 'node:path';
import { promises as fs } from 'node:fs';

export default {
  getContrastRatio,
  cleanupScreenshots
};
