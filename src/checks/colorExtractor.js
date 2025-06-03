// src/checks/colorExtractor.js

/**
 * Extract colors from a webpage
 * @param {Page} page Puppeteer page object
 * @returns {Promise<Object>} Extracted colors
 */
export async function extractColors(page) {
  const colors = await page.evaluate(() => {
    const result = {
      background: [],
      text: [],
      border: [],
      other: [],
    };

    function getRGBA(color) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      return ctx.fillStyle;
    }

    const elements = document.querySelectorAll('*');
    for (const el of elements) {
      const style = window.getComputedStyle(el);

      // Background colors
      const bgColor = getRGBA(style.backgroundColor);
      if (bgColor !== 'rgba(0, 0, 0, 0)') {
        result.background.push({
          color: bgColor,
          element: el.tagName.toLowerCase(),
          context: el.textContent.slice(0, 50),
        });
      }

      // Text colors
      const textColor = getRGBA(style.color);
      result.text.push({
        color: textColor,
        element: el.tagName.toLowerCase(),
        context: el.textContent.slice(0, 50),
      });

      // Border colors
      const borderColor = getRGBA(style.borderColor);
      if (borderColor !== 'rgba(0, 0, 0, 0)') {
        result.border.push({
          color: borderColor,
          element: el.tagName.toLowerCase(),
          context: el.textContent.slice(0, 50),
        });
      }

      // Other colors (like outline)
      const outlineColor = getRGBA(style.outlineColor);
      if (outlineColor !== 'rgba(0, 0, 0, 0)') {
        result.other.push({
          color: outlineColor,
          element: el.tagName.toLowerCase(),
          context: el.textContent.slice(0, 50),
        });
      }
    }

    return result;
  });

  return colors;
}

/**
 * Parse RGB/RGBA color string
 * @param {string} color CSS color string
 * @returns {Object|null} Color object with r,g,b,a values or null if invalid
 */
function parseRGBA(color) {
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!rgbaMatch) return null;

  return {
    r: Number.parseInt(rgbaMatch[1], 10),
    g: Number.parseInt(rgbaMatch[2], 10),
    b: Number.parseInt(rgbaMatch[3], 10),
    a: rgbaMatch[4] ? Number.parseFloat(rgbaMatch[4]) : 1,
  };
}

/**
 * Convert RGB color object to string representation
 * @param {Object} color RGB(A) color object
 * @returns {string} RGB(A) color string
 */
function rgbToString(color) {
  return color.a !== undefined && color.a !== 1
    ? `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
    : `rgb(${color.r}, ${color.g}, ${color.b})`;
}

export default {
  extractColors,
};
