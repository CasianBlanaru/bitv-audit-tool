const { SEVERITY_LEVELS, BITV_CATEGORIES } = require('../constants');
const fs = require('node:fs').promises;
const path = require('node:path');
const { getContrastRatio } = require('../utils/helpers');

const BITV_CHECKS = {
  '1.1.1': {
    description: 'Non-text Content (Alternative Text)',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
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
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            // Fallback: Screenshot der gesamten Seite
            const filename = `error_1.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          // Fallback: Screenshot der gesamten Seite
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
  '1.2.3': {
    description: 'Audiodeskription oder Medienalternative',
    severity: SEVERITY_LEVELS.MEDIUM,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      return await page.evaluate(async () => {
        const errors = [];
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
          const tracks = video.querySelectorAll('track[kind="descriptions"], track[kind="captions"]');
          if (!tracks.length) {
            errors.push({
              src: video.currentSrc,
              selector: video.getAttribute('id') ? `#${video.id}` : 'video',
              error: 'Keine Audiodeskription oder Untertitel gefunden',
            });
          }
        }
        return errors;
      });
    },
  },
  '1.2.5': {
    description: 'Audiodeskription (vorgefertigt)',
    severity: SEVERITY_LEVELS.MEDIUM,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      return await page.evaluate(async () => {
        const errors = [];
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
          const tracks = video.querySelectorAll('track[kind="descriptions"]');
          const trackUrls = Array.from(tracks).map((t) => t.src);
          const validTracks = [];
          for (const url of trackUrls) {
            try {
              const response = await fetch(url);
              if (response.ok) validTracks.push(url);
            } catch {
              // Ignoriere Fehler
            }
          }
          if (!validTracks.length && tracks.length > 0) {
            errors.push({
              src: video.currentSrc,
              selector: video.getAttribute('id') ? `#${video.id}` : 'video',
              error: 'Ungültige oder fehlende Audiodeskription',
            });
          }
        }
        return errors;
      });
    },
  },
  '1.3.1': {
    description: 'Info and Relationships',
    severity: SEVERITY_LEVELS.CRITICAL,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
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
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
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
  '1.3.1a': {
    description: 'Info and Relationships (Heading Structure)',
    severity: SEVERITY_LEVELS.CRITICAL,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
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
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_1.3.1a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.3.1a_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_1.3.1a_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '1.4.3': {
    description: 'Contrast (Minimum)',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const colors = await require('./colorExtractor').extractColors(page);
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
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
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
  },
  '2.2.2': {
    description: 'Pausieren, Stoppen, Ausblenden',
    severity: SEVERITY_LEVELS.CRITICAL,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const movingElements = document.querySelectorAll('[style*="animation"], [style*="transition"], marquee');
        for (const element of movingElements) {
          const hasPause =
            element.querySelector('button[aria-label*="pause"], button[aria-label*="stop"]') ||
            element.hasAttribute('aria-controls');
          if (!hasPause) {
            errors.push({
              element: element.outerHTML.slice(0, 100),
              selector: element.getAttribute('id') ? `#${element.id}` : element.tagName.toLowerCase(),
              error: 'Kein Mechanismus zum Pausieren oder Stoppen',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_2.2.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_2.2.2_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_2.2.2_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '2.4.4': {
    description: 'Linkzweck (im Kontext)',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const links = document.querySelectorAll('a[href]');
        for (const link of links) {
          const text = link.textContent.trim();
          const ariaLabel = link.getAttribute('aria-label') || '';
          const parentText = link.parentElement?.textContent.trim() || '';
          const isGeneric = /^(hier klicken|mehr|click here)$/i.test(text);
          const hasContext = parentText.length > text.length && parentText !== text;
          if (isGeneric && !ariaLabel && !hasContext) {
            errors.push({
              text,
              href: link.href,
              selector: link.getAttribute('id') ? `#${link.id}` : `a[href="${link.href.replace(/"/g, '')}"]`,
              error: 'Generischer Link ohne klaren Kontext',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_2.4.4_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_2.4.4_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_2.4.4_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '2.4.5': {
    description: 'Mehrere Wege',
    severity: SEVERITY_LEVELS.MEDIUM,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const navigationMethods = [];
        if (document.querySelector('nav')) navigationMethods.push('Navigationsleiste');
        if (document.querySelector('form[role="search"], input[type="search"]')) navigationMethods.push('Suche');
        if (document.querySelector('a[href$="sitemap"], a[href$="site-map"]')) navigationMethods.push('Sitemap');
        if (navigationMethods.length < 2) {
          return [
            {
              error: `Weniger als zwei Navigationswege gefunden: ${navigationMethods.join(', ') || 'keine'}`,
            },
          ];
        }
        return [];
      });
      return results;
    },
  },
  '3.1.3': {
    description: 'Ungewöhnliche Wörter',
    severity: SEVERITY_LEVELS.LOW,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const hasGlossary =
          document.querySelector('a[href*="glossary"], a[href*="glossar"]') ||
          document.querySelector('[id*="glossary"], [id*="glossar"]');
        if (!hasGlossary) {
          return [{ error: 'Kein Glossar oder Begriffserklärungen gefunden' }];
        }
        return [];
      });
      return results;
    },
  },
  '3.2.4': {
    description: 'Konsistente Bezeichnung',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const links = document.querySelectorAll('a[href]');
        const linkMap = {};
        for (const link of links) {
          const text = link.textContent.trim();
          if (text) {
            if (!linkMap[text]) linkMap[text] = [];
            linkMap[text].push(link.href);
          }
        }
        for (const [text, hrefs] of Object.entries(linkMap)) {
          const uniqueHrefs = [...new Set(hrefs)];
          if (uniqueHrefs.length > 1) {
            errors.push({
              text,
              hrefs: uniqueHrefs,
              error: `Inconsistent naming: "${text}" leads to multiple targets`,
            });
          }
        }
        return errors;
      });
      return results;
    },
  },
  '4.1.1': {
    description: 'Parsing',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.ROBUST,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const elements = document.querySelectorAll('*');
        for (const element of elements) {
          const id = element.getAttribute('id');
          if (id && document.querySelectorAll(`[id="${id}"]`).length > 1) {
            errors.push({
              element: element.tagName.toLowerCase(),
              id,
              error: `Duplicate ID attribute: ${id}`,
            });
          }
        }
        const buttons = document.querySelectorAll('button');
        for (const button of buttons) {
          const invalidChildren = button.querySelectorAll('div, p, ul, ol');
          if (invalidChildren.length) {
            errors.push({
              element: button.outerHTML.slice(0, 100),
              selector: button.getAttribute('id') ? `#${button.id}` : 'button',
              error: 'Invalid child elements in button',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_4.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_4.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_4.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '2.1.1': {
    description: 'Without Mouse Usable',
    severity: SEVERITY_LEVELS.CRITICAL,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const interactiveElements = document.querySelectorAll(
          'a, button, input, select, textarea, [role="button"], [role="link"]'
        );

        for (const el of interactiveElements) {
          const style = window.getComputedStyle(el);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
          const tabIndex = el.getAttribute('tabindex');
          const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
          const isDecorative = el.getAttribute('role') === 'presentation' || el.getAttribute('role') === 'none';
          const hasClickHandler =
            el.hasAttribute('onclick') || el.hasAttribute('onmousedown') || el.hasAttribute('onmouseup');

          if (!isVisible || isDisabled || isDecorative) continue;

          if (tabIndex === '-1' && hasClickHandler) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Interaktives Element nicht mit Tastatur erreichbar',
            });
          }

          if (
            hasClickHandler &&
            !el.hasAttribute('onkeypress') &&
            !el.hasAttribute('onkeydown') &&
            !el.hasAttribute('onkeyup') &&
            !el.closest('button, a, input[type="button"], input[type="submit"]')
          ) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Element nur mit Maus bedienbar',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          const filename = `error_2.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        } catch (e) {
          console.warn(`Screenshot fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
  '3.1.1': {
    description: 'Main Language Specified',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const html = document.documentElement;
        const lang = html.getAttribute('lang');
        const validLangRegex = /^[a-z]{2}(-[A-Z]{2})?$/;

        if (!lang) {
          errors.push({
            element: html.outerHTML.slice(0, 100),
            selector: 'html',
            error: 'No main language (lang attribute) defined',
          });
        } else if (!validLangRegex.test(lang)) {
          errors.push({
            element: html.outerHTML.slice(0, 100),
            selector: 'html',
            error: `Invalid language code: ${lang}`,
          });
        }
        return errors;
      });

      if (results.length > 0) {
        const filename = `error_3.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true,
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    },
  },
  '4.1.2': {
    description: 'Name, Role, Value Available',
    severity: SEVERITY_LEVELS.CRITICAL,
    category: BITV_CATEGORIES.ROBUST,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];

        const customControls = document.querySelectorAll('[role]');
        for (const control of customControls) {
          const role = control.getAttribute('role');
          const hasName =
            control.hasAttribute('aria-label') ||
            control.hasAttribute('aria-labelledby') ||
            control.textContent.trim().length > 0;

          if (!hasName) {
            errors.push({
              element: control.outerHTML.slice(0, 100),
              selector: control.getAttribute('id') ? `#${control.id}` : control.tagName.toLowerCase(),
              error: `Custom Control without accessible name (role="${role}")`,
            });
          }
        }

        return errors;
      });

      for (const error of results) {
        try {
          const filename = `error_4.1.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        } catch (e) {
          console.warn(`Screenshot fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
  '1.3.2': {
    description: 'Sinnvolle Reihenfolge',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];

        const positionedElements = document.querySelectorAll('*');
        for (const el of positionedElements) {
          const style = window.getComputedStyle(el);
          if (style.position === 'absolute' || style.position === 'fixed') {
            const hasZIndex = style.zIndex !== 'auto';
            const isInteractive =
              el.tagName === 'A' ||
              el.tagName === 'BUTTON' ||
              el.hasAttribute('onclick') ||
              el.getAttribute('role') === 'button';

            if (hasZIndex && isInteractive) {
              errors.push({
                element: el.outerHTML.slice(0, 100),
                selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
                error: 'Positioned interactive element could interfere with reading order',
              });
            }
          }
        }

        return errors;
      });

      if (results.length > 0) {
        const filename = `error_1.3.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true,
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    },
  },
  '2.4.1': {
    description: 'Sections Skippable',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];

        const skipLinks = document.querySelectorAll('a[href^="#"]');
        let hasSkipLink = false;

        for (const link of skipLinks) {
          if (
            link.textContent.toLowerCase().includes('springe zu') ||
            link.textContent.toLowerCase().includes('zum inhalt')
          ) {
            hasSkipLink = true;
            break;
          }
        }

        if (!hasSkipLink) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'No Skip-Link to main content found',
          });
        }

        const hasMain = document.querySelector('main, [role="main"]');
        const hasNav = document.querySelector('nav, [role="navigation"]');

        if (!hasMain) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'No main content area (main) defined',
          });
        }

        if (!hasNav) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'No navigation (nav) defined',
          });
        }

        return errors;
      });

      if (results.length > 0) {
        const filename = `error_2.4.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true,
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    },
  },
  '2.4.2': {
    description: 'Sinnvolle Dokumenttitel',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const title = document.title.trim();

        if (!title) {
          errors.push({
            element: document.head.outerHTML.slice(0, 100),
            selector: 'title',
            error: 'No document title present',
          });
        } else if (title.length < 5) {
          errors.push({
            element: document.head.outerHTML.slice(0, 100),
            selector: 'title',
            error: `Document title too short: "${title}"`,
          });
        } else if (title.toLowerCase().includes('untitled') || title.toLowerCase().includes('new page')) {
          errors.push({
            element: document.head.outerHTML.slice(0, 100),
            selector: 'title',
            error: `Standard title not changed: "${title}"`,
          });
        }

        return errors;
      });

      if (results.length > 0) {
        const filename = `error_2.4.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true,
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    },
  },
  '1.4.4': {
    description: 'Text 200% Scalable',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });

      await page.setViewport({
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
      });
      const normalSize = await page.evaluate(() => {
        const contentBox = document.body.getBoundingClientRect();
        return {
          width: contentBox.width,
          height: contentBox.height,
          overflow: window.getComputedStyle(document.body).overflow,
        };
      });

      await page.setViewport({
        width: 1280,
        height: 800,
        deviceScaleFactor: 2,
      });
      const results = await page.evaluate((normalSize) => {
        const errors = [];
        const contentBox = document.body.getBoundingClientRect();
        const style = window.getComputedStyle(document.body);

        if (contentBox.width > normalSize.width * 1.1) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'Horizontal scrolling required at 200% Zoom',
          });
        }

        const elements = document.querySelectorAll('p, div, span, a');
        for (const el of elements) {
          const elStyle = window.getComputedStyle(el);
          if (elStyle.overflow === 'hidden' && el.scrollWidth > el.clientWidth) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Text gets cut off at 200% Zoom',
            });
          }
        }

        return errors;
      }, normalSize);

      for (const error of results) {
        try {
          const filename = `error_1.4.4_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        } catch (e) {
          console.warn(`Screenshot fehlgeschlagen: ${e.message}`);
        }
      }

      await page.setViewport({
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
      });
      return results;
    },
  },
  '3.3.1': {
    description: 'Error Detection',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const forms = document.querySelectorAll('form');

        for (const form of forms) {
          if (
            form.getAttribute('role') === 'search' ||
            form.classList.contains('search') ||
            form.classList.contains('newsletter')
          )
            continue;

          const inputs = form.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
          );

          for (const input of inputs) {
            const isRequired = input.hasAttribute('required');
            const hasValidation =
              input.hasAttribute('pattern') ||
              input.hasAttribute('minlength') ||
              input.hasAttribute('maxlength') ||
              input.hasAttribute('min') ||
              input.hasAttribute('max');

            if (isRequired && !hasValidation && !input.hasAttribute('aria-invalid')) {
              errors.push({
                element: input.outerHTML.slice(0, 100),
                selector: input.getAttribute('id') ? `#${input.id}` : input.tagName.toLowerCase(),
                error: 'Required field without validation attributes',
              });
            }
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, {
            visible: true,
            timeout: 5000,
          });
          const element = await page.$(error.selector);
          if (element) {
            const filename = `error_3.3.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await element.screenshot({
              path: `screenshots/${filename}`,
              type: 'png',
            });
            error.screenshot = `screenshots/${filename}`;
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
  '3.3.2': {
    description: 'Form Element Labels',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];

        const formElements = document.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
        );
        for (const el of formElements) {
          if (el.closest('form[role="search"]') || el.closest('.search') || el.closest('.newsletter')) continue;

          const hasLabel = el.labels?.length > 0;
          const hasAriaLabel = el.hasAttribute('aria-label');
          const hasAriaLabelledBy = el.hasAttribute('aria-labelledby');
          const hasTitle = el.hasAttribute('title');
          const hasPlaceholder = el.hasAttribute('placeholder');
          const isRequired = el.hasAttribute('required');

          if (
            (isRequired || el.type === 'email' || el.type === 'tel') &&
            !hasLabel &&
            !hasAriaLabel &&
            !hasAriaLabelledBy &&
            !hasTitle
          ) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Important form element without label',
            });
          }

          if (isRequired && !hasLabel && !hasAriaLabel && !hasAriaLabelledBy && hasPlaceholder) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Required field uses only placeholder as label',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, {
            visible: true,
            timeout: 5000,
          });
          const element = await page.$(error.selector);
          if (element) {
            const filename = `error_3.3.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await element.screenshot({
              path: `screenshots/${filename}`,
              type: 'png',
            });
            error.screenshot = `screenshots/${filename}`;
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
  '3.3.3': {
    description: 'Fehlerkorrekturvorschläge',
    severity: SEVERITY_LEVELS.MEDIUM,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
          if (
            form.getAttribute('role') === 'search' ||
            form.classList.contains('search') ||
            form.classList.contains('newsletter')
          )
            continue;
          const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
          for (const input of inputs) {
            const errorMsg = input.getAttribute('aria-describedby')
              ? document.querySelector(`#${input.getAttribute('aria-describedby')}`)
              : form.querySelector('.error-message, [role="alert"]');
            if (!errorMsg || !errorMsg.textContent.trim()) {
              errors.push({
                element: input.outerHTML.slice(0, 100),
                selector: input.getAttribute('id') ? `#${input.id}` : input.tagName.toLowerCase(),
                error: 'Kein Fehlerkorrekturvorschlag für erforderliches Feld',
              });
            }
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_3.3.3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_3.3.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_3.3.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '3.3.4': {
    description: 'Fehlervermeidung (rechtlich, finanziell)',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const forms = document.querySelectorAll(
          'form[action*="submit"], form[action*="payment"], form[action*="order"]'
        );
        for (const form of forms) {
          const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
          const confirmStep =
            form.querySelector(
              '[aria-label*="bestätigen"], [textContent*="Bestätigen"], [textContent*="Überprüfen"]'
            ) || form.querySelector('input[type="checkbox"][required]');
          if (submitButton && !confirmStep) {
            errors.push({
              element: form.outerHTML.slice(0, 100),
              selector: form.getAttribute('id') ? `#${form.id}` : 'form',
              error: 'Keine Bestätigung oder Überprüfung bei rechtsverbindlicher Eingabe',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_3.3.4_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_3.3.4_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_3.3.4_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '1.4.10': {
    description: 'Reflow (Inhalt ohne Scrollen bei 400% Zoom)',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      await page.setViewport({
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
      });
      const normalSize = await page.evaluate(() => {
        const contentBox = document.body.getBoundingClientRect();
        return { width: contentBox.width, height: contentBox.height };
      });

      await page.setViewport({ width: 320, height: 256, deviceScaleFactor: 1 }); // Simuliert 400% Zoom
      const results = await page.evaluate(() => {
        const errors = [];
        const bodyStyle = window.getComputedStyle(document.body);
        if (bodyStyle.overflowX !== 'visible' && document.documentElement.scrollWidth > 320) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'Horizontaler Scroll bei 400% Zoom erforderlich',
          });
        }
        const elements = document.querySelectorAll('p, div, span, a, button');
        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.left < 0 || rect.right > 320) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Inhalt außerhalb des sichtbaren Bereichs bei 400% Zoom',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_1.4.10_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.4.10_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_1.4.10_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        }
      }

      await page.setViewport({
        width: 1280,
        height: 800,
        deviceScaleFactor: 1,
      });
      return results;
    },
  },
  '1.4.11': {
    description: 'Kontrast von Nicht-Text-Inhalten',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const elements = document.querySelectorAll(
          'button, input[type="submit"], input[type="button"], [role="button"], a'
        );
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          const bgColor = style.backgroundColor;
          const borderColor = style.borderColor || style.borderTopColor;
          const parent = el.parentElement;
          let parentBg = 'rgba(0, 0, 0, 0)';
          if (parent) {
            parentBg = window.getComputedStyle(parent).backgroundColor;
          }
          if (bgColor !== 'rgba(0, 0, 0, 0)' && parentBg !== 'rgba(0, 0, 0, 0)') {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              bgColor,
              parentBg,
            });
          }
          if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              borderColor,
              parentBg,
            });
          }
        }
        return errors;
      });

      const errors = [];
      for (const item of results) {
        try {
          let contrastRatio;
          if (item.bgColor && item.parentBg) {
            contrastRatio = getContrastRatio(item.bgColor, item.parentBg);
          } else if (item.borderColor && item.parentBg) {
            contrastRatio = getContrastRatio(item.borderColor, item.parentBg);
          }
          if (contrastRatio && contrastRatio < 3) {
            errors.push({
              element: item.element,
              selector: item.selector,
              error: `Kontrast von Nicht-Text-Element zu niedrig: ${contrastRatio.toFixed(2)} < 3`,
              fgColor: item.bgColor || item.borderColor,
              bgColor: item.parentBg,
            });
          }
        } catch (e) {
          console.warn(`Kontrastberechnung fehlgeschlagen für ${item.selector}: ${e.message}`);
        }
      }

      for (const error of errors) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_1.4.11_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.4.11_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_1.4.11_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({
            path: `screenshots/${filename}`,
            fullPage: true,
          });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return errors;
    },
  },
  '2.4.7': {
    description: 'Fokus sichtbar',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.BEDIENBAR,
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
              error: 'Kein sichtbarer Fokusindikator',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_2.4.7_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '2.5.3': {
    description: 'Label im Namen',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const controls = document.querySelectorAll('button, input, select, textarea, [role="button"], [role="link"]');
        for (const control of controls) {
          const ariaLabel = control.getAttribute('aria-label') || '';
          const label = control.labels?.[0]?.textContent.trim() || '';
          const textContent = control.textContent.trim();
          if (ariaLabel && label && !ariaLabel.toLowerCase().includes(label.toLowerCase())) {
            errors.push({
              element: control.outerHTML.slice(0, 100),
              selector: control.getAttribute('id') ? `#${control.id}` : control.tagName.toLowerCase(),
              error: `aria-label "${ariaLabel}" enthält nicht den sichtbaren Label "${label}"`,
            });
          }
          if (!ariaLabel && !label && textContent && control.getAttribute('aria-label') !== textContent) {
            errors.push({
              element: control.outerHTML.slice(0, 100),
              selector: control.getAttribute('id') ? `#${control.id}` : control.tagName.toLowerCase(),
              error: 'Kein zugänglicher Name, der den sichtbaren Text enthält',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_2.5.3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_2.5.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_2.5.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
  '1.4.12': {
    description: 'Text Spacing',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });

      // Apply text spacing styles
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.id = 'text-spacing-test';
        style.textContent = `
          * {
            line-height: 1.5 !important;
            letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important;
            padding-top: 0.2em !important;
            padding-bottom: 0.2em !important;
          }
        `;
        document.head.appendChild(style);
      });

      const results = await page.evaluate(() => {
        const errors = [];
        const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div:not(:empty)');

        for (const el of textElements) {
          const style = window.getComputedStyle(el);
          const originalHeight = el.clientHeight;
          const originalWidth = el.clientWidth;

          // Skip empty or hidden elements
          if (
            !el.textContent.trim() ||
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          ) {
            continue;
          }

          // Check for text overflow
          const hasOverflow = el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
          const isClipped = style.overflow === 'hidden' || style.textOverflow === 'clip';
          const hasEllipsis = style.textOverflow === 'ellipsis';

          if ((hasOverflow && isClipped) || hasEllipsis) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Text wird bei erhöhten Textabständen abgeschnitten',
              details: {
                originalSize: `${originalWidth}x${originalHeight}`,
                currentSize: `${el.scrollWidth}x${el.scrollHeight}`,
                overflow: style.overflow,
                textOverflow: style.textOverflow,
              },
            });
          }

          // Check for fixed heights that might cause clipping
          if (style.height !== 'auto' && style.maxHeight !== 'none' && !style.height.includes('%')) {
            const heightValue = Number.parseFloat(style.height);
            if (heightValue && heightValue < el.scrollHeight) {
              errors.push({
                element: el.outerHTML.slice(0, 100),
                selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
                error: 'Feste Höhe verhindert Textanpassung',
                details: {
                  fixedHeight: style.height,
                  requiredHeight: `${el.scrollHeight}px`,
                },
              });
            }
          }
        }
        return errors;
      });

      // Remove test styles
      await page.evaluate(() => {
        const testStyle = document.getElementById('text-spacing-test');
        if (testStyle) testStyle.remove();
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 }).catch((e) => {
            console.warn(`Element ${error.selector} nicht sichtbar innerhalb von 5 Sekunden: ${e.message}`);
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
              console.log(`Element mit Selector ${sel} nicht gefunden.`);
              return null;
            }
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              console.log(`Element mit Selector ${sel} ist nicht sichtbar (display: none oder visibility: hidden).`);
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
              console.log(`Ungültige BoundingBox für ${sel}:`, rect);
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
            const filename = `error_1.4.12_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              clip: boundingBox,
            });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.4.12_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({
              path: `screenshots/${filename}`,
              fullPage: true,
            });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_1.4.12_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
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
};

// BITV_CHECK_CATEGORIES
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
  '1.4.12': BITV_CATEGORIES.WAHRNEHMBAR, // Added Text Spacing check
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

module.exports = {
  BITV_CHECKS,
  BITV_CHECK_CATEGORIES,
};
