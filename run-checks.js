// run-checks.js
const puppeteer = require('puppeteer');
const fs = require('node:fs').promises;
const { BITV_CHECKS } = require('./src/checks/bitvChecks');

async function runChecks(url) {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Viewport setzen, um sicherzustellen, dass alle Elemente korrekt gerendert werden
        await page.setViewport({ width: 1920, height: 1080 });

        // Seite laden und auf dynamische Inhalte warten
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });


        // Prüfungen ausführen
        const results = {};
        let totalErrors = 0;
        let criticalErrors = 0;
        let highErrors = 0;
        let mediumErrors = 0;
        let lowErrors = 0;
        
        const categoryErrors = {
            Wahrnehmbar: 0,
            Bedienbar: 0,
            Verständlich: 0,
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
            
            // Fehler nach Schweregrad zählen
            if (check.severity === 'CRITICAL') criticalErrors += checkResults.length;
            else if (check.severity === 'HIGH') highErrors += checkResults.length;
            else if (check.severity === 'MEDIUM') mediumErrors += checkResults.length;
            else if (check.severity === 'LOW') lowErrors += checkResults.length;
            
            totalErrors += checkResults.length;
            categoryErrors[check.category] += checkResults.length;
        }

        // Neue Score-Berechnung
        const totalChecks = Object.keys(BITV_CHECKS).length;
        const maxScore = 75; // Reduziert von 85, da perfekte Barrierefreiheit sehr selten ist
        
        // Erhöhte Fehlerpunkte pro Kategorie
        const errorPoints = {
            CRITICAL: 15,  // War 12
            HIGH: 10,      // War 8
            MEDIUM: 6,     // War 4
            LOW: 3         // War 2
        };
        
        // Berechne Abzüge basierend auf Fehlern
        const deductions = (
            (criticalErrors * errorPoints.CRITICAL) +
            (highErrors * errorPoints.HIGH) +
            (mediumErrors * errorPoints.MEDIUM) +
            (lowErrors * errorPoints.LOW)
        );
        
        // Basis-Score berechnen
        const baseScore = maxScore - deductions;
        
        // Score-Grenzen einhalten
        const weightedScore = Math.max(0, Math.min(maxScore, baseScore));
        
        const score = `${weightedScore.toFixed(1)}%`;
        const complianceStatus = weightedScore >= 80 ? 'Weitgehend konform' :
                               weightedScore >= 65 ? 'Überwiegend konform' :
                               weightedScore >= 50 ? 'Teilweise konform' :
                               'Nicht konform';

        // JSON-Struktur erstellen
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
                deductions: deductions.toFixed(1)
            },
            categories: [
                { name: 'Wahrnehmbar', errors: categoryErrors.Wahrnehmbar },
                { name: 'Bedienbar', errors: categoryErrors.Bedienbar },
                { name: 'Verständlich', errors: categoryErrors.Verständlich },
                { name: 'Robust', errors: categoryErrors.Robust },
            ],
            detailedResults: results,
        };

        // JSON in Datei speichern
        await fs.writeFile('data.json', JSON.stringify(jsonOutput, null, 2));
        console.log('Prüfungen abgeschlossen, Ergebnisse in data.json gespeichert.');

        return jsonOutput;
    } catch (error) {
        console.error('Fehler beim Ausführen der Prüfungen:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

// Beispiel-URL (anpassen)
const url = 'https://www.nordwestbahn.de';
runChecks(url).catch(err => process.exit(1));

module.exports = runChecks;