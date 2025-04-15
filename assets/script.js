let gaugeChart = null;
let categoryChart = null;

function createGaugeChart(score) {
    if (gaugeChart) {
        gaugeChart.destroy();
    }

    const ctx = document.getElementById('gaugeChart').getContext('2d');
    gaugeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [
                    score >= 90 ? '#28a745' : score >= 70 ? '#ffc107' : '#dc3545',
                    '#e9ecef'
                ],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
        }
    });
}

function createCategoryChart(categories) {
    if (categoryChart) {
        categoryChart.destroy();
    }

    const ctx = document.getElementById('categoryChart').getContext('2d');
    const categoryColors = {
        'Wahrnehmbar': '#0066cc',
        'Bedienbar': '#28a745',
        'Verständlich': '#ffc107',
        'Robust': '#6f42c1'
    };

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categories.map(cat => cat.name),
            datasets: [{
                data: categories.map(cat => cat.errors),
                backgroundColor: categories.map(cat => categoryColors[cat.name] || '#666666'),
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        font: {
                            size: 12
                        },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            return data.labels.map((label, i) => ({
                                text: `${label} (${data.datasets[0].data[i]} Fehler)`,
                                fillStyle: data.datasets[0].backgroundColor[i],
                                strokeStyle: data.datasets[0].borderColor,
                                lineWidth: data.datasets[0].borderWidth,
                                hidden: false
                            }));
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.raw || 0;
                            return `${label}: ${value} Fehler`;
                        }
                    }
                }
            }
        }
    });
}

function formatCode(codeString) {
    if (!codeString) return '';
    
    // Bereinige den Code-String
    let cleanCode = codeString
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    // Füge Syntax-Highlighting hinzu
    return cleanCode
        .replace(/(&lt;[^&]+&gt;)/g, '<span class="code-tag">$1</span>')
        .replace(/(\s[a-zA-Z-]+)="([^"]+)"/g, '<span class="code-attribute">$1</span>="<span class="code-string">$2</span>"');
}

function generateErrorTable(data) {
    const errorList = document.querySelector('#error-table .error-list');
    errorList.innerHTML = '';
    
    // Gruppiere Fehler nach checkId
    const errorGroups = {};
    for (const [checkId, check] of Object.entries(data.detailedResults)) {
        if (check.errors && check.errors.length > 0) {
            if (!errorGroups[checkId]) {
                errorGroups[checkId] = {
                    checkId,
                    description: check.description,
                    errors: []
                };
            }
            errorGroups[checkId].errors.push(...check.errors);
        }
    }

    // Wenn keine Fehler gefunden wurden
    if (Object.keys(errorGroups).length === 0) {
        errorList.innerHTML = `
            <div class="no-errors">
                <div class="success-message">
                    <iconify-icon icon="mdi:check-circle"></iconify-icon>
                    <span>Keine Fehler gefunden</span>
                </div>
            </div>
        `;
        return;
    }

    // Generiere Fehlerboxen
    for (const group of Object.values(errorGroups)) {
        const errorDiv = document.createElement('div');
        errorDiv.classList.add('error-overview-item');
        
        const baseContent = `
            <div class="check-title">
                <span class="check-id">${group.checkId}</span>
                <h3>${group.description}</h3>
            </div>
            <div class="check-ref">BITV 2.0: ${group.checkId} | EN 301 549: ${group.checkId}</div>
        `;

        // Fehler-Details
        const errorDetails = group.errors.map(error => {
            const warning = `
                <div class="error-warning">
                    <iconify-icon icon="mdi:alert"></iconify-icon>
                    <span>${error.error}</span>
                </div>
            `;

            const code = error.element ? `
                <div class="error-details">
                    <code>${formatCode(error.element)}</code>
                </div>
            ` : '';

            const colorInfo = (error.fgColor || error.bgColor) ? `
                <div class="error-details color-info">
                    ${error.text ? `<div class="error-text">${error.text}</div>` : ''}
                    ${error.fgColor ? `<div>Textfarbe: ${error.fgColor}</div>` : ''}
                    ${error.bgColor ? `<div>Hintergrundfarbe: ${error.bgColor}</div>` : ''}
                </div>
            ` : '';

            return warning + code + colorInfo;
        }).join('');

        errorDiv.innerHTML = baseContent + errorDetails;
        errorList.appendChild(errorDiv);
    }
}

