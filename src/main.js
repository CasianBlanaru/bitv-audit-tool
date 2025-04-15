// src/main.js
const puppeteer = require('puppeteer');
const PdfReportGenerator = require('./report/PdfReportGenerator');
const { BITV_CHECKS } = require('./checks/bitvChecks');
const { extractColors } = require('./checks/colorExtractor');
const fs = require('node:fs').promises;
const path = require('node:path');

async function runAccessibilityTests(url) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const extractedColors = await extractColors(page);
    const results = {};
    for (const [checkId, check] of Object.entries(BITV_CHECKS)) {
      try {
        const errors = await check.check(page);
        results[checkId] = { errors: errors || [] };
      } catch (e) {
        console.warn(`Check ${checkId} failed:`, e.message);
        results[checkId] = { errors: [{ error: `Check failed: ${e.message}` }] };
      }
    }
    return { results, extractedColors };
  } catch (e) {
    console.error(`Error loading page ${url}:`, e.message);
    return { results: {}, extractedColors: {} };
  } finally {
    await browser.close();
  }
}

async function generateReport(url, outputDir = './reports') {
  try {
    const { results, extractedColors } = await runAccessibilityTests(url);
    if (!Object.keys(results).length) {
      console.error('No valid test results available');
      return;
    }

    await fs.mkdir(outputDir, { recursive: true });
    const filename = path.join(outputDir, `report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
    const generator = new PdfReportGenerator(url, results, extractedColors);
    await generator.generate(filename);

    console.log(`PDF report created: ${filename}`);
  } catch (error) {
    console.error('Error generating report:', error.message);
    throw error;
  }
}

module.exports = {
  runAccessibilityTests,
  generateReport
};

if (require.main === module) {
  generateReport('https://www.nordwestbahn.de').catch(console.error);
}