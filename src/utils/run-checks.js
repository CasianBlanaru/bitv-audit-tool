// run-checks.js
const puppeteer = require('puppeteer');
const fs = require('node:fs').promises;
const path = require('node:path');
const { BITV_CHECKS } = require('../checks/bitvChecks');

// Load environment variables
require('dotenv').config();

/**
 * Clean up screenshots directory
 */
async function cleanupScreenshots() {
  const screenshotsDir = path.join(process.cwd(), 'screenshots');
  try {
    const files = await fs.readdir(screenshotsDir);
    for (const file of files) {
      await fs.unlink(path.join(screenshotsDir, file));
    }
    console.log('Screenshots cleaned up successfully');
  } catch (error) {
    console.warn('Error cleaning up screenshots:', error.message);
  }
}

async function runChecks(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Set viewport to ensure proper rendering
    await page.setViewport({ width: 1920, height: 1080 });

    // Load page and wait for dynamic content
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // Run checks
    const results = {};
    let totalErrors = 0;
    let criticalErrors = 0;
    let highErrors = 0;
    let mediumErrors = 0;
    let lowErrors = 0;

    const categoryErrors = {
      Perceivable: 0,
      Operable: 0,
      Understandable: 0,
      Robust: 0,
    };

    for (const [checkId, check] of Object.entries(BITV_CHECKS)) {
      const checkResults = await check.check(page);
      results[checkId] = {
        description: check.description,
        severity: check.severity,
        category: check.category,
        errors: checkResults,
      };

      // Count errors by severity
      if (check.severity === 'CRITICAL') criticalErrors += checkResults.length;
      else if (check.severity === 'HIGH') highErrors += checkResults.length;
      else if (check.severity === 'MEDIUM') mediumErrors += checkResults.length;
      else if (check.severity === 'LOW') lowErrors += checkResults.length;

      totalErrors += checkResults.length;
      categoryErrors[check.category] += checkResults.length;
    }

    // New score calculation
    const totalChecks = Object.keys(BITV_CHECKS).length;
    const maxScore = 75; // Reduced from 85 as perfect accessibility is rare

    // Increased error points per category
    const errorPoints = {
      CRITICAL: 15,
      HIGH: 10,
      MEDIUM: 6,
      LOW: 3,
    };

    // Calculate deductions based on errors
    const deductions =
      criticalErrors * errorPoints.CRITICAL +
      highErrors * errorPoints.HIGH +
      mediumErrors * errorPoints.MEDIUM +
      lowErrors * errorPoints.LOW;

    // Calculate base score
    const baseScore = maxScore - deductions;

    // Keep score within bounds
    const weightedScore = Math.max(0, Math.min(maxScore, baseScore));

    const score = `${weightedScore.toFixed(1)}%`;
    const complianceStatus =
      weightedScore >= 80
        ? 'Largely compliant'
        : weightedScore >= 65
          ? 'Substantially compliant'
          : weightedScore >= 50
            ? 'Partially compliant'
            : 'Not compliant';

    // Create JSON structure
    const jsonOutput = {
      url: url,
      lastUpdated: new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }),
      testStandard: 'BITV 2.0 / EN 301 549',
      conformityWith: ['BITV 2.0', 'EN 301 549 V3.2.1 (2021-03)'],
      accessibilityScore: score,
      complianceStatus: complianceStatus,
      errorSummary: {
        critical: criticalErrors,
        high: highErrors,
        medium: mediumErrors,
        low: lowErrors,
        total: totalErrors,
        deductions: deductions.toFixed(1),
      },
      categories: [
        { name: 'Perceivable', errors: categoryErrors.Perceivable },
        { name: 'Operable', errors: categoryErrors.Operable },
        { name: 'Understandable', errors: categoryErrors.Understandable },
        { name: 'Robust', errors: categoryErrors.Robust },
      ],
      detailedResults: results,
    };

    // Save JSON to file
    const dataPath = path.join(process.cwd(), 'src', 'data', 'data.json');
    await fs.writeFile(dataPath, JSON.stringify(jsonOutput, null, 2));
    console.log('Checks completed, results saved to data.json');

    // Clean up screenshots after saving results
    await cleanupScreenshots();

    return jsonOutput;
  } catch (error) {
    console.error('Error running checks:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Get URL from environment variables
const url = process.env.TARGET_URL || 'http://localhost:3000';

if (!url) {
  console.error('Error: TARGET_URL is not defined in .env file');
  process.exit(1);
}

runChecks(url).catch((err) => {
  console.error('Error running checks:', err);
  process.exit(1);
});

module.exports = runChecks;
