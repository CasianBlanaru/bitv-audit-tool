// src/checks/colorExtractor.js
const { parse: parseColor } = require('color-parse');

/**
 * Extract colors from a webpage for contrast analysis
 * @param {Page} page Puppeteer page object
 * @returns {Promise<Object>} Extracted color information
 */
async function extractColors(page) {
  // Get all elements with text content
  const elements = await page.evaluate(() => {
    const results = [];
    const textElements = document.querySelectorAll('*');
    
    for (const el of textElements) {
      // Skip elements without text
      if (!el.textContent.trim()) continue;
      
      const style = window.getComputedStyle(el);
      // Extract color properties
      results.push({
        element: el.tagName.toLowerCase(),
        textContent: el.textContent.trim().slice(0, 50),
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: Number.parseFloat(style.fontSize),
        fontWeight: style.fontWeight
      });
    }
    return results;
  });

  // Process and validate colors
  const processedColors = [];
  for (const el of elements) {
    try {
      const textColor = parseRGBA(el.color);
      const bgColor = parseRGBA(el.backgroundColor);
      
      // Skip elements with invalid or transparent colors
      if (!textColor || !bgColor) continue;
      
      processedColors.push({
        element: el.element,
        text: el.textContent,
        foreground: rgbToString(textColor),
        background: rgbToString(bgColor),
        fontSize: el.fontSize,
        fontWeight: el.fontWeight
      });
    } catch (e) {
      console.warn('Color parsing error:', e.message);
    }
  }

  return processedColors;
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
    a: rgbaMatch[4] ? Number.parseFloat(rgbaMatch[4]) : 1
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

module.exports = {
  extractColors
};