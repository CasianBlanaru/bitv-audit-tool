// src/checks/bitvChecks.js
const { SEVERITY_LEVELS, BITV_CATEGORIES } = require('../constants');
const fs = require('node:fs').promises;
const path = require('node:path');
const { getContrastRatio } = require('../utils/helpers');

const BITV_CHECKS = {
  '1.1.1': {
    description: 'Nicht-textueller Inhalt (Alternativtexte)',
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
            alt.match(/^(Bild|Grafik|img\d+\.\w+)$/i) || (!isDecorative && (alt.length < 5 || alt.length > 150));
          if (!isDecorative && alt === '') {
            errors.push({
              src: img.src,
              selector: img.getAttribute('id') ? `#${img.id}` : `img[src="${img.src.replace(/"/g, '')}"]`,
              error: 'Fehlender Alternativtext',
            });
          } else if (isSuspicious && !isDecorative) {
            errors.push({
              src: img.src,
              selector: img.getAttribute('id') ? `#${img.id}` : `img[src="${img.src.replace(/"/g, '')}"]`,
              error: `Verdächtiger Alternativtext: "${alt}"`,
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
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
              !rect ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height)
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_1.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            console.log(
              `Kein Screenshot für ${error.selector} erstellt: BoundingBox ungültig oder Element nicht sichtbar.`
            );
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
  // Die folgenden Prüfungen (1.2.3, 1.2.5, 1.3.1, etc.) müssen ähnlich angepasst werden
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
    description: 'Info und Beziehungen',
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
              error: 'Keine programmatisch ermittelbare Beschriftung',
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
              error: `Übersprungene Überschriftenebene: H${lastLevel} zu H${level}`,
            });
          }
          lastLevel = level;
        }
        return errors;
      });

      for (const error of results) {
        try {
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
              !rect ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height)
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_1.3.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            console.log(
              `Kein Screenshot für ${error.selector} erstellt: BoundingBox ungültig oder Element nicht sichtbar.`
            );
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
  '1.3.1a': {
    description: 'Info und Beziehungen (Überschriftenstruktur)',
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
              error: `Übersprungene Überschriftenebene: H${lastLevel} zu H${level}`,
            });
          }
          lastLevel = level;
        }
        return errors;
      });

      for (const error of results) {
        try {
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
              !rect ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height)
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_1.3.1a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            console.log(
              `Kein Screenshot für ${error.selector} erstellt: BoundingBox ungültig oder Element nicht sichtbar.`
            );
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
  '1.4.3': {
    description: 'Kontrast (Minimum)',
    severity: SEVERITY_LEVELS.HIGH,
    category: BITV_CATEGORIES.WAHRNEHMBAR,
    check: async (page) => {
      await fs.mkdir('screenshots', { recursive: true });
      const colors = await require('./colorExtractor').extractColors(page);
      const results = await page.evaluate(() => {
        const errors = [];
        const elements = document.querySelectorAll('p, span, a, div');
        for (const el of elements) {
          const style = window.getComputedStyle(el);
          const fgColor = style.color;
          const bgColor = style.backgroundColor;
          const text = el.textContent.trim().slice(0, 50);
          if (fgColor && bgColor && text && bgColor !== 'rgba(0, 0, 0, 0)') {
            errors.push({
              element: el.outerHTML.slice(0, 100),
              selector: el.getAttribute('id') ? `#${el.id}` : el.tagName.toLowerCase(),
              text,
              fgColor,
              bgColor,
            });
          }
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
          const isLarge =
            fontSize >= 18 ||
            (fontSize >= 14 &&
              (await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el ? Number.parseFloat(window.getComputedStyle(el).fontWeight) >= 700 : false;
              }, item.selector)));
          const required = isLarge ? 3 : 4.5;
          if (contrastRatio < required) {
            errors.push({
              element: item.element,
              text: item.text,
              selector: item.selector,
              error: `Kontrast zu niedrig: ${contrastRatio.toFixed(2)} < ${required}`,
              fgColor: item.fgColor,
              bgColor: item.bgColor,
            });
          }
        } catch (e) {
          console.warn(`Kontrastberechnung für ${item.selector} fehlgeschlagen: ${e.message}`);
        }
      }

      for (const error of errors) {
        try {
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
              !rect ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height)
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_1.4.3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            console.log(
              `Kein Screenshot für ${error.selector} erstellt: BoundingBox ungültig oder Element nicht sichtbar.`
            );
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
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
              !rect ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height)
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_2.2.2_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            console.log(
              `Kein Screenshot für ${error.selector} erstellt: BoundingBox ungültig oder Element nicht sichtbar.`
            );
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
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
              !rect ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height)
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_2.4.4_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            console.log(
              `Kein Screenshot für ${error.selector} erstellt: BoundingBox ungültig oder Element nicht sichtbar.`
            );
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
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
              error: `Inkonsistente Bezeichnung: "${text}" führt zu mehreren Zielen`,
            });
          }
        }
        return errors;
      });
      return results;
    },
  },
  '4.1.1': {
    description: 'Parsen',
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
              error: `Dupliziertes ID-Attribut: ${id}`,
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
              error: 'Ungültige Kindelemente in Button',
            });
          }
        }
        return errors;
      });

      for (const error of results) {
        try {
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
              !rect ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              Number.isNaN(rect.x) ||
              Number.isNaN(rect.y) ||
              Number.isNaN(rect.width) ||
              Number.isNaN(rect.height)
            ) {
              console.log(`Invalid BoundingBox for ${sel}:`, rect);
              return null;
            }
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
          }, error.selector);

          if (boundingBox) {
            const filename = `error_4.1.1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;
            await page.screenshot({ path: `screenshots/${filename}`, clip: boundingBox });
            error.screenshot = `screenshots/${filename}`;
          } else {
            console.log(
              `Kein Screenshot für ${error.selector} erstellt: BoundingBox ungültig oder Element nicht sichtbar.`
            );
          }
        } catch (e) {
          console.warn(`Screenshot für ${error.selector} fehlgeschlagen: ${e.message}`);
        }
      }
      return results;
    },
  },
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
  '4.1.1': BITV_CATEGORIES.ROBUST,
};

module.exports = {
  BITV_CHECKS,
  BITV_CHECK_CATEGORIES,
};
