document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // -------------------------------------------------------------------------
    // 1. SUPABASE INITIALIZATION
    // -------------------------------------------------------------------------
    const SUPABASE_URL = "https://nlybbvlhhdjjmqkzjnhx.supabase.co"; 
    const SUPABASE_KEY = "sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au";
    
    // FIX: Variable renamed to 'supabase' to match lines downstream
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
    let activeCategories = ['collections', 'sales']; 

    // Initialize with current month as default date range
    const initDates = () => {
        const today = new Date();
        selectedStart = new Date(today.getFullYear(), today.getMonth(), 1);
        selectedEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    };
    initDates();

    // Helper to safely format JS Date objects to YYYY-MM-DD for PostgreSQL strings
    function formatDateToSQL(dateObj) {
        if (!dateObj) return null;
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // -------------------------------------------------------------------------
    // 2. DIRECT SUPABASE FETCHING ENGINE
    // -------------------------------------------------------------------------
    async function fetchAndRenderReportData() {
        try {
            const sqlStart = formatDateToSQL(selectedStart);
            const sqlEnd = formatDateToSQL(selectedEnd);

            if (!sqlStart || !sqlEnd) return;

            // Call your Supabase RPC function directly
            const { data, error } = await supabase
                .rpc('get_material_transactions', { 
                    start_date: sqlStart, 
                    end_date: sqlEnd 
                });
    
            if (error) {
                console.error("Supabase RPC Execution Error:", error.message);
                return;
            }
    
            const emptyState = document.getElementById('emptyState');
            const tableBody = document.getElementById('reportsTableBody');

            if (!data || data.length === 0) {
                if (tableBody) tableBody.innerHTML = '';
                if (emptyState) emptyState.style.display = 'flex';
                return;
            }
    
            if (emptyState) emptyState.style.display = 'none';
    
            // Filter categories client-side based on checkboxes
            const filteredData = data.filter(item => {
                if (!item.type) return true; 
                return activeCategories.includes(item.type.toLowerCase());
            });
    
            // Render rows to your UI table wrapper
            renderReportTable(filteredData, selectedStart);
    
        } catch (err) {
            console.error("Error handling interface rendering workflow:", err);
        }
    }

    // -------------------------------------------------------------------------
    // 3. WEEK GENERATION LOGIC
    // -------------------------------------------------------------------------
    function renderReportTable(transactions, startRangeDate) {
        // FIX: Match exact element identity ID attribute found on your DOM string
        const tableBody = document.getElementById('reportsTableBody'); 
        if (!tableBody) return;
        
        tableBody.innerHTML = ''; 
        const startRange = new Date(startRangeDate);
        startRange.setHours(0,0,0,0);
    
        const materialSummary = {};
    
        transactions.forEach(tx => {
            const txDate = new Date(tx.transaction_date);
            txDate.setHours(0,0,0,0);
            const name = tx.material_name;
    
            // Determine difference in days relative to the target selection
            const diffTime = txDate - startRange;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            // Match specific 7-day windows
            let weekKey = 'week1';
            if (diffDays > 7 && diffDays <= 14) weekKey = 'week2';
            else if (diffDays > 14 && diffDays <= 21) weekKey = 'week3';
            else if (diffDays > 21) weekKey = 'week4';
    
            if (!materialSummary[name]) {
                materialSummary[name] = { week1: 0, week2: 0, week3: 0, week4: 0, total: 0 };
            }
    
            materialSummary[name][weekKey] += parseFloat(tx.weight || 0);
            materialSummary[name].total += parseFloat(tx.weight || 0);
        });
    
        // If categories or date filters zero out matching metrics
        if (Object.keys(materialSummary).length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        // Generate table markup matching your clean UI rules
        Object.keys(materialSummary).forEach(matName => {
            const rowData = materialSummary[matName];
            const rowHTML = `
                <tr>
                    <td class="col-material" style="font-weight: 600; color: #1e293b; text-align: left; padding: 14px 24px;">${matName}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week1.toFixed(1)}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week2.toFixed(1)}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week3.toFixed(1)}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week4.toFixed(1)}</td>
                    <td class="col-total" style="font-weight: 700; color: #0f172a; padding: 14px 24px;"><strong>${rowData.total.toFixed(1)}</strong></td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', rowHTML);
        });
    }

    // You can remove your old "function renderTable(data)" block entirely because 
    // renderReportTable now handles the HTML injection cleanly.

    // -------------------------------------------------------------------------
    // UI EVENT LISTENERS (Category & Calendar Range Sync)
    // -------------------------------------------------------------------------
    document.querySelectorAll('.popover-content input[type="checkbox"]').forEach(cb => {
        // Set UI defaults dynamically based on initial script state
        if (activeCategories.includes(cb.value)) {
            cb.checked = true;
        }

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
    
    let mobileYear = new Date().getFullYear();
    let mobileMonth = new Date().getMonth();

    function buildDesktop() {
        buildCalendar('calBody', desktopYear, desktopMonth, 'calMonthLabel');
    }

    function buildMobile() {
        buildCalendar('calBodyMobile', mobileYear, mobileMonth, 'calMonthLabelMobile');
    }

    document.getElementById('calPrev')?.addEventListener('click', () => {
        if (--desktopMonth < 0) { desktopMonth = 11; desktopYear--; }
        buildDesktop();
    });

    document.getElementById('calNext')?.addEventListener('click', () => {
        if (++desktopMonth > 11) { desktopMonth = 0; desktopYear++; }
        buildDesktop();
    });

    // Add Fallbacks for Mobile navigation controls if they exist in your DOM
    document.getElementById('calPrevMobile')?.addEventListener('click', () => {
        if (--mobileMonth < 0) { mobileMonth = 11; mobileYear--; }
        buildMobile();
    });

    document.getElementById('calNextMobile')?.addEventListener('click', () => {
        if (++mobileMonth > 11) { mobileMonth = 0; mobileYear++; }
        buildMobile();
    });

    function rebuildAllCalendars() {
        buildDesktop();
        buildMobile(); // Safely keep mobile rendering synchronized 
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
