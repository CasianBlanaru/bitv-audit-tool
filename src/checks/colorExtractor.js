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
      const textColor = parseColor(el.color);
      const bgColor = parseColor(el.backgroundColor);
      
      // Skip elements with invalid or transparent colors
      if (!isValidColor(textColor) || !isValidColor(bgColor)) continue;
      
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
 * Validate color object
 * @param {Object} color Parsed color object
 * @returns {boolean} Whether the color is valid
 */
function isValidColor(color) {
  return color?.values?.length >= 3 && 
         color.values?.every(v => !Number.isNaN(v)) &&
         (color.alpha === undefined || !Number.isNaN(color.alpha));
}

/**
 * Convert RGB color to string representation
 * @param {Object} color Parsed color object
 * @returns {string} RGB(A) color string
 */
function rgbToString(color) {
  const [r, g, b] = color.values;
  return color.alpha !== undefined && color.alpha !== 1
    ? `rgba(${r}, ${g}, ${b}, ${color.alpha})`
    : `rgb(${r}, ${g}, ${b})`;
}

module.exports = {
  extractColors
};