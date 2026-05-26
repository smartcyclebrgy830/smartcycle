document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // -------------------------------------------------------------------------
    // 1. SUPABASE INITIALIZATION
    // -------------------------------------------------------------------------
    // Replace these strings with your actual Supabase Project URL and Anon API Key
    const SUPABASE_URL = "https://your-project-id.supabase.co"; 
    const SUPABASE_KEY = "your-actual-anon-public-api-key";
    const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // -------------------------------------------------------------------------
    // POPOVER HELPERS
    // -------------------------------------------------------------------------
    const allPairs = [];

    function openPopover(btn, popover) {
        btn.setAttribute('aria-expanded', 'true');
        popover.setAttribute('aria-hidden', 'false');
    }

    function closePopover(btn, popover) {
        btn.setAttribute('aria-expanded', 'false');
        popover.setAttribute('aria-hidden', 'true');
    }

    function togglePopover(btn, popover, others = []) {
        const isOpen = popover.getAttribute('aria-hidden') === 'false';
        others.forEach(({ b, p }) => closePopover(b, p));
        isOpen ? closePopover(btn, popover) : openPopover(btn, popover);
    }

    function registerPair(btn, popover) {
        if (!btn || !popover) return;
        allPairs.push({ btn, popover });
        popover.addEventListener('click', (e) => e.stopPropagation());
    }

    document.addEventListener('click', (e) => {
        allPairs.forEach(({ btn, popover }) => {
            if (!btn.contains(e.target)) closePopover(btn, popover);
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            allPairs.forEach(({ btn, popover }) => closePopover(btn, popover));
        }
    });

    // POPOVER ELEMENTS REGISTRATION
    const dateBtn = document.getElementById('dateBtn');
    const datePopover = document.getElementById('datePopover');
    const categoryBtn = document.getElementById('categoryBtn');
    const categoryPopover = document.getElementById('categoryPopover');

    registerPair(dateBtn, datePopover);
    registerPair(categoryBtn, categoryPopover);

    dateBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover(dateBtn, datePopover, [{ b: categoryBtn, p: categoryPopover }]);
    });

    categoryBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover(categoryBtn, categoryPopover, [{ b: dateBtn, p: datePopover }]);
    });

    // STATE MANAGEMENT FOR FILTERS
    let selectedStart = null;
    let selectedEnd = null;
    let activeCategories = ['Collections', 'Sales']; // Tracks which categories are checked

    // Initialize with current month as default date range
    const initDates = () => {
        const today = new Date();
        selectedStart = new Date(today.getFullYear(), today.getMonth(), 1);
        selectedEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    };
    initDates();

    // -------------------------------------------------------------------------
    // 2. DIRECT SUPABASE FETCHING ENGINE
    // -------------------------------------------------------------------------
    async function fetchAndRenderReportData() {
        if (!selectedStart || !selectedEnd) return;

        const startISO = selectedStart.toISOString().split('T')[0];
        const endISO = selectedEnd.toISOString().split('T')[0];

        let unifiedTransactions = [];

        try {
            // A. FETCH COLLECTIONS DATA (If checked in UI)
            if (activeCategories.includes('Collections')) {
                const { data: collData, error: collErr } = await supabase
                    .from('collection_items')
                    .select(`
                        weight,
                        price_list ( material_name ),
                        collections ! inner ( date_collected )
                    `)
                    .gte('collections.date_collected', startISO)
                    .lte('collections.date_collected', endISO);

                if (collErr) throw collErr;

                if (collData) {
                    collData.forEach(item => {
                        unifiedTransactions.push({
                            material_name: item.price_list?.material_name || 'Unknown',
                            transaction_date: item.collections?.date_collected,
                            weight: item.weight
                        });
                    });
                }
            }

            // B. FETCH SALES DATA (If checked in UI)
            if (activeCategories.includes('Sales')) {
                const { data: salesData, error: salesErr } = await supabase
                    .from('sale_items')
                    .select(`
                        weight,
                        price_list ( material_name ),
                        sales ! inner ( date )
                    `)
                    .gte('sales.date', startISO)
                    .lte('sales.date', endISO);

                if (salesErr) throw salesErr;

                if (salesData) {
                    salesData.forEach(item => {
                        unifiedTransactions.push({
                            material_name: item.price_list?.material_name || 'Unknown',
                            transaction_date: item.sales?.date,
                            weight: item.weight
                        });
                    });
                }
            }

            // Process data into weekly columns and update UI
            const processedData = processReportMetrics(unifiedTransactions, selectedStart);
            renderTable(processedData);

        } catch (error) {
            console.error('Supabase query error:', error);
            renderTable([]);
        }
    }

    // -------------------------------------------------------------------------
    // 3. WEEK GENERATION LOGIC (MATCHING THE FIGMA COMPONENT)
    // -------------------------------------------------------------------------
    function processReportMetrics(transactions, startDate) {
        const materialMap = {};
        const startTimestamp = new Date(startDate).setHours(0,0,0,0);

        transactions.forEach(item => {
            const matName = item.material_name;
            if (!materialMap[matName]) {
                materialMap[matName] = { material: matName, week1: 0, week2: 0, week3: 0, week4: 0, total: 0 };
            }

            const txDate = new Date(item.transaction_date).setHours(0,0,0,0);
            const diffDays = Math.floor((txDate - startTimestamp) / (1000 * 60 * 60 * 24));
            const weight = parseFloat(item.weight) || 0;

            // Group transactions into 7-day windows starting from the selected start date
            if (diffDays >= 0 && diffDays < 7) materialMap[matName].week1 += weight;
            else if (diffDays >= 7 && diffDays < 14) materialMap[matName].week2 += weight;
            else if (diffDays >= 14 && diffDays < 21) materialMap[matName].week3 += weight;
            else if (diffDays >= 21) materialMap[matName].week4 += weight;

            materialMap[matName].total += weight;
        });

        return Object.values(materialMap).map(row => ({
            material: row.material,
            week1: row.week1 > 0 ? parseFloat(row.week1.toFixed(1)) : 0,
            week2: row.week2 > 0 ? parseFloat(row.week2.toFixed(1)) : 0,
            week3: row.week3 > 0 ? parseFloat(row.week3.toFixed(1)) : 0,
            week4: row.week4 > 0 ? parseFloat(row.week4.toFixed(1)) : 0,
            total: parseFloat(row.total.toFixed(1))
        }));
    }

    // -------------------------------------------------------------------------
    // 4. RENDERING POPULATED TABLES
    // -------------------------------------------------------------------------
    const reportsBody = document.getElementById('reportsTableBody');
    const emptyState = document.getElementById('emptyState');

    function renderTable(data) {
        if (!reportsBody) return;
        reportsBody.innerHTML = '';

        if (!data || data.length === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        data.forEach(row => {
            const tr = document.createElement('tr');
            
            // Replicates exactly the clean table styles from Image 2 & 3
            tr.innerHTML = `
                <td class="col-material" style="font-weight: 600; color: #1e293b; text-align: left; padding: 14px 24px;">${row.material}</td>
                <td style="color: #334155; padding: 14px 24px;">${row.week1 || 0}</td>
                <td style="color: #334155; padding: 14px 24px;">${row.week2 || 0}</td>
                <td style="color: #334155; padding: 14px 24px;">${row.week3 || 0}</td>
                <td style="color: #334155; padding: 14px 24px;">${row.week4 || 0}</td>
                <td class="col-total" style="font-weight: 700; color: #0f172a; padding: 14px 24px;">${row.total}</td>
            `;
            reportsBody.appendChild(tr);
        });
    }

    // -------------------------------------------------------------------------
    // UI EVENT LISTENERS (Category & Calendar Range Sync)
    // -------------------------------------------------------------------------
    document.querySelectorAll('.popover-content input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', () => {
            activeCategories = [
                ...document.querySelectorAll('.popover-content input[type="checkbox"]:checked')
            ].map(c => c.value);
            
            fetchAndRenderReportData();
        });
    });

    // CALENDAR LOGIC
    function buildCalendar(tbodyId, year, month, labelId) {
        const tbody = document.getElementById(tbodyId);
        const label = document.getElementById(labelId);
        if (!tbody) return;

        const monthNames = [
            'January','February','March','April','May','June',
            'July','August','September','October','November','December'
        ];

        if (label) label.textContent = `${monthNames[month]} ${year}`;
        tbody.innerHTML = '';

        const today = new Date();
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = (firstDay + 6) % 7; 
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let day = 1 - startOffset;

        for (let row = 0; row < 6; row++) {
            const tr = document.createElement('tr');
            let rowHasCurrent = false;

            for (let col = 0; col < 7; col++, day++) {
                const td = document.createElement('td');
                const btn = document.createElement('button');
                btn.type = 'button';

                if (day < 1 || day > daysInMonth) {
                    btn.textContent = new Date(year, month, day).getDate();
                    btn.classList.add('other-month');
                    btn.disabled = true;
                } else {
                    rowHasCurrent = true;
                    btn.textContent = day;
                    const thisDate = new Date(year, month, day);

                    if (today.getFullYear() === year && today.getMonth() === month && today.getDate() === day) {
                        btn.classList.add('today');
                    }

                    applyRangeClasses(btn, thisDate);
                    btn.addEventListener('click', () => onDateClick(thisDate));
                }

                td.appendChild(btn);
                tr.appendChild(td);
            }
            if (rowHasCurrent || row === 0) tbody.appendChild(tr);
        }
    }

    function applyRangeClasses(btn, date) {
        btn.classList.remove('selected', 'range-start', 'range-end', 'in-range');
        if (!selectedStart) return;

        const t = date.setHours(0,0,0,0);
        const s = new Date(selectedStart).setHours(0,0,0,0);

        if (!selectedEnd) {
            if (t === s) btn.classList.add('selected');
            return;
        }

        const e = new Date(selectedEnd).setHours(0,0,0,0);
        if (t === s) btn.classList.add('range-start');
        else if (t === e) btn.classList.add('range-end');
        else if (t > s && t < e) btn.classList.add('in-range');
    }

    function onDateClick(date) {
        if (!selectedStart || (selectedStart && selectedEnd)) {
            selectedStart = date;
            selectedEnd = null;
        } else {
            if (date < selectedStart) {
                selectedEnd = selectedStart;
                selectedStart = date;
            } else {
                selectedEnd = date;
            }
        }
        rebuildAllCalendars();
        if (selectedStart && selectedEnd) {
            fetchAndRenderReportData();
        }
    }

    let desktopYear = new Date().getFullYear();
    let desktopMonth = new Date().getMonth();

    function buildDesktop() {
        buildCalendar('calBody', desktopYear, desktopMonth, 'calMonthLabel');
    }

    document.getElementById('calPrev')?.addEventListener('click', () => {
        if (--desktopMonth < 0) { desktopMonth = 11; desktopYear--; }
        buildDesktop();
    });

    document.getElementById('calNext')?.addEventListener('click', () => {
        if (++desktopMonth > 11) { desktopMonth = 0; desktopYear++; }
        buildDesktop();
    });

    function rebuildAllCalendars() {
        buildDesktop();
    }

    // QUICK RANGES LINK CODES
    document.querySelectorAll('.quick-dates li button').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('ul').querySelectorAll('button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            switch (btn.getAttribute('data-range')) {
                case 'yesterday': {
                    const y = new Date(today);
                    y.setDate(today.getDate() - 1);
                    selectedStart = y;
                    selectedEnd = new Date(y);
                    break;
                }
                case 'last-week': {
                    const end = new Date(today);
                    end.setDate(today.getDate() - today.getDay() - 1);
                    const start = new Date(end);
                    start.setDate(end.getDate() - 6);
                    selectedStart = start;
                    selectedEnd = end;
                    break;
                }
                case 'last-month': {
                    selectedStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                    selectedEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                    break;
                }
                case 'last-quarter': {
                    const q = Math.floor(today.getMonth() / 3);
                    selectedStart = new Date(today.getFullYear(), (q - 1) * 3, 1);
                    selectedEnd = new Date(today.getFullYear(), q * 3, 0);
                    break;
                }
            }

            rebuildAllCalendars();
            fetchAndRenderReportData();
        });
    });

    // RUN ON LOAD
    rebuildAllCalendars();
    fetchAndRenderReportData();
});
