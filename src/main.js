import puppeteer from 'puppeteer';
import PdfReportGenerator from './report/PdfReportGenerator.js';
import { BITV_CHECKS } from './checks/bitvChecks.js';
import { extractColors } from './checks/colorExtractor.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

// Load environment variables
config();

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

export {
  runAccessibilityTests,
  generateReport,
};

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.TARGET_URL || 'http://localhost:3000';

  if (!url) {
    console.error('Error: TARGET_URL is not defined in .env file');
    process.exit(1);
  }

  generateReport(url).catch(console.error);
}
