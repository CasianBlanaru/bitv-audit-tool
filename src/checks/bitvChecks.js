import { SEVERITY_LEVELS, BITV_CATEGORIES } from '../constants.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getContrastRatio } from '../utils/helpers.js';
import { extractColors } from './colorExtractor.js';

// Function to indicate manual checks required
const addManualCheckNote = (checkId, errors) => {
  const manualCheckCriteria = ['2.4.7', '2.1.1', '1.4.10']; // Criteria requiring manual verification
  if (manualCheckCriteria.includes(checkId) && errors.length > 0) {
    for (const error of errors) {
      error.manualCheckRequired = `This error (${checkId}) requires manual verification to ensure requirements are fully met (e.g., focus visibility during interaction or keyboard navigation).`;
    }
  }
  return errors;
};

export const BITV_CHECKS = {
  '1.1.1': {
    description: 'Non-text Content (Alternative Text)',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    fixableByWidget: true, // Automatically fixable (e.g., by adding alt texts)
    fixSuggestion: 'Add a descriptive `alt` attribute (e.g., `alt="Description of the image"`). For decorative images, set `alt=""` or `role="presentation"`.',
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const images = document.querySelectorAll('img');
        for (const img of images) {
          const alt = img.getAttribute('alt') || '';
          const isDecorative = img.hasAttribute('role') && img.getAttribute('role') === 'presentation';
          const isSuspicious =
            alt.match(/^(image|graphic|img\d+\.\w+)$/i) || (!isDecorative && (alt.length < 5 || alt.length > 150));
          if (!isDecorative && alt === '') {
            errors.push({
              src: img.src,
              selector: img.getAttribute('id') ? `#${img.id}` : `img[src="${img.src.replace(/"/g, '')}"]`,
              error: 'Missing alternative text',
            });
          } else if (isSuspicious && !isDecorative) {
            errors.push({
              src: img.src,
              selector: img.getAttribute('id') ? `#${img.id}` : `img[src="${img.src.replace(/"/g, '')}"]`,
              error: `Suspicious alternative text: "${alt}"`,
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} not visible within 5 seconds: ${e.message}`);
          });

          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              let parentAccordion = el.closest('[role="tabpanel"], [aria-expanded]');
              while (parentAccordion) {
                const control =
                  document.querySelector(`[aria-controls="${parentAccordion.id}"]`) ||
                  parentAccordion.querySelector('[aria-expanded]');
                if (control && control.getAttribute('aria-expanded') === 'false') {
                  control.click();
                }
                parentAccordion = parentAccordion.parentElement.closest('[role="tabpanel"], [aria-expanded]');
              }
              el.style.display = 'block';
              el.style.visibility = 'visible';
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, error.selector);

          const boundingBox = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) {
              console.log(`Element with selector ${sel} not found.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element with selector ${sel} is not visible (display: none or visibility: hidden).`);
              return null;
            }
            const rect = el.getBoundingClientRect();
            if (
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height) ||
              rect.x < 0 ||
              rect.y < 0
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_1.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Created fallback screenshot for ${error.selector}.`);
          }
        } catch (e) {
          console.warn(`Screenshot failed for ${error.selector}: ${e.message}`);
          const filename = `error_1.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    },
  },
  '2.4.7': {
    description: 'Focus Visible',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.BEDIENBAR,
    fixableByWidget: true, // Automatically fixable (e.g., through CSS outline)
    fixSuggestion:
      'Add a visible focus indicator, e.g., `outline: 2px solid #000; outline-offset: 2px;` for focused elements. Example CSS: `a:focus, button:focus { outline: 2px solid #000; }`.',
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const focusable = document.querySelectorAll(
          'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        for (const el of focusable) {
          const style = window.getComputedStyle(el, ':focus');
          const hasVisibleFocus =
            style.outline !== 'none' && style.outlineWidth !== '0px' && style.boxShadow !== 'none';
          if (!hasVisibleFocus) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'No visible focus indicator',
            });
          }
        }
        return errors;
      });

      // Add manual check note
      const finalResults = addManualCheckNote('2.4.7', results);

      for (const error of finalResults) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} not visible within 5 seconds: ${e.message}`);
          });

          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              let parentAccordion = el.closest('[role="tabpanel"], [aria-expanded]');
              while (parentAccordion) {
                const control =
                  document.querySelector(`[aria-controls="${parentAccordion.id}"]`) ||
                  parentAccordion.querySelector('[aria-expanded]');
                if (control && control.getAttribute('aria-expanded') === 'false') {
                  control.click();
                }
                parentAccordion = parentAccordion.parentElement.closest('[role="tabpanel"], [aria-expanded]');
              }
              el.style.display = 'block';
              el.style.visibility = 'visible';
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, error.selector);

          const boundingBox = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) {
              console.log(`Element with selector ${sel} not found.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element with selector ${sel} is not visible (display: none or visibility: hidden).`);
              return null;
            }
            const rect = el.getBoundingClientRect();
            if (
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height) ||
              rect.x < 0 ||
              rect.y < 0
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_2.4.7_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_2.4.7_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Created fallback screenshot for ${error.selector}.`);
          }
        } catch (e) {
          console.warn(`Screenshot failed for ${error.selector}: ${e.message}`);
          const filename = `error_2.4.7_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return finalResults;
    },
  },
  '1.3.1': {
    description: 'Info and Relationships',
    severity: SEVERITY_LEVELS.CRITICAL,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    fixableByWidget: true, // Automatically fixable (e.g., by adding labels)
    fixSuggestion:
      'Add a `<label for="id">` or `aria-label`. Example: `<label for="input-id">Description</label><input id="input-id">`. For headings: Ensure logical hierarchy (e.g., H1 > H2).',
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const formElements = document.querySelectorAll('input, select, textarea');
        for (const element of formElements) {
          if (element.type === 'hidden') continue;
          const hasLabel =
            element.labels?.length > 0 || element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
          if (!hasLabel) {
            errors.push({
              element: element.outerHTML.slice(0, 100),
              selector: element.getAttribute('id') ? `#${element.id}` : element.tagName.toLowerCase(),
              error: 'No programmatically determinable label',
            });
          }
        }
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        let lastLevel = 0;
        for (const heading of headings) {
          const level = Number.parseInt(heading.tagName.slice(1));
          if (lastLevel && level > lastLevel + 1) {
            errors.push({
              element: heading.outerHTML.slice(0, 100),
              selector: heading.getAttribute('id') ? `#${heading.id}` : heading.tagName.toLowerCase(),
              error: `Skipped heading level: H${lastLevel} to H${level}`,
            });
          }
          lastLevel = level;
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} not visible within 5 seconds: ${e.message}`);
          });

          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el) {
              let parentAccordion = el.closest('[role="tabpanel"], [aria-expanded]');
              while (parentAccordion) {
                const control =
                  document.querySelector(`[aria-controls="${parentAccordion.id}"]`) ||
                  parentAccordion.querySelector('[aria-expanded]');
                if (control && control.getAttribute('aria-expanded') === 'false') {
                  control.click();
                }
                parentAccordion = parentAccordion.parentElement.closest('[role="tabpanel"], [aria-expanded]');
              }
              el.style.display = 'block';
              el.style.visibility = 'visible';
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, error.selector);

          const boundingBox = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) {
              console.log(`Element with selector ${sel} not found.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element with selector ${sel} is not visible (display: none or visibility: hidden).`);
              return null;
            }
            const rect = el.getBoundingClientRect();
            if (
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height) ||
              rect.x < 0 ||
              rect.y < 0
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_1.3.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.3.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Created fallback screenshot for ${error.selector}.`);
          }
        } catch (e) {
          console.warn(`Screenshot failed for ${error.selector}: ${e.message}`);
          const filename = `error_1.3.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    },
  },
  // Additional checks (e.g., 1.2.3, 1.2.5, etc.) can be adapted similarly
};

// Example of adapting another check
BITV_CHECKS['1.4.3'] = {
  description: 'Contrast (Minimum)',
  severity: SEVERITY_LEVELS.HIGH,
  category: BITV_CATEGORIES.WAHRNEHMBAR,
  fixableByWidget: true, // Automatically fixable (e.g., by adjusting colors)
  fixSuggestion:
    'Increase contrast ratio by using darker foreground colors or lighter background colors. Example: `#000` on `#FFF` for a ratio > 4.5:1. Use tools like WebAIM Contrast Checker.',
  check: async (page) => {
    await fs.mkdir('screenshots', { recursive: true });
    const colors = await extractColors(page);
    const results = await page.evaluate(() => {
      const errors = [];
      const elements = document.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, a, label, button, input[type="submit"], input[type="button"]'
      );
      for (const el of elements) {
        const style = window.getComputedStyle(el);
        const fgColor = style.color;
        const bgColor = style.backgroundColor;
        const text = el.textContent.trim();

        if (!text || text.length === 0) continue;

        if (bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') continue;

        if (text.length < 4 && !el.matches('h1, h2, h3, button')) continue;

        errors.push({
          element: el.outerHTML.slice(0, 100),
          selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
          text: text.slice(0, 50),
          fgColor,
          bgColor,
        });
      }
      return errors;
    });

    const errors = [];
    for (const item of results) {
      try {
        const contrastRatio = getContrastRatio(item.fgColor, item.bgColor);
        const fontSize = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? Number.parseFloat(window.getComputedStyle(el).fontSize) : 16;
        }, item.selector);

        const fontWeight = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? Number.parseFloat(window.getComputedStyle(el).fontWeight) : 400;
        }, item.selector);

        const isLarge = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
        const isHeading = item.selector.match(/^h[1-6]$/);
        const required = isLarge || isHeading ? 3 : 4.5;

        const tolerance = 0.2;
        if (contrastRatio < required - tolerance) {
          errors.push({
            element: item.element,
            text: item.text,
            selector: item.selector,
            error: `Contrast too low: ${contrastRatio.toFixed(2)} < ${required}`,
            fgColor: item.fgColor,
            bgColor: item.bgColor,
          });
        }
      } catch (e) {
        console.warn(`Contrast calculation failed for ${item.selector}: ${e.message}`);
      }
    }

    for (const error of errors) {
      try {
        await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
          console.warn(`Element ${error.selector} not visible within 5 seconds: ${e.message}`);
        });

        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) {
            let parentAccordion = el.closest('[role="tabpanel"], [aria-expanded]');
            while (parentAccordion) {
              const control =
                document.querySelector(`[aria-controls="${parentAccordion.id}"]`) ||
                parentAccordion.querySelector('[aria-expanded]');
              if (control && control.getAttribute('aria-expanded') === 'false') {
                control.click();
              }
              parentAccordion = parentAccordion.parentElement.closest('[role="tabpanel"], [aria-expanded]');
            }
            el.style.display = 'block';
            el.style.visibility = 'visible';
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, error.selector);

        const boundingBox = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) {
            console.log(`Element with selector ${sel} not found.`);
            return null;
          }
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') {
            console.log(`Element with selector ${sel} is not visible (display: none or visibility: hidden).`);
            return null;
          }
          const rect = el.getBoundingClientRect();
          if (
            rect.width <= 0 ||
            rect.height <= 0 ||
            Number.isNaN(rect.x) ||
            Number.isNaN(rect.y) ||
            Number.isNaN(rect.width) ||
            Number.isNaN(rect.height) ||
            rect.x < 0 ||
            rect.y < 0
          ) {
            console.log(`Invalid BoundingBox for ${sel}:`, rect);
            return null;
          }
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        }, error.selector);

        if (boundingBox) {
          const filename = `error_1.4.3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            clip: boundingBox,
          });
          error.screenshot = `screenshots/${filename}`;
        } else {
          const filename = `error_1.4.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
          console.log(`Created fallback screenshot for ${error.selector}.`);
        }
      } catch (e) {
        console.warn(`Screenshot failed for ${error.selector}: ${e.message}`);
        const filename = `error_1.4.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true,
        });
        error.screenshot = `screenshots/${filename}`;
      }
    }
    return errors;
  },
};

// BITV_CHECK_CATEGORIES (unchanged, included for completeness)
const BITV_CHECK_CATEGORIES = {
  '1.1.1': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.2.3': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.2.5': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.3.1': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.3.1a': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.3.2': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.4.3': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.4.4': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.4.10': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.4.11': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.4.12': BITV_CATEGORIES.WAHRNEHMBAR,
  '2.1.1': BITV_CATEGORIES.BEDIENBAR,
  '2.2.2': BITV_CATEGORIES.BEDIENBAR,
  '2.4.1': BITV_CATEGORIES.BEDIENBAR,
  '2.4.2': BITV_CATEGORIES.BEDIENBAR,
  '2.4.4': BITV_CATEGORIES.BEDIENBAR,
  '2.4.5': BITV_CATEGORIES.BEDIENBAR,
  '2.4.7': BITV_CATEGORIES.BEDIENBAR,
  '2.5.3': BITV_CATEGORIES.BEDIENBAR,
  '3.1.1': BITV_CATEGORIES.VERSTAENDLICH,
  '3.1.3': BITV_CATEGORIES.VERSTAENDLICH,
  '3.2.4': BITV_CATEGORIES.VERSTAENDLICH,
  '3.3.1': BITV_CATEGORIES.VERSTAENDLICH,
  '3.3.2': BITV_CATEGORIES.VERSTAENDLICH,
  '3.3.3': BITV_CATEGORIES.VERSTAENDLICH,
  '3.3.4': BITV_CATEGORIES.VERSTAENDLICH,
  '4.1.1': BITV_CATEGORIES.ROBUST,
  '4.1.2': BITV_CATEGORIES.ROBUST,
};

export default BITV_CHECKS;