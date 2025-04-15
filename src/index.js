const { extractColors } = require('./checks/colorExtractor');

async function runAccessibilityCheck(url) {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);

    // Extrahiere die Farben von der Website
    const extractedColors = await extractColors(page);
    console.log('Extrahierte Farben:', extractedColors);

    // Führe die Checks durch
    const results = {};
    for (const [checkId, check] of Object.entries(BITV_CHECKS)) {
      results[checkId] = await runCheck(page, check);
    }

    // Generiere den Report mit den extrahierten Farben
    const pdfGenerator = new PdfReportGenerator(url, results, extractedColors);
    await pdfGenerator.generate('accessibility-report.pdf');

    await browser.close();
    return results;
  } catch (error) {
    console.error('Fehler beim Ausführen der Barrierefreiheitsprüfung:', error);
    throw error;
  }
} 