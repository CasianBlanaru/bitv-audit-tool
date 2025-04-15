// Styles für den PDF-Report
module.exports = {
  colors: {
    primary: '#333333',
    secondary: '#666666',
    text: '#333333',
    error: '#DC3545',
    success: '#28A745',
    // Tabellenfarben
    table: {
      header: '#004e94',
      row: '#F5F7FA',
      code: '#000000'
    },
    cards: {
      background: '#F8F0FC',
      border: '#E6E6E6',
      footer: '#4A148C',
      passed: '#28A745',  // Grün für "Passed"
      failed: '#DC3545',  // Rot für "Failed"
      text: {
        title: '#121111',
        stats: '#666666'
      }
    }
  },
  fonts: {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique'
  }
};