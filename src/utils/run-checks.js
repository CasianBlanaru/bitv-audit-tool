// run-checks.js
import puppeteer from 'puppeteer';
import { BITV_CHECKS } from '../checks/bitvChecks.js';
import helpers from './helpers.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';

/**
 * Main function to run accessibility checks on a given URL
 * Uses Puppeteer to analyze the page and generate a detailed accessibility report
 * @param {string} url - The URL to check for accessibility
 * @returns {Promise<Object>} JSON report with detailed accessibility analysis
 */
export default async function runChecks(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Set viewport size for consistent testing
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    // Initialize results storage
    const results = {};
    let totalErrors = 0;
    let criticalErrors = 0;
    let highErrors = 0;
    let mediumErrors = 0;
    let lowErrors = 0;

    // Track errors by WCAG category
    const categoryErrors = {
      Perceivable: 0,
      Operable: 0,
      Understandable: 0,
      Robust: 0,
    };

    // Run each accessibility check
    for (const [checkId, check] of Object.entries(BITV_CHECKS)) {
      const checkResults = await check.check(page);
      results[checkId] = {
        description: check.description,
        severity: check.severity,
        category: check.category,
        fixableByWidget: check.fixableByWidget,
        fixSuggestion: check.fixSuggestion,
        errors: checkResults.map((error) => ({
          ...error,
          manualCheckRequired: error.manualCheckRequired || null,
        })),
      };

      // Count errors by severity
      if (check.severity === 'CRITICAL') criticalErrors += checkResults.length;
      else if (check.severity === 'HIGH') highErrors += checkResults.length;
      else if (check.severity === 'MEDIUM') mediumErrors += checkResults.length;
      else if (check.severity === 'LOW') lowErrors += checkResults.length;

      // Update total and category error counts
      totalErrors += checkResults.length;
      categoryErrors[check.category] += checkResults.length;
    }

    // Calculate accessibility score
    const totalChecks = Object.keys(BITV_CHECKS).length;
    const maxScore = 75;
    const errorPoints = {
      CRITICAL: 15,
      HIGH: 10,
      MEDIUM: 6,
      LOW: 3,
    };

    // Calculate score deductions based on error severity
    const deductions =
      criticalErrors * errorPoints.CRITICAL +
      highErrors * errorPoints.HIGH +
      mediumErrors * errorPoints.MEDIUM +
      lowErrors * errorPoints.LOW;

    // Calculate final weighted score (capped between 0 and maxScore)
    const baseScore = maxScore - deductions;
    const weightedScore = Math.max(0, Math.min(maxScore, baseScore));
    const score = `${weightedScore.toFixed(1)}%`;

    // Determine compliance status based on weighted score
    const complianceStatus =
      weightedScore >= 80
        ? 'Largely compliant'
        : weightedScore >= 65
          ? 'Substantially compliant'
          : weightedScore >= 50
            ? 'Partially compliant'
            : 'Not compliant';

    // Prepare final JSON output
    const jsonOutput = {
      url: url,
      lastUpdated: new Date().toLocaleDateString('de-DE', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }),
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

    // Save results to data.json file
    const dataPath = path.join(process.cwd(), 'src', 'data', 'data.json');
    await fs.writeFile(dataPath, JSON.stringify(jsonOutput, null, 2));
    console.log('Accessibility check completed, results saved to data.json');

    // Clean up any temporary screenshot files
    await helpers.cleanupScreenshots();

    return jsonOutput;
  } catch (error) {
    console.error('Error running accessibility checks:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