async function loadReportData() {
    try {
        const response = await fetch('data.json');
        const data = await response.json();

        // Update score and charts
        const score = Number.parseFloat(data.accessibilityScore);
        createGaugeChart(score);
        createCategoryChart(data.categories);

        // Update text elements
        document.querySelector('.score').textContent = `${score}%`;
        document.querySelector('.status').textContent = data.complianceStatus;
        document.querySelector('.status').style.color = score >= 90 ? '#28a745' : score >= 70 ? '#ffc107' : '#dc3545';

        // Update statistics
        document.querySelector('.steps').textContent = Object.keys(data.detailedResults).length;
        const totalErrors = Object.values(data.detailedResults)
            .reduce((sum, check) => sum + check.errors.length, 0);
        document.querySelector('.errors').textContent = totalErrors;
        
        const failedSteps = Object.values(data.detailedResults)
            .filter(check => check.errors.length > 0).length;
        document.querySelector('.failed-steps').textContent = failedSteps;

        // Update error overview
        generateErrorTable(data);

        // Update detailed results
        const detailedCategories = document.getElementById('detailed-categories');
        if (detailedCategories) {
            generateDetailedResults(detailedCategories, data);
        } else {
            console.warn('Element "detailed-categories" nicht gefunden');
        }

        // Update category cards
        const categoryCards = document.querySelector('.karten-container');
        if (categoryCards) {
            categoryCards.innerHTML = '';
            for (const cat of data.categories) {
                const card = document.createElement('div');
                card.className = 'karte';
                card.setAttribute('data-category', cat.name);
                card.innerHTML = `
                    <strong>${cat.name}</strong>
                    <span>${cat.errors} Fehler</span>
                `;
                categoryCards.appendChild(card);
            }
        }

        // Update date in header
        const dateElement = document.querySelector('.test-date');
        if (dateElement) {
            dateElement.textContent = data.lastUpdated;
        }
    } catch (error) {
        console.error('Fehler beim Laden der Daten:', error);
    }
}

function getCategoryIcon(category) {
    const icons = {
        'Wahrnehmbar': 'mdi:eye',
        'Bedienbar': 'mdi:cursor-default',
        'Verständlich': 'mdi:book-open-variant',
        'Robust': 'mdi:shield-check'
    };
    return icons[category] || 'mdi:checkbox-marked-circle';
}

function generateDetailedResults(detailedCategories, data) {
    detailedCategories.innerHTML = '';
    const categories = {};
    
    // Gruppiere Prüfungen nach Kategorie
    for (const [checkId, check] of Object.entries(data.detailedResults)) {
        if (!categories[check.category]) {
            categories[check.category] = [];
        }
        categories[check.category].push({
            id: checkId,
            ...check
        });
    }

    // Erstelle Kategorieabschnitte
    for (const [category, checks] of Object.entries(categories)) {
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('category-section');
        
        categoryDiv.innerHTML = `
            <div class="category-header">
                <iconify-icon icon="${getCategoryIcon(category)}" class="category-icon"></iconify-icon>
                <h2>${category}</h2>
            </div>
            <div class="check-list">
                ${checks.map(check => `
                    <div class="check-item ${check.errors.length ? 'has-error' : ''}">
                        <div class="check-title">
                            <span class="check-id">${check.id}</span>
                            <h3>${check.description}</h3>
                        </div>
                        <div class="check-ref">BITV 2.0: ${check.id} | EN 301 549: ${check.id}</div>
                        ${check.errors.length === 0 
                            ? `<div class="check-status passed">
                                <iconify-icon icon="mdi:check-circle" style="color: #28a745;"></iconify-icon>
                                <span>Bestanden</span>
                                <span class="check-message">Keine Fehler gefunden</span>
                               </div>`
                            : `<div class="check-status failed">
                                <iconify-icon icon="mdi:close-circle"></iconify-icon>
                                <span>Nicht bestanden</span>
                               </div>
                               ${check.errors.map(error => `
                                   <div class="error-details">
                                       <div class="error-message">
                                           <iconify-icon icon="mdi:alert"></iconify-icon>
                                           <span>${error.error}</span>
                                       </div>
                                       ${error.element ? `
                                           <div class="code-example">
                                               <code>${error.element}</code>
                                           </div>
                                       ` : ''}
                                   </div>
                               `).join('')}`
                        }
                    </div>
                `).join('')}
            </div>
        `;
        
        detailedCategories.appendChild(categoryDiv);
    }
}

function setTestDate() {
    const testDateElements = document.querySelectorAll('.test-date');
    const now = new Date();
    const options = { 
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    };
    const formattedDate = now.toLocaleDateString('de-DE', options);
    
    for (const element of testDateElements) {
        element.textContent = formattedDate;
    }
}

async function initializeReport() {
    try {
        // Warte auf DOM-Elemente
        const detailedCategories = document.getElementById('detailed-categories');
        const errorTable = document.getElementById('error-table');
        const categoryCards = document.querySelector('.karten-container');
        const gaugeElement = document.getElementById('gaugeChart');
        const categoryChartElement = document.getElementById('categoryChart');

        // Überprüfe notwendige Elemente
        if (!detailedCategories) {
            console.warn('Element "detailed-categories" nicht im DOM gefunden');
        }
        if (!errorTable) {
            console.warn('Element "error-table" nicht im DOM gefunden');
        }
        if (!categoryCards) {
            console.warn('Element "karten-container" nicht im DOM gefunden');
        }
        if (!gaugeElement) {
            console.warn('Element "gaugeChart" nicht im DOM gefunden');
        }
        if (!categoryChartElement) {
            console.warn('Element "categoryChart" nicht im DOM gefunden');
        }

        // Setze Testdatum
        setTestDate();

        // Lade Berichtsdaten
        await loadReportData();
    } catch (error) {
        console.error('Fehler bei der Initialisierung:', error);
    }
}

// Warte auf vollständiges Laden des DOMs
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeReport);
} else {
    initializeReport();
}