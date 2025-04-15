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
                    score >= 90 ? '#28a745' : '#dc3545',
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
    return codeString
        .replace(/(<[^>]+>)/g, '<span class="code-tag">$1</span>')
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
        const noErrorsDiv = document.createElement('div');
        noErrorsDiv.classList.add('no-errors');
        noErrorsDiv.innerHTML = `
            <div class="success-message">
                <iconify-icon icon="mdi:check-circle"></iconify-icon>
                <span>Keine Fehler gefunden</span>
            </div>
        `;
        errorList.appendChild(noErrorsDiv);
        return;
    }

    // Generiere Fehlerboxen
    for (const group of Object.values(errorGroups)) {
        const errorDiv = document.createElement('div');
        errorDiv.classList.add('error-overview-item');
        errorDiv.innerHTML = `
            <div class="check-title">
                <span class="check-id">${group.checkId}</span>
                <h3>${group.description}</h3>
            </div>
            <div class="check-ref">BITV 2.0: ${group.checkId} | EN 301 549: ${group.checkId}</div>
            ${group.errors.map(error => {
                if (error.error.includes('Kontrast zu niedrig')) {
                    return `
                        <div class="error-warning">
                            <iconify-icon icon="mdi:alert"></iconify-icon>
                            <span>${error.error}</span>
                        </div>
                        <div class="error-details">
                            ${error.text ? `<div class="contrast-text">
                                <iconify-icon icon="mdi:triangle"></iconify-icon>
                                <span>Text: "${error.text}"</span>
                            </div>` : ''}
                            ${error.fgColor ? `<div class="contrast-warning">
                                <iconify-icon icon="mdi:triangle"></iconify-icon>
                                <span>Textfarbe: ${error.fgColor}</span>
                            </div>` : ''}
                            ${error.bgColor ? `<div class="contrast-warning">
                                <iconify-icon icon="mdi:triangle"></iconify-icon>
                                <span>Hintergrundfarbe: ${error.bgColor}</span>
                            </div>` : ''}
                        </div>
                    `;
                }
                
                if (error.error.includes('Ungültige Kindelemente in Button')) {
                    return `
                        <div class="error-warning">
                            <iconify-icon icon="mdi:alert"></iconify-icon>
                            <span>${error.error}</span>
                        </div>
                        <div class="error-details">
                            <button class="button-example">
                                <iconify-icon icon="mdi:menu"></iconify-icon>
                                <span>Menü öffnen</span>
                            </button>
                            <div class="contrast-warning">
                                <iconify-icon icon="mdi:triangle"></iconify-icon>
                                <span>Ungültige Kindelemente in Button</span>
                            </div>
                        </div>
                    `;
                }

                return `
                    <div class="error-warning">
                        <iconify-icon icon="mdi:alert"></iconify-icon>
                        <span>${error.error}</span>
                    </div>
                    ${error.element ? `
                        <div class="error-details">
                            <code>${formatCode(error.element)}</code>
                        </div>
                    ` : ''}
                `;
            }).join('')}
        `;
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
        document.querySelector('.status').style.color = score >= 90 ? '#28a745' : '#dc3545';

        // Update statistics
        document.querySelector('.steps').textContent = Object.keys(data.detailedResults).length;
        
        // Berechne die tatsächliche Anzahl der Fehler
        let totalErrors = 0;
        for (const checkResult of Object.values(data.detailedResults)) {
            if (checkResult.errors) {
                totalErrors += checkResult.errors.length;
            }
        }
        document.querySelector('.errors').textContent = totalErrors;
        
        // Zähle die Prüfschritte mit Fehlern
        const failedSteps = Object.values(data.detailedResults)
            .filter(check => check.errors && check.errors.length > 0).length;
        document.querySelector('.failed-steps').textContent = failedSteps;

        // Update categories with actual error counts
        const categoryCards = document.getElementById('category-cards');
        categoryCards.innerHTML = '';
        
        // Berechne die tatsächlichen Fehler pro Kategorie
        const categoryErrors = {};
        for (const [_, check] of Object.entries(data.detailedResults)) {
            if (!categoryErrors[check.category]) {
                categoryErrors[check.category] = 0;
            }
            if (check.errors) {
                categoryErrors[check.category] += check.errors.length;
            }
        }
        
        // Aktualisiere die Kategorie-Karten mit den tatsächlichen Fehlerzahlen
        for (const category of Object.keys(categoryErrors)) {
            const card = document.createElement('div');
            card.classList.add('karte');
            card.setAttribute('data-category', category);
            card.innerHTML = `
                <strong>${category}</strong>
                <span>${categoryErrors[category]} Fehler</span>
            `;
            categoryCards.appendChild(card);
        }

        // Update error overview and detailed results
        generateErrorTable(data);
        const detailedCategories = document.getElementById('detailed-categories');
        generateDetailedResults(detailedCategories, data);

        // Update date in header
        document.querySelector('.test-date').textContent = data.lastUpdated;
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
    const categories = {
        'wahrnehmbar': {
            name: 'Wahrnehmbar',
            icon: 'mdi:eye',
            description: 'Informationen und Bestandteile der Benutzerschnittstelle müssen den Benutzern so präsentiert werden, dass diese sie wahrnehmen können.'
        },
        'bedienbar': {
            name: 'Bedienbar',
            icon: 'mdi:cursor-default',
            description: 'Bestandteile der Benutzerschnittstelle und Navigation müssen bedienbar sein.'
        },
        'verstaendlich': {
            name: 'Verständlich',
            icon: 'mdi:book-open-variant',
            description: 'Informationen und Bedienung der Benutzerschnittstelle müssen verständlich sein.'
        },
        'robust': {
            name: 'Robust',
            icon: 'mdi:shield-check',
            description: 'Inhalte müssen robust genug sein, damit sie von verschiedenen Benutzeragenten einschließlich Hilfstechnologien interpretiert werden können.'
        }
    };
    
    // Gruppiere Prüfungen nach Kategorie
    const categorizedChecks = {};
    for (const [checkId, check] of Object.entries(data.detailedResults)) {
        if (!categorizedChecks[check.category]) {
            categorizedChecks[check.category] = [];
        }
        categorizedChecks[check.category].push({
            id: checkId,
            ...check
        });
    }

    // Erstelle Kategorieabschnitte
    for (const [categoryId, checks] of Object.entries(categorizedChecks)) {
        const category = categories[categoryId] || { name: categoryId, icon: 'mdi:checkbox-marked-circle' };
        const categoryDiv = document.createElement('div');
        categoryDiv.classList.add('category-section');
        
        categoryDiv.innerHTML = `
            <div class="category-header">
                <iconify-icon icon="${category.icon}" class="category-icon"></iconify-icon>
                <div class="category-info">
                    <h2>${category.name}</h2>
                    <p class="category-description">${category.description || ''}</p>
                </div>
            </div>
            <div class="check-list">
                ${checks.map(check => `
                    <div class="check-item ${check.errors?.length ? 'has-error' : 'passed'}">
                        <div class="check-header">
                            <div class="check-title">
                                <span class="check-id">${check.id}</span>
                                <h3>${check.description}</h3>
                            </div>
                            <div class="check-meta">
                                <span class="check-severity ${check.severity}">${check.severity.toUpperCase()}</span>
                                <div class="check-ref">BITV 2.0: ${check.id} | EN 301 549: ${check.id}</div>
                            </div>
                        </div>
                        
                        ${check.errors?.length === 0 
                            ? `<div class="check-status passed">
                                <iconify-icon icon="mdi:check-circle"></iconify-icon>
                                <span>Bestanden</span>
                                <span class="check-message">Keine Fehler gefunden</span>
                               </div>`
                            : `<div class="check-status failed">
                                <iconify-icon icon="mdi:close-circle"></iconify-icon>
                                <span>Nicht bestanden</span>
                                <span class="check-count">${check.errors.length} Fehler gefunden</span>
                               </div>
                               ${check.errors.map(error => `
                                   <div class="error-details">
                                       <div class="error-message">
                                           <iconify-icon icon="mdi:alert"></iconify-icon>
                                           <span>${error.error}</span>
                                       </div>
                                       ${error.element ? `
                                           <div class="code-example">
                                               <div class="code-label">Betroffenes Element:</div>
                                               <code>${formatCode(error.element)}</code>
                                           </div>
                                       ` : ''}
                                       ${error.text ? `
                                           <div class="error-text">
                                               <div class="text-label">Betroffener Text:</div>
                                               <span>"${error.text}"</span>
                                           </div>
                                       ` : ''}
                                       ${(error.fgColor || error.bgColor) ? `
                                           <div class="color-info">
                                               ${error.fgColor ? `<div>Textfarbe: ${error.fgColor}</div>` : ''}
                                               ${error.bgColor ? `<div>Hintergrundfarbe: ${error.bgColor}</div>` : ''}
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

document.addEventListener('DOMContentLoaded', () => {
    setTestDate();
    loadReportData();
});