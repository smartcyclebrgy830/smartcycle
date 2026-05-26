document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // -------------------------------------------------------------------------
    // 1. SUPABASE INITIALIZATION
    // -------------------------------------------------------------------------
    const SUPABASE_URL = "https://nlybbvlhhdjjmqkzjnhx.supabase.co"; 
    // CRITICAL: Double-check that this is your ANON key, not your Service Role key!
    const SUPABASE_KEY = "sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au"; 
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // ------------------------------------------------------------------------
    // POPOVER HELPERS
    // ------------------------------------------------------------------------
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
        others.forEach(({ b, p }) => {
            if (b && p) closePopover(b, p);
        });
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

    // POPOVER ELEMENTS REGISTRATION (Desktop & Mobile)
    const dateBtn = document.getElementById('dateBtn');
    const datePopover = document.getElementById('datePopover');
    const categoryBtn = document.getElementById('categoryBtn');
    const categoryPopover = document.getElementById('categoryPopover');

    const dateBtnMobile = document.getElementById('dateBtnMobile');
    const datePopoverMobile = document.getElementById('datePopoverMobile');
    const categoryBtnMobile = document.getElementById('categoryBtnMobile');
    const categoryPopoverMobile = document.getElementById('categoryPopoverMobile');

    registerPair(dateBtn, datePopover);
    registerPair(categoryBtn, categoryPopover);
    registerPair(dateBtnMobile, datePopoverMobile);
    registerPair(categoryBtnMobile, categoryPopoverMobile);

    // Desktop Click Listeners
    dateBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover(dateBtn, datePopover, [
            { b: categoryBtn, p: categoryPopover },
            { b: dateBtnMobile, p: datePopoverMobile },
            { b: categoryBtnMobile, p: categoryPopoverMobile }
        ]);
    });

    categoryBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover(categoryBtn, categoryPopover, [
            { b: dateBtn, p: datePopover },
            { b: dateBtnMobile, p: datePopoverMobile },
            { b: categoryBtnMobile, p: categoryPopoverMobile }
        ]);
    });

    // Mobile Click Listeners
    dateBtnMobile?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover(dateBtnMobile, datePopoverMobile, [
            { b: dateBtn, p: datePopover },
            { b: categoryBtn, p: categoryPopover },
            { b: categoryBtnMobile, p: categoryPopoverMobile }
        ]);
    });

    categoryBtnMobile?.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePopover(categoryBtnMobile, categoryPopoverMobile, [
            { b: dateBtn, p: datePopover },
            { b: categoryBtn, p: categoryPopover },
            { b: dateBtnMobile, p: datePopoverMobile }
        ]);
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
    async function fetchAndRenderReportData(startDate, endDate) {
        try {
            const finalStart = startDate || formatDateToSQL(selectedStart);
            const finalEnd = endDate || formatDateToSQL(selectedEnd);

            if (!finalStart || !finalEnd) return;

            const { data, error } = await supabase.rpc('get_material_transactions', {
                start_date: finalStart,
                end_date: finalEnd
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
        
            // Filter categories client-side based on active checkboxes
            const filteredData = data.filter(item => {
                if (!item.type) return true; 
                return activeCategories.includes(item.type.toLowerCase());
            });
        
            renderReportTable(filteredData, selectedStart);
        
        } catch (err) {
            console.error("Error handling interface rendering workflow:", err);
        }
    }

    // -------------------------------------------------------------------------
    // 3. WEEK GENERATION LOGIC
    // -------------------------------------------------------------------------
    function renderReportTable(transactions, startRangeDate) {
        const tableBody = document.getElementById('reportsTableBody'); 
        if (!tableBody) return;
        
        tableBody.innerHTML = ''; 
        
        // Target midnight safely using the local calendar instantiation layout
        const startRange = new Date(startRangeDate.getFullYear(), startRangeDate.getMonth(), startRangeDate.getDate());
    
        const materialSummary = {};
    
        transactions.forEach(tx => {
            // Split string directly to avoid JS timestamp parsing converting to UTC shifts
            const parts = tx.transaction_date.split('T')[0].split('-');
            const txDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            
            const name = tx.material_name;
    
            const diffTime = txDate.getTime() - startRange.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            let weekKey = 'week1';
            if (diffDays > 7 && diffDays <= 14) weekKey = 'week2';
            else if (diffDays > 14 && diffDays <= 21) weekKey = 'week3';
            else if (diffDays > 21) weekKey = 'week4';
    
            if (!materialSummary[name]) {
                materialSummary[name] = { week1: 0, week2: 0, week3: 0, week4: 0, total: 0 };
            }
    
            const currentWeight = parseFloat(tx.weight || 0);
            materialSummary[name][weekKey] += currentWeight;
            materialSummary[name].total += currentWeight;
        });
    
        if (Object.keys(materialSummary).length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

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

    // -------------------------------------------------------------------------
    // UI EVENT LISTENERS (Category & Calendar Range Sync)
    // -------------------------------------------------------------------------
    const allCheckboxes = document.querySelectorAll('.category-popover input[type="checkbox"]');

    allCheckboxes.forEach(cb => {
        if (activeCategories.includes(cb.value)) {
            cb.checked = true;
        }

        cb.addEventListener('change', (e) => {
            const changedValue = e.target.value;
            const isChecked = e.target.checked;

            allCheckboxes.forEach(item => {
                if (item.value === changedValue) {
                    item.checked = isChecked;
                }
            });

            activeCategories = [
                ...new Set([...allCheckboxes].filter(c => c.checked).map(c => c.value))
            ];
            
            fetchAndRenderReportData(formatDateToSQL(selectedStart), formatDateToSQL(selectedEnd));
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

        const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
        const s = new Date(selectedStart.getFullYear(), selectedStart.getMonth(), selectedStart.getDate()).getTime();

        if (!selectedEnd) {
            if (t === s) btn.classList.add('selected');
            return;
        }

        const e = new Date(selectedEnd.getFullYear(), selectedEnd.getMonth(), selectedEnd.getDate()).getTime();
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
            fetchAndRenderReportData(formatDateToSQL(selectedStart), formatDateToSQL(selectedEnd));
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
        buildMobile(); 
    }

    // QUICK RANGES LOGIC
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
            // Pass parameters explicitly to avoid race condition delays 
            fetchAndRenderReportData(formatDateToSQL(selectedStart), formatDateToSQL(selectedEnd));
        });
    });

    // RUN ON LOAD (Single entry point clean execution)
    rebuildAllCalendars();
    fetchAndRenderReportData(formatDateToSQL(selectedStart), formatDateToSQL(selectedEnd));
});
