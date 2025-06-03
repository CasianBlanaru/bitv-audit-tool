import puppeteer from 'puppeteer';
import PdfReportGenerator from './report/PdfReportGenerator.js';
import { BITV_CHECKS } from './checks/bitvChecks.js';
import { extractColors } from './checks/colorExtractor.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';
import logger from './utils/logger.js';

// Load environment variables
config();

async function runAccessibilityTests(url) {
  logger.startSpinner('Browser wird gestartet...');
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    logger.startSpinner(`Lade Webseite: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    logger.success(`Webseite erfolgreich geladen: ${url}`);
    
    logger.startSpinner('Extrahiere Farben...');
    const extractedColors = await extractColors(page);
    logger.success(`${Object.keys(extractedColors).length} Farbinformationen extrahiert`);
    
    const results = {};
    const checkIds = Object.keys(BITV_CHECKS);
    let completedChecks = 0;
    
    logger.info(`Starte BITV-Prüfung mit ${checkIds.length} Kriterien...`);
    
    for (const [checkId, check] of Object.entries(BITV_CHECKS)) {
      try {
        logger.startSpinner(`Prüfe Kriterium ${checkId}: ${check.description}`);
        const errors = await check.check(page);
        results[checkId] = { errors: errors || [] };
        
        completedChecks++;
        const errorCount = errors ? errors.length : 0;
        
        if (errorCount === 0) {
          logger.success(`${checkId}: Keine Probleme gefunden`);
        } else {
          logger.warn(`${checkId}: ${errorCount} Problem(e) gefunden`);
        }
        
        // Show progress
        logger.progressBar(completedChecks, checkIds.length, `${completedChecks}/${checkIds.length} Kriterien geprüft`);
        
      } catch (e) {
        logger.error(`Kriterium ${checkId} fehlgeschlagen: ${e.message}`);
        results[checkId] = { errors: [{ error: `Check failed: ${e.message}` }] };
        completedChecks++;
        logger.progressBar(completedChecks, checkIds.length, `${completedChecks}/${checkIds.length} Kriterien geprüft`);
      }
    }
    
    return { results, extractedColors };
  } catch (e) {
    logger.error(`Fehler beim Laden der Seite ${url}: ${e.message}`);
    return { results: {}, extractedColors: {} };
  } finally {
    logger.startSpinner('Browser wird geschlossen...');
    await browser.close();
    logger.success('Browser erfolgreich geschlossen');
  }
}

async function generateReport(url, outputDir = './reports') {
  const startTime = Date.now();
  
  try {
    logger.header();
    logger.info(`Starte Barrierefreiheits-Audit für: ${url}`);
    
    const { results, extractedColors } = await runAccessibilityTests(url);
    
    if (!Object.keys(results).length) {
      logger.error('Keine gültigen Testergebnisse verfügbar');
      return;
    }

    logger.startSpinner('Erstelle Ausgabeordner...');
    await fs.mkdir(outputDir, { recursive: true });
    logger.success('Ausgabeordner erstellt');
    
    const filename = path.join(outputDir, `report-${new Date().toISOString().replace(/[:.]/g, '-')}.pdf`);
    
    logger.startSpinner('Generiere PDF-Report...');
    const generator = new PdfReportGenerator(url, results, extractedColors);
    await generator.generate(filename);
    
    const endTime = Date.now();
    const duration = `${((endTime - startTime) / 1000).toFixed(1)}s`;
    
    // Calculate statistics
    const totalChecks = Object.keys(results).length;
    const totalErrors = Object.values(results).reduce(
      (sum, result) => sum + (result.errors?.length || 0), 
      0
    );
    
    logger.success('PDF-Report erfolgreich generiert!');
    
    // Show summary
    logger.summary({
      totalChecks,
      totalErrors,
      duration,
      reportPath: filename
    });
    
  } catch (error) {
    logger.error(`Fehler bei der Report-Generierung: ${error.message}`);
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
    logger.error('TARGET_URL ist nicht in der .env Datei definiert');
    process.exit(1);
  }

  generateReport(url).catch((error) => {
    logger.error('Anwendung fehlgeschlagen');
    console.error(error);
    process.exit(1);
  });
}
