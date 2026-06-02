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
    
    // 1. Safe Redirect Guard
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'login.html';
        return;
    }
    
    // 2. Fetch User Identity and Role
    const userName = sessionStorage.getItem('userName') || 'User';
    const userRole = sessionStorage.getItem('userRole') || 'moderator'; // default fallback
    
    // 3. Update Sidebar Profile Name
    const userNameElement = document.getElementById('user-name');
    if (userNameElement) {
        userNameElement.textContent = userName;
    }

    // 4. Update Header Greeting Dynamically
    // Assumes your H1 has an id="dashboard-greeting" or similar wrapper
    const greetingElement = document.getElementById('dashboard-greeting');
    if (greetingElement) {
        // Formats 'super_admin' or 'admin' to clean display text
        const formattedRole = userRole.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
        greetingElement.textContent = `Good Morning, ${formattedRole}!`;
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
            .select('created_at, type, category');

        if (pError) throw pError;

        const currentMonthDistributors = profiles.filter(p => {
            const d = new Date(p.created_at);
            return d.getMonth() === currentMonthNum && d.getFullYear() === currentYear;
        }).length;

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

        const currentMonthSales = sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === currentMonthNum && d.getFullYear() === currentYear;
        }).reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

        const prevMonthSales = sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === (currentMonthNum - 1 === -1 ? 11 : currentMonthNum - 1) && 
                   d.getFullYear() === (currentMonthNum - 1 === -1 ? currentYear - 1 : currentYear);
        }).reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);

        const salesTrend = calculateTrend(currentMonthSales, prevMonthSales);

        // ----------------------------------------
        // 3. TOTAL COLLECTION & TREND (UPDATED RELATION SELECT)
        // ----------------------------------------
        const { data: collectionItems, error: ciError } = await supabaseClient
            .from('collection_items')
            .select('weight, collections(date_collected, profiles(category, type)), price_list(material_name)');

        if (ciError) throw ciError;

        const currentMonthColl = collectionItems.filter(item => {
            if (!item.collections) return false;
            const collectionData = Array.isArray(item.collections) ? item.collections[0] : item.collections;
            if (!collectionData || !collectionData.date_collected) return false;
            
            const d = new Date(collectionData.date_collected);
            return d.getMonth() === currentMonthNum && d.getFullYear() === currentYear;
        }).reduce((acc, curr) => acc + Number(curr.weight || 0), 0);
        
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
        // 5. CHART: MOST COLLECTED MATERIALS (Dynamic)
        // ----------------------------------------
        const { data: priceList, error: plError } = await supabaseClient
            .from('price_list')
            .select('material_name');

        if (plError) throw plError;

        const barColors = ['#FFEB8A', '#71D7D0', '#B9E682', '#FFB6C1', '#FFDAB9', '#E6E6FA', '#87CEFA'];
        const dynamicMaterials = priceList.map((item, index) => ({
            label: item.material_name,
            color: barColors[index % barColors.length]
        }));

        const allMonths = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
        const monthLabels = allMonths.slice(0, currentMonthNum + 1); 
        
        const materialDatasets = processMaterialData(collectionItems, monthLabels, currentYear, dynamicMaterials);

        // ----------------------------------------
        // 6. CHART: TOP CONTRIBUTION BY CATEGORY (AGGREGATING TOTAL WEIGHT)
        // ----------------------------------------
        
        const allowedCategories = ['Barangay', 'School', 'Walk-in'];
        
        // Initialize the tracking object with 0 kilograms
        const categoriesWeight = {
            'Barangay': 0,
            'School': 0,
            'Walk-in': 0
        };
        
        collectionItems.forEach(item => {
            if (!item.collections) return;
            const collectionData = Array.isArray(item.collections) ? item.collections[0] : item.collections;
            if (!collectionData || !collectionData.date_collected) return;
            
            // Only sum up weights for the current month and year
            const d = new Date(collectionData.date_collected);
            if (d.getMonth() !== currentMonthNum || d.getFullYear() !== currentYear) return;
            
            // Extract profile categories safely from nested data fields
            if (!collectionData.profiles) return;
            const profileData = Array.isArray(collectionData.profiles) ? collectionData.profiles[0] : collectionData.profiles;
            if (!profileData) return;

            let rawCat = profileData.category || profileData.type || '';
            let lowerCat = rawCat.toLowerCase();
            let mappedCat = 'Uncategorized';
            
            if (lowerCat.includes('barangay')) {
                mappedCat = 'Barangay';
            } else if (lowerCat.includes('school')) {
                mappedCat = 'School';
            } else if (lowerCat.includes('walk-in')) { 
                mappedCat = 'Walk-in';
            }

            // Aggregate transaction weights instead of simple integers
            if (categoriesWeight.hasOwnProperty(mappedCat)) {
                categoriesWeight[mappedCat] += Number(item.weight || 0);
            }
        });

        const categoryLabels = allowedCategories;
        const categoryDataRaw = allowedCategories.map(cat => categoriesWeight[cat]);
        const totalWeightSum = categoryDataRaw.reduce((sum, val) => sum + val, 0) || 1;

        const categoryPercentages = categoryDataRaw.map(val => Math.round((val / totalWeightSum) * 100));

        const categoryColorMap = {
            'Barangay': '#FFEB8A', 
            'School': '#71D7D0',   
            'Walk-in': '#B9E682'   
        };
        
        const dynamicCategoryColors = categoryLabels.map(cat => categoryColorMap[cat]);

        // ----------------------------------------
        // BUILD FINAL DATA STRUCTURE
        // ----------------------------------------
        const finalDashboardData = {
            userName: sessionStorage.getItem('userName') || 'Office Admin',
            stats: {
                totalCollection: Math.round(currentMonthColl), 
                collectionTrend: collectionTrend,
                collectionTrendPositive: collectionTrend >= 0,
                
                totalSales: Math.round(currentMonthSales), 
                salesTrend: salesTrend,
                salesTrendPositive: salesTrend >= 0,
                
                totalDistributors: currentMonthDistributors, 
                distributorTrend: distributorTrend,
                distributorTrendPositive: distributorTrend >= 0
            },
            sparklineData: sparklineData,
            materialsData: {
                labels: monthLabels,
                datasets: materialDatasets
            },
            categoryData: {
                labels: categoryLabels,
                data: categoryPercentages,
                backgroundColor: dynamicCategoryColors
            }
        };

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
            const index = 5 - monthDiff; 
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
function processMaterialData(collectionItems, months, targetYear, materials) {
    return materials.map(mat => {
        const monthlyData = new Array(months.length).fill(0);
        
        collectionItems.forEach(item => {
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
        
        const existingIcon = trendElement.querySelector('i, svg');
        
        if (existingIcon) {
            const newIcon = document.createElement('i');
            newIcon.setAttribute('data-lucide', isPositive ? 'trending-up' : 'trending-down');
            existingIcon.replaceWith(newIcon);
            
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }
    }
}

function createSparklines(sparklineData) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const labels = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        labels.push(`${monthNames[d.getMonth()]} ${d.getFullYear()}`);
    }

    createSparkline('collectionSparkline', sparklineData.collection, '#FFEB8A', labels, 'Collection');
    createSparkline('salesSparkline', sparklineData.sales, '#71D7D0', labels, 'Sales');
    createSparkline('distributorSparkline', sparklineData.distributors, '#B9E682', labels, 'Distributors');
}

function createSparkline(canvasId, data, color, labels, labelName) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    const existingChart = Chart.getChart(ctx);
    if (existingChart) existingChart.destroy();
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels, 
            datasets: [{
                label: labelName,
                data: data,
                borderColor: color,
                backgroundColor: color + '20',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,            
                pointHoverRadius: 5,       
                pointHoverBackgroundColor: color
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: { 
                    enabled: true,         
                    mode: 'index',
                    intersect: false,      
                    callbacks: {
                        label: function(context) {
                            let value = context.parsed.y;
                            if (labelName === 'Collection') return ` Collected: ${formatNumber(value)} kg`;
                            if (labelName === 'Sales') return ` Total Sales: ₱${formatNumber(value)}`;
                            if (labelName === 'Distributors') return ` New Users: ${formatNumber(value)}`;
                            return ` ${labelName}: ${formatNumber(value)}`;
                        }
                    }
                }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
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
