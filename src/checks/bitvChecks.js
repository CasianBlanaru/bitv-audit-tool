// src/checks/bitvChecks.js
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
          const isSuspicious = alt.match(/^(image|graphic|img\d+\.\w+)$/i) || (!isDecorative && (alt.length < 5 || alt.length > 150));
          if (!isDecorative && alt === '') {
            errors.push({
              src: img.src,
              selector: img.getAttribute('id') ? `#${img.id}` : `img[src="${img.src.replace(/"/g, '')}"]`,
              error: 'Missing alternative text'
            });
          } else if (isSuspicious && !isDecorative) {
            errors.push({
              src: img.src,
              selector: img.getAttribute('id') ? `#${img.id}` : `img[src="${img.src.replace(/"/g, '')}"]`,
              error: `Suspicious alternative text: "${alt}"`
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
                const control = document.querySelector(`[aria-controls="${parentAccordion.id}"]`) || parentAccordion.querySelector('[aria-expanded]');
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
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
          const filename = `error_1.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
          error.screenshot = `screenshots/${filename}`;
          } else {
            // Fallback: Screenshot der gesamten Seite
            const filename = `error_1.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          // Fallback: Screenshot der gesamten Seite
          const filename = `error_1.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    }
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
              error: 'Keine Audiodeskription oder Untertitel gefunden'
            });
          }
        }
        return errors;
      });
    }
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
          const trackUrls = Array.from(tracks).map(t => t.src);
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
              error: 'Ungültige oder fehlende Audiodeskription'
            });
          }
        }
        return errors;
      });
    }
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
          const hasLabel = element.labels?.length > 0 || element.getAttribute('aria-label') || element.getAttribute('aria-labelledby');
          if (!hasLabel) {
            errors.push({
              element: element.outerHTML.slice(0, 100),
              selector: element.getAttribute('id') ? `#${element.id}` : element.tagName.toLowerCase(),
              error: 'No programmatically determinable label'
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
              error: `Skipped heading level: H${lastLevel} to H${level}`
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
                const control = document.querySelector(`[aria-controls="${parentAccordion.id}"]`) || parentAccordion.querySelector('[aria-expanded]');
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
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
          const filename = `error_1.3.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
          error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.3.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_1.3.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    }
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
              error: `Skipped heading level: H${lastLevel} to H${level}`
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
                const control = document.querySelector(`[aria-controls="${parentAccordion.id}"]`) || parentAccordion.querySelector('[aria-expanded]');
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
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_1.3.1a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.3.1a_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_1.3.1a_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    }
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
        const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, a, label, button, input[type="submit"], input[type="button"]');
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
            bgColor
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
              bgColor: item.bgColor
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
                const control = document.querySelector(`[aria-controls="${parentAccordion.id}"]`) || parentAccordion.querySelector('[aria-expanded]');
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
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
          const filename = `error_1.4.3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
          error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_1.4.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_1.4.3_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return errors;
    }
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
          const hasPause = element.querySelector('button[aria-label*="pause"], button[aria-label*="stop"]') ||
                           element.hasAttribute('aria-controls');
          if (!hasPause) {
            errors.push({
              element: element.outerHTML.slice(0, 100),
              selector: element.getAttribute('id') ? `#${element.id}` : element.tagName.toLowerCase(),
              error: 'Kein Mechanismus zum Pausieren oder Stoppen'
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
                const control = document.querySelector(`[aria-controls="${parentAccordion.id}"]`) || parentAccordion.querySelector('[aria-expanded]');
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
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
          const filename = `error_2.2.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
          error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_2.2.2_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_2.2.2_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    }
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
              error: 'Generischer Link ohne klaren Kontext'
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
                const control = document.querySelector(`[aria-controls="${parentAccordion.id}"]`) || parentAccordion.querySelector('[aria-expanded]');
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
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
          const filename = `error_2.4.4_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
          error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_2.4.4_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_2.4.4_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    }
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
          return [{
            error: `Weniger als zwei Navigationswege gefunden: ${navigationMethods.join(', ') || 'keine'}`
          }];
        }
        return [];
      });
      return results;
    }
  },
  '3.1.3': {
    description: 'Ungewöhnliche Wörter',
    severity: SEVERITY_LEVELS.LOW,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const hasGlossary = document.querySelector('a[href*="glossary"], a[href*="glossar"]') ||
                            document.querySelector('[id*="glossary"], [id*="glossar"]');
        if (!hasGlossary) {
          return [{ error: 'Kein Glossar oder Begriffserklärungen gefunden' }];
        }
        return [];
      });
      return results;
    }
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
              error: `Inconsistent naming: "${text}" leads to multiple targets`
            });
          }
        }
        return errors;
      });
      return results;
    }
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
              error: `Duplicate ID attribute: ${id}`
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
              error: 'Invalid child elements in button'
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
                const control = document.querySelector(`[aria-controls="${parentAccordion.id}"]`) || parentAccordion.querySelector('[aria-expanded]');
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
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_4.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            const filename = `error_4.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
            error.screenshot = `screenshots/${filename}`;
            console.log(`Fallback-Screenshot für ${error.selector} erstellt.`);
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
          const filename = `error_4.1.1_fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
          await page.screenshot({ path: `screenshots/${filename}`, fullPage: true });
          error.screenshot = `screenshots/${filename}`;
        }
      }
      return results;
    }
  },
  '2.1.1': {
    description: 'Without Mouse Usable',
    severity: SEVERITY_LEVELS.CRITICAL,
    category: BITV_CATEGORIES.BEDIENBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        const interactiveElements = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"]');
        
        for (const el of interactiveElements) {
          const style = window.getComputedStyle(el);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
          const tabIndex = el.getAttribute('tabindex');
          const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true';
          const isDecorative = el.getAttribute('role') === 'presentation' || el.getAttribute('role') === 'none';
          const hasClickHandler = el.hasAttribute('onclick') || el.hasAttribute('onmousedown') || el.hasAttribute('onmouseup');
          
          if (!isVisible || isDisabled || isDecorative) continue;
          
          if (tabIndex === '-1' && hasClickHandler) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Interaktives Element nicht mit Tastatur erreichbar'
            });
          }
          
          if (hasClickHandler && 
              !el.hasAttribute('onkeypress') && 
              !el.hasAttribute('onkeydown') && 
              !el.hasAttribute('onkeyup') &&
              !el.closest('button, a, input[type="button"], input[type="submit"]')) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Element nur mit Maus bedienbar'
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
            fullPage: true
          });
          error.screenshot = `screenshots/${filename}`;
        } catch (e) {
          console.warn(`Screenshot fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    }
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
            error: 'No main language (lang attribute) defined'
          });
        } else if (!validLangRegex.test(lang)) {
          errors.push({
            element: html.outerHTML.slice(0, 100),
            selector: 'html',
            error: `Invalid language code: ${lang}`
          });
        }
        return errors;
      });

      if (results.length > 0) {
        const filename = `error_3.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    }
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
          const hasName = control.hasAttribute('aria-label') || 
                         control.hasAttribute('aria-labelledby') ||
                         control.textContent.trim().length > 0;
          
          if (!hasName) {
            errors.push({
              element: control.outerHTML.slice(0, 100),
              selector: control.getAttribute('id') ? `#${control.id}` : control.tagName.toLowerCase(),
              error: `Custom Control without accessible name (role="${role}")`
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
            fullPage: true
          });
          error.screenshot = `screenshots/${filename}`;
        } catch (e) {
          console.warn(`Screenshot fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    }
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
            const isInteractive = el.tagName === 'A' || el.tagName === 'BUTTON' || 
                                el.hasAttribute('onclick') || el.getAttribute('role') === 'button';
            
            if (hasZIndex && isInteractive) {
              errors.push({
                element: el.outerHTML.slice(0, 100),
                selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
                error: 'Positioned interactive element could interfere with reading order'
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
          fullPage: true
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    }
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
          if (link.textContent.toLowerCase().includes('springe zu') ||
              link.textContent.toLowerCase().includes('zum inhalt')) {
            hasSkipLink = true;
            break;
          }
        }
        
        if (!hasSkipLink) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'No Skip-Link to main content found'
          });
        }
        
        const hasMain = document.querySelector('main, [role="main"]');
        const hasNav = document.querySelector('nav, [role="navigation"]');
        
        if (!hasMain) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'No main content area (main) defined'
          });
        }
        
        if (!hasNav) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'No navigation (nav) defined'
          });
        }
        
        return errors;
      });

      if (results.length > 0) {
        const filename = `error_2.4.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    }
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
            error: 'No document title present'
          });
        } else if (title.length < 5) {
          errors.push({
            element: document.head.outerHTML.slice(0, 100),
            selector: 'title',
            error: `Document title too short: "${title}"`
          });
        } else if (title.toLowerCase().includes('untitled') ||
                   title.toLowerCase().includes('new page')) {
          errors.push({
            element: document.head.outerHTML.slice(0, 100),
            selector: 'title',
            error: `Standard title not changed: "${title}"`
          });
        }
        
        return errors;
      });

      if (results.length > 0) {
        const filename = `error_2.4.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
        await page.screenshot({
          path: `screenshots/${filename}`,
          fullPage: true
        });
        results[0].screenshot = `screenshots/${filename}`;
      }
      return results;
    }
  },
  '1.4.4': {
    description: 'Text 200% Scalable',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      const normalSize = await page.evaluate(() => {
        const contentBox = document.body.getBoundingClientRect();
        return {
          width: contentBox.width,
          height: contentBox.height,
          overflow: window.getComputedStyle(document.body).overflow
        };
      });

      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
      const results = await page.evaluate((normalSize) => {
        const errors = [];
        const contentBox = document.body.getBoundingClientRect();
        const style = window.getComputedStyle(document.body);
        
        if (contentBox.width > normalSize.width * 1.1) {
          errors.push({
            element: document.body.outerHTML.slice(0, 100),
            selector: 'body',
            error: 'Horizontal scrolling required at 200% Zoom'
          });
        }
        
        const elements = document.querySelectorAll('p, div, span, a');
        for (const el of elements) {
          const elStyle = window.getComputedStyle(el);
          if (elStyle.overflow === 'hidden' && el.scrollWidth > el.clientWidth) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Text gets cut off at 200% Zoom'
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
            fullPage: true
          });
          error.screenshot = `screenshots/${filename}`;
        } catch (e) {
          console.warn(`Screenshot fehlgeschlagen: ${e.message}`);
        }
      }

      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
      return results;
    }
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
          if (form.getAttribute('role') === 'search' || 
              form.classList.contains('search') ||
              form.classList.contains('newsletter')) continue;
              
          const inputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
          
          for (const input of inputs) {
            const isRequired = input.hasAttribute('required');
            const hasValidation = input.hasAttribute('pattern') || 
                                input.hasAttribute('minlength') ||
                                input.hasAttribute('maxlength') ||
                                input.hasAttribute('min') ||
                                input.hasAttribute('max');
            
            if (isRequired && !hasValidation && !input.hasAttribute('aria-invalid')) {
              errors.push({
                element: input.outerHTML.slice(0, 100),
                selector: input.getAttribute('id') ? `#${input.id}` : input.tagName.toLowerCase(),
                error: 'Required field without validation attributes'
              });
            }
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 });
          const element = await page.$(error.selector);
          if (element) {
            const filename = `error_3.3.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await element.screenshot({
              path: `screenshots/${filename}`,
              type: 'png'
            });
            error.screenshot = `screenshots/${filename}`;
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    }
  },
  '3.3.2': {
    description: 'Form Element Labels',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.VERSTAENDLICH,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const results = await page.evaluate(() => {
        const errors = [];
        
        const formElements = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea');
        for (const el of formElements) {
          if (el.closest('form[role="search"]') || 
              el.closest('.search') ||
              el.closest('.newsletter')) continue;
              
          const hasLabel = el.labels?.length > 0;
          const hasAriaLabel = el.hasAttribute('aria-label');
          const hasAriaLabelledBy = el.hasAttribute('aria-labelledby');
          const hasTitle = el.hasAttribute('title');
          const hasPlaceholder = el.hasAttribute('placeholder');
          const isRequired = el.hasAttribute('required');
          
          if ((isRequired || el.type === 'email' || el.type === 'tel') && 
              !hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Important form element without label'
            });
          }
          
          if (isRequired && !hasLabel && !hasAriaLabel && !hasAriaLabelledBy && hasPlaceholder) {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              error: 'Required field uses only placeholder as label'
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
          await page.waitForSelector(error.selector, { visible: true, timeout: 5000 });
          const element = await page.$(error.selector);
          if (element) {
            const filename = `error_3.3.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await element.screenshot({
              path: `screenshots/${filename}`,
              type: 'png'
            });
            error.screenshot = `screenshots/${filename}`;
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    }
  }
};

const BITV_CHECK_CATEGORIES = {
  '1.1.1': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.2.3': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.2.5': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.3.1': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.3.1a': BITV_CATEGORIES.WAHRNEHMBAR,
  '1.4.3': BITV_CATEGORIES.WAHRNEHMBAR,
  '2.2.2': BITV_CATEGORIES.BEDIENBAR,
  '2.4.4': BITV_CATEGORIES.BEDIENBAR,
  '2.4.5': BITV_CATEGORIES.BEDIENBAR,
  '3.1.3': BITV_CATEGORIES.VERSTAENDLICH,
  '3.2.4': BITV_CATEGORIES.VERSTAENDLICH,
  '4.1.1': BITV_CATEGORIES.ROBUST
};

module.exports = {
  BITV_CHECKS,
  BITV_CHECK_CATEGORIES
};