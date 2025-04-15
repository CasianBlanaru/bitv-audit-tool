const { extractColors } = require('./checks/colorExtractor');

async function runAccessibilityCheck(url) {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    // Extract colors from the website
    const extractedColors = await extractColors(page);
    console.log('Extracted colors:', extractedColors);

    // Run the checks
    const results = {};
    for (const [checkId, check] of Object.entries(BITV_CHECKS)) {
      results[checkId] = await runCheck(page, check);
    }

    // Generate report with extracted colors
    const pdfGenerator = new PdfReportGenerator(url, results, extractedColors);
    await pdfGenerator.generate('accessibility-report.pdf');

    await browser.close();
    return results;
  } catch (error) {
    console.error('Error running accessibility check:', error);
    throw error;
  }
}
