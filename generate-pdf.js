const puppeteer = require('puppeteer');
const http = require('node:http');
const fs = require('node:fs');
const fsPromises = require('node:fs').promises;
const path = require('node:path');
const runChecks = require('./run-checks');

// Einfacher HTTP-Server, um die Webseite lokal zu hosten
const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    const contentType = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
    }[extname] || 'text/plain';

    console.log(`Anfrage für: ${req.url} -> ${filePath}`);

    fsPromises.readFile(filePath)
        .then((content) => {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        })
        .catch((err) => {
            console.error(`Fehler beim Laden der Ressource ${filePath}: ${err.message}`);
            res.writeHead(404);
            res.end('File not found');
        });
});

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generatePDF(url) {
    // Prüfungen ausführen und JSON erzeugen
    await runChecks(url);

    // Server starten
    const port = 8080;
    await new Promise((resolve, reject) => {
        server.listen(port, () => {
            console.log(`Server läuft auf http://localhost:${port}`);
            resolve();
        });
        server.on('error', reject);
    });

    // Kurze Verzögerung, um sicherzustellen, dass der Server vollständig gestartet ist
    await delay(5000);

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // Timeout erhöhen
        await page.setDefaultNavigationTimeout(180000); // 180 Sekunden

        // Puppeteer-Events überwachen
        page.on('console', msg => console.log('Browser Log:', msg.text()));

        console.log('Lade Webseite...');
        await page.goto(`http://localhost:${port}`, { waitUntil: 'networkidle0', timeout: 60000 });

        console.log('Warte auf Inhalte...');
        await page.waitForFunction(() => {
            const content = document.querySelector('body');
            return content && content.innerText.trim().length > 0;
        }, { timeout: 60000 });

        await page.evaluate((testUrl) => {
            // Mache alle Elemente sichtbar
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    el.style.display = 'block';
                    el.style.visibility = 'visible';
                }
            }

            // Setze Website-Informationen
            const websiteUrl = document.querySelector('.website-url');
            const websiteName = document.querySelector('.website-name');
            const testDate = document.querySelector('.test-date');
            
            if (websiteUrl && websiteName) {
                const url = new URL(testUrl);
                const domain = url.hostname.replace('www.', '');
                
                websiteUrl.textContent = testUrl;
                websiteName.textContent = domain.charAt(0).toUpperCase() + domain.slice(1);
            }

            // Setze das Datum im deutschen Format
            if (testDate) {
                const now = new Date();
                                            const options = { 
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                };
                testDate.textContent = now.toLocaleDateString('de-DE', options);
                console.log('Datum gesetzt:', testDate.textContent); // Debug-Ausgabe
            } else {
                console.error('Element .test-date nicht gefunden!'); // Debug-Ausgabe
            }
        }, url);

        await delay(2000);

        console.log('Generiere PDF...');
        await page.pdf({
            path: 'reports/bitv-report.pdf',
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
            preferCSSPageSize: false
        });

        console.log('PDF wurde erfolgreich generiert: reports/bitv-report.pdf');
    } catch (error) {
        console.error('Fehler beim Generieren der PDF:', error);
        throw error;
    } finally {
        await browser.close();
        server.close();
    }
}

// Verzeichnis für das PDF erstellen, falls es nicht existiert
if (!fs.existsSync('reports')) {
    fs.mkdirSync('reports');
}

// PDF generieren
const url = process.argv[2] || 'https://www.nordwestbahn.de';
generatePDF(url).catch(err => {
    console.error('Fehler beim Generieren der PDF:', err);
    server.close();
    process.exit(1);
});