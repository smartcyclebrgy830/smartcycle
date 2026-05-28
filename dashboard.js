// Dashboard JavaScript with Supabase Integration

// TODO: Replace these with your actual Supabase credentials
const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';

// FIX: Use a unique variable name to avoid global namespace collisions with the CDN
let supabaseClient;

try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Supabase CDN library is missing or didn't load properly.");
    }
} catch (err) {
    console.error("Error initializing Supabase client:", err);
}

// CHECK AUTHENTICATION - Protect dashboard page
(function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    
    // If not logged in, redirect to login page
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    
    // If logged in, display user name
    const userName = sessionStorage.getItem('userName') || 'Admin';
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = userName;
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    if (!supabaseClient) {
        console.error("Supabase client is not initialized.");
        return;
    }

    // Load dynamic dashboard data from Supabase
    loadDashboardData();
});

/**
 * Main function to load all dashboard data from Supabase database
 */
/**
 * Main function to load all dashboard data from Supabase database
 */
async function loadDashboardData() {
    try {
        const now = new Date();
        const currentMonthNum = now.getMonth(); // 0 = Jan, 4 = May, etc.
        const currentYear = now.getFullYear();

        // ----------------------------------------
        // 1. TOTAL DISTRIBUTORS & TREND
        // ----------------------------------------
        const { data: profiles, error: pError } = await supabaseClient
            .from('profiles')
            .select('created_at, type');

        if (pError) throw pError;

        // Calculate Current Month Distributors (This is now your main metric!)
        const currentMonthDistributors = profiles.filter(p => {
            const d = new Date(p.created_at);
            return d.getMonth() === currentMonthNum && d.getFullYear() === currentYear;
        }).length;

        // Calculate Previous Month Distributors for Trend
        const prevMonthDistributors = profiles.filter(p => {
            const d = new Date(p.created_at);
            return d.getMonth() === (currentMonthNum - 1 === -1 ? 11 : currentMonthNum - 1) && 
                   d.getFullYear() === (currentMonthNum - 1 === -1 ? currentYear - 1 : currentYear);
        }).length;

        const distributorTrend = calculateTrend(currentMonthDistributors, prevMonthDistributors);

        // ----------------------------------------
        // 2. TOTAL SALES & TREND
        // ----------------------------------------
        const { data: sales, error: sError } = await supabaseClient
            .from('sales')
            .select('date, total_amount');

        if (sError) throw sError;

        // Calculate Current Month Sales (This is now your main metric!)
        const currentMonthSales = sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === currentMonthNum && d.getFullYear() === currentYear;
        }).reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

        // Calculate Previous Month Sales for Trend
        const prevMonthSales = sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === (currentMonthNum - 1 === -1 ? 11 : currentMonthNum - 1) && 
                   d.getFullYear() === (currentMonthNum - 1 === -1 ? currentYear - 1 : currentYear);
        }).reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

        const salesTrend = calculateTrend(currentMonthSales, prevMonthSales);

        // ----------------------------------------
        // 3. TOTAL COLLECTION & TREND
        // ----------------------------------------
        const { data: collectionItems, error: ciError } = await supabaseClient
            .from('collection_items')
            .select('weight, collections(date_collected), price_list(material_name)');

        if (ciError) throw ciError;

        // Calculate Current Month Collection (This is now your main metric!)
        const currentMonthColl = collectionItems.filter(item => {
            if (!item.collections) return false;
            const collectionData = Array.isArray(item.collections) ? item.collections[0] : item.collections;
            if (!collectionData || !collectionData.date_collected) return false;
            
            const d = new Date(collectionData.date_collected);
            return d.getMonth() === currentMonthNum && d.getFullYear() === currentYear;
        }).reduce((acc, curr) => acc + Number(curr.weight || 0), 0);
        
        // Calculate Previous Month Collection for Trend
        const prevMonthColl = collectionItems.filter(item => {
            if (!item.collections) return false;
            const collectionData = Array.isArray(item.collections) ? item.collections[0] : item.collections;
            if (!collectionData || !collectionData.date_collected) return false;
            
            const d = new Date(collectionData.date_collected);
            return d.getMonth() === (currentMonthNum - 1 === -1 ? 11 : currentMonthNum - 1) && 
                   d.getFullYear() === (currentMonthNum - 1 === -1 ? currentYear - 1 : currentYear);
        }).reduce((acc, curr) => acc + Number(curr.weight || 0), 0);

        const collectionTrend = calculateTrend(currentMonthColl, prevMonthColl);

        // ----------------------------------------
        // 4. SPARKLINE CHRONOLOGY 
        // ----------------------------------------
        const sparklineData = {
            collection: getMonthlyChronology(collectionItems, 'weight', 'collections', 'date_collected'),
            sales: getMonthlyChronology(sales, 'total_amount', null, 'date'),
            distributors: getMonthlyChronology(profiles, 'count', null, 'created_at')
        };

        // ----------------------------------------
        // 5. CHART: MOST COLLECTED MATERIALS 
        // ----------------------------------------
        const monthLabels = ['Jan', 'Feb', 'March', 'April', 'May'];
        const materialDatasets = processMaterialData(collectionItems, monthLabels, currentYear);

        // ----------------------------------------
        // 6. CHART: TOP CONTRIBUTION BY CATEGORY 
        // ----------------------------------------
        const categoriesCount = { 'Barangay': 0, 'School': 0, 'Walk-in': 0 };
        profiles.forEach(p => {
            if (p.type && categoriesCount[p.type] !== undefined) {
                categoriesCount[p.type]++;
            } else if (p.category && categoriesCount[p.category] !== undefined) {
                categoriesCount[p.category]++;
            }
        });

        const totalCatSum = categoriesCount['Barangay'] + categoriesCount['School'] + categoriesCount['Walk-in'] || 1;
        const categoryPercentages = [
            Math.round((categoriesCount['Barangay'] / totalCatSum) * 100),
            Math.round((categoriesCount['School'] / totalCatSum) * 100),
            Math.round((categoriesCount['Walk-in'] / totalCatSum) * 100)
        ];

        // ----------------------------------------
        // BUILD FINAL DATA STRUCTURE
        // ----------------------------------------
        const finalDashboardData = {
            userName: sessionStorage.getItem('userName') || 'Admin',
            stats: {
                // Notice these now use the currentMonth variables!
                totalCollection: Math.round(currentMonthColl), 
                collectionTrend: Math.abs(collectionTrend),
                collectionTrendPositive: collectionTrend >= 0,
                
                totalSales: Math.round(currentMonthSales), 
                salesTrend: Math.abs(salesTrend),
                salesTrendPositive: salesTrend >= 0,
                
                totalDistributors: currentMonthDistributors, 
                distributorTrend: Math.abs(distributorTrend),
                distributorTrendPositive: distributorTrend >= 0
            },
            sparklineData: sparklineData,
            materialsData: {
                labels: monthLabels,
                datasets: materialDatasets
            },
            categoryData: {
                labels: ['Barangay', 'School', 'Walk-in'],
                data: categoryPercentages,
                backgroundColor: ['#FFEB8A', '#71D7D0', '#B9E682']
            }
        };

        // Render to Screen Layout
        updateDashboard(finalDashboardData);
        
    } catch (error) {
        console.error('Error loading dashboard data from Supabase:', error);
    }
}

/**
 * Helper: Math percentage parser for MoM Trend Values
 */
function calculateTrend(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number(((current - previous) / previous * 100).toFixed(1));
}

/**
 * Helper: Generates a sequential trend array of values for Sparklines over last 6 months
 */
function getMonthlyChronology(items, valueField, relationField, dateField) {
    const counts = new Array(6).fill(0);
    const now = new Date();
    
    items.forEach(item => {
        let dateStr = null;
        
        if (relationField) {
            const relationData = item[relationField];
            if (relationData) {
                dateStr = Array.isArray(relationData) ? relationData[0]?.[dateField] : relationData[dateField];
            }
        } else {
            dateStr = item[dateField];
        }
        
        if (!dateStr) return;
        
        const date = new Date(dateStr);
        const monthDiff = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
        
        if (monthDiff >= 0 && monthDiff < 6) {
            const index = 5 - monthDiff; // order older months first
            if (valueField === 'count') {
                counts[index]++;
            } else {
                counts[index] += Number(item[valueField] || 0);
            }
        }
    });
    return counts;
}

/**
 * Helper: Aggregates weights by matching specific material names per calendar month
 */
function processMaterialData(collectionItems, months, targetYear) {
    const materials = [
        { label: 'Plastic', color: '#FFEB8A' },
        { label: 'Metal', color: '#71D7D0' },
        { label: 'Paper', color: '#B9E682' }
    ];

    return materials.map(mat => {
        const monthlyData = new Array(months.length).fill(0);
        
        collectionItems.forEach(item => {
            // Safely parse relation objects/arrays
            const priceListData = Array.isArray(item.price_list) ? item.price_list[0] : item.price_list;
            const collectionsData = Array.isArray(item.collections) ? item.collections[0] : item.collections;
            
            const name = priceListData?.material_name?.toLowerCase() || "";
            
            if (name.includes(mat.label.toLowerCase())) {
                if (collectionsData && collectionsData.date_collected) {
                    const d = new Date(collectionsData.date_collected);
                    if (d.getFullYear() === targetYear) {
                        const mIndex = d.getMonth(); 
                        if (mIndex < months.length) {
                            monthlyData[mIndex] += Number(item.weight || 0);
                        }
                    }
                }
            }
        });

        return {
            label: mat.label,
            data: monthlyData.map(v => Math.round(v)),
            backgroundColor: mat.color
        };
    });
}

/**
 * Update dashboard elements with data from backend
 */
function updateDashboard(data) {
    updateUserName(data.userName);
    updateStats(data.stats);
    createSparklines(data.sparklineData);
    createMaterialsChart(data.materialsData);
    createCategoryChart(data.categoryData);
}

function updateUserName(name) {
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = name;
    }
}

function updateStats(stats) {
    document.getElementById('total-collection').textContent = formatNumber(stats.totalCollection);
    document.getElementById('collection-trend-value').textContent = stats.collectionTrend + '%';
    updateTrendIndicator('collection-trend', stats.collectionTrendPositive);
    
    document.getElementById('total-sales').textContent = formatNumber(stats.totalSales);
    document.getElementById('sales-trend-value').textContent = stats.salesTrend + '%';
    updateTrendIndicator('sales-trend', stats.salesTrendPositive);
    
    document.getElementById('total-distributors').textContent = formatNumber(stats.totalDistributors);
    document.getElementById('distributor-trend-value').textContent = stats.distributorTrend + '%';
    updateTrendIndicator('distributor-trend', stats.distributorTrendPositive);
}

function updateTrendIndicator(elementId, isPositive) {
    const trendElement = document.getElementById(elementId);
    if (trendElement) {
        trendElement.classList.remove('positive', 'negative');
        trendElement.classList.add(isPositive ? 'positive' : 'negative');
        
        const icon = trendElement.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isPositive ? 'trending-up' : 'trending-down');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
}

function createSparklines(sparklineData) {
    createSparkline('collectionSparkline', sparklineData.collection, '#FFEB8A');
    createSparkline('salesSparkline', sparklineData.sales, '#71D7D0');
    createSparkline('distributorSparkline', sparklineData.distributors, '#B9E682');
}

function createSparkline(canvasId, data, color) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            events: []
        }
    });
}

function createMaterialsChart(data) {
    const ctx = document.getElementById('materialsChart');
    if (!ctx) return;
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: data.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                }
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    beginAtZero: true
                }
            }
        }
    });
}

function createCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: data.backgroundColor,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': ' + context.parsed + '%';
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
