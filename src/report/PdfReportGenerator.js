import { SEVERITY_LEVELS, BITV_CATEGORIES } from '../constants.js';
import { promises as fs, createWriteStream } from 'node:fs';
import path from 'node:path';
import { getContrastRatio } from '../utils/helpers.js';
import PDFDocument from 'pdfkit';

class PdfReportGenerator {
  constructor(url, results, extractedColors) {
    this.url = url;
    this.results = results;
    this.extractedColors = extractedColors;
    this.doc = new PDFDocument();
  }

  async generate(filename) {
    // Create output stream
    this.doc.pipe(createWriteStream(filename));

    // Generate report content
    this.addHeader();
    this.addSummary();
    this.addResults();
    this.addColorAnalysis();

    // Finalize the PDF
    this.doc.end();

    return filename;
  }

  addHeader() {
    this.doc
      .fontSize(20)
      .text('BITV Accessibility Audit Report', 50, 50)
      .fontSize(12)
      .text(`URL: ${this.url}`, 50, 80)
      .text(`Generated: ${new Date().toLocaleString()}`, 50, 100);
  }

  addSummary() {
    this.doc.addPage();
    this.doc.fontSize(16).text('Summary', 50, 50);

    const totalErrors = Object.values(this.results).reduce((sum, result) => sum + (result.errors?.length || 0), 0);

    this.doc.fontSize(12).text(`Total Issues Found: ${totalErrors}`, 50, 80);

    // Add severity breakdown
    const severityCount = {};
    Object.values(this.results).forEach((result) => {
      result.errors?.forEach((error) => {
        const severity = error.severity || 'UNKNOWN';
        severityCount[severity] = (severityCount[severity] || 0) + 1;
      });
    });

    let yPosition = 110;
    Object.entries(severityCount).forEach(([severity, count]) => {
      this.doc.text(`${severity}: ${count}`, 50, yPosition);
      yPosition += 20;
    });
  }

  addResults() {
    this.doc.addPage();
    this.doc.fontSize(16).text('Detailed Results', 50, 50);

    let yPosition = 80;
    Object.entries(this.results).forEach(([checkId, result]) => {
      if (result.errors?.length > 0) {
        this.doc.fontSize(14).text(`Check ${checkId}`, 50, yPosition);

        yPosition += 25;

        result.errors.forEach((error) => {
          this.doc.fontSize(10).text(`• ${error.error || error.message || 'Unknown error'}`, 60, yPosition);

          yPosition += 15;

          if (yPosition > 700) {
            this.doc.addPage();
            yPosition = 50;
          }
        });

        yPosition += 10;
      }
    });
  }

  addColorAnalysis() {
    if (!this.extractedColors || Object.keys(this.extractedColors).length === 0) {
      return;
    }

    this.doc.addPage();
    this.doc.fontSize(16).text('Color Analysis', 50, 50);

    let yPosition = 80;
    Object.entries(this.extractedColors).forEach(([element, colors]) => {
      this.doc.fontSize(12).text(`${element}:`, 50, yPosition);

      yPosition += 20;

      if (colors.background && colors.foreground) {
        const contrast = getContrastRatio(colors.foreground, colors.background);
        this.doc
          .fontSize(10)
          .text(`Foreground: ${colors.foreground}`, 60, yPosition)
          .text(`Background: ${colors.background}`, 60, yPosition + 15)
          .text(`Contrast Ratio: ${contrast.toFixed(2)}`, 60, yPosition + 30);

        yPosition += 60;
      }

      if (yPosition > 700) {
        this.doc.addPage();
        yPosition = 50;
      }
    });
  }
}

export default PdfReportGenerator;
