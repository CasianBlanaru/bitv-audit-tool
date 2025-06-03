import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import runChecks from './run-checks.js';
import logger from './logger.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Simple HTTP server to host the website locally
const server = http.createServer((req, res) => {
  // Special handling for data.json
  if (req.url === '/data.json') {
    const dataPath = path.join(process.cwd(), 'src', 'data', 'data.json');
    fsPromises
      .readFile(dataPath)
      .then((content) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(content);
      })
      .catch((err) => {
        console.error(`Error loading data.json: ${err.message}`);
        res.writeHead(404);
        res.end('File not found');
      });
    return;
  }

  const filePath = path.join(process.cwd(), req.url === '/' ? 'index.html' : req.url);
  const extname = path.extname(filePath);
  const contentType =
    {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    }[extname] || 'text/plain';

  console.log(`Request for: ${req.url} -> ${filePath}`);

  fsPromises
    .readFile(filePath)
    .then((content) => {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    })
    .catch((err) => {
      console.error(`Error loading resource ${filePath}: ${err.message}`);
      res.writeHead(404);
      res.end('File not found');
    });
});

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generatePDF(url) {
  // Run checks and generate JSON
  await runChecks(url);

  // Start server
  const port = 8080;
  await new Promise((resolve, reject) => {
    server.listen(port, () => {
      logger.info(`Server läuft auf http://localhost:${port}`);
      resolve();
    });
    server.on('error', reject);
  });

  // Short delay to ensure server is fully started
  await delay(5000);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Increase timeout
    await page.setDefaultNavigationTimeout(180000); // 180 seconds

    // Monitor Puppeteer events
    page.on('console', (msg) => logger.info('Browser Log:', msg.text()));

    logger.startSpinner('Lade Website...');
    await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: 60000 });

    logger.startSpinner('Warte auf Inhalt...');
    await page.waitForFunction(
      () => {
        const content = document.querySelector('body');
        return content && content.innerText.trim().length > 0;
      },
      { timeout: 60000 }
    );

    await page.evaluate((testUrl) => {
      // Make all elements visible
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
          el.style.display = 'block';
          el.style.visibility = 'visible';
        }
      }

      // Set website information
      const websiteUrl = document.querySelector('.website-url');
      const websiteName = document.querySelector('.website-name');
      const testDate = document.querySelector('.test-date');

      if (websiteUrl && websiteName) {
        const url = new URL(testUrl);
        const domain = url.hostname.replace('www.', '');

        websiteUrl.textContent = testUrl;
        websiteName.textContent = domain.charAt(0).toUpperCase() + domain.slice(1);
      }

      // Set date in German format
      if (testDate) {
        const now = new Date();
        const options = {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        };
        testDate.textContent = now.toLocaleDateString('de-DE', options);
        console.log('Date set:', testDate.textContent); // Debug output
      } else {
        console.error('Element .test-date not found!'); // Debug output
      }
    }, url);

    await delay(2000);

    logger.startSpinner('Generiere PDF...');
    await page.pdf({
      path: path.join(process.cwd(), 'reports', 'bitv-report.pdf'),
      format: 'A4',
      margin: {
        top: '40px',
        bottom: '40px',
        left: '20px',
        right: '20px',
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
                <div style="font-size: 9pt; font-family: Arial, sans-serif;">
                </div>
            `,
      footerTemplate: `
                <div style="font-size: 9pt; font-family: Arial, sans-serif; width: 100%; padding: 10px 40px; text-align: center;">
                </div>
            `,
      preferCSSPageSize: false,
    });

    logger.stopSpinner();
    logger.success('PDF wurde erfolgreich generiert: reports/bitv-report.pdf');
  } catch (error) {
    logger.stopSpinner();
    logger.error(`Fehler beim Generieren der PDF: ${error.message}`);
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
}

// Create directory for PDF if it doesn't exist
const reportsDir = path.join(process.cwd(), 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir);
}

// Generate PDF
const url = process.env.TARGET_URL || 'https://www.netinera.de';

if (!url) {
  logger.error('Fehler: TARGET_URL ist nicht definiert');
  process.exit(1);
}

generatePDF(url).catch((err) => {
  logger.error(`Fehler beim Generieren der PDF: ${err.message}`);
  server.close();
  process.exit(1);
});
