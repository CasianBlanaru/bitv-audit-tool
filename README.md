# BITV Audit Tool

An automated accessibility testing tool for web applications, specifically designed to check compliance with BITV 2.0 (Barrierefreie-Informationstechnik-Verordnung) and EN 301 549 standards.

## Features

- Automated accessibility checks based on BITV 2.0 and EN 301 549 criteria
- Comprehensive PDF report generation
- Visual evidence capture through screenshots
- Contrast ratio analysis
- Structured error categorization
- Weighted scoring system
- Multi-language support

## Technical Details

- Built with Node.js and Puppeteer
- PDF report generation
- Screenshot capabilities
- Color contrast analysis
- DOM structure validation
- ARIA attributes verification

## Installation

```bash
yarn install
```

## Usage

```bash
node node src/utils/generate-pdf.js 
```

The tool will:
1. Perform accessibility checks
2. Generate detailed JSON report
3. Create PDF documentation
4. Save screenshots of identified issues

## Output

- Detailed JSON report (`data.json`)
- PDF report (`reports/bitv-report.pdf`)
- Screenshots of accessibility issues
- Compliance score and status

## Categories

Checks are organized into four main categories:
- Perceivable
- Operable
- Understandable
- Robust

## Severity Levels

Issues are classified into:
- Critical
- High
- Medium
- Low

## License

MIT License

## Contributing

Contributions are welcome. Please open an issue first to discuss proposed changes. 