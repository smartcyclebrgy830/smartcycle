(function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }
})();

document.addEventListener('DOMContentLoaded', () => {

    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    if (!window._supabase) {
        const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';
    
        window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    let currentUserRole = null;

    async function getUserRole() {
        const { data: { user }, error: userError } = await window._supabase.auth.getUser()
    
        if (userError || !user) {
            console.error("User not logged in");
            return;
        }
    
        const { data, error } = await window._supabase

            .from('profiles')
            .select('type')
            .eq('auth_id', user.id)
            .single();
    
        if (error) {
            console.error("Error fetching role:", error.message);
            return;
        }
    
        currentUserRole = data.type;
        applyRolePermissions();
    }

    function applyRolePermissions() {
        const exportSection = document.getElementById('exportSection');
    
        if (currentUserRole === 'Moderator') {
            // Hide EVERYTHING (label + button)
            if (exportSection) exportSection.style.display = 'none';
    
            // Extra safety
            document.querySelectorAll('.btn-export').forEach(btn => {
                btn.style.display = 'none';
            });
        }
    
        if (currentUserRole === 'Admin' || currentUserRole === 'Super Admin') {
            if (exportSection) exportSection.style.display = 'block'; // or block depending on your layout
        }
    }

    // POPOVER HELPERS & LIFECYCLE MANAGEMENT
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

    const exportDropdownBtn = document.getElementById('exportDropdownBtn');
    const exportDropdown    = document.getElementById('exportDropdown');

    if (exportDropdownBtn && exportDropdown) {
        registerPair(exportDropdownBtn, exportDropdown);
        exportDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePopover(exportDropdownBtn, exportDropdown);
        });
    }

    document.querySelectorAll('.export-dropdown-item').forEach(btn => {
        btn.addEventListener('click', () => {
            handleExport(btn.getAttribute('data-format'));
            if (exportDropdownBtn && exportDropdown) {
                closePopover(exportDropdownBtn, exportDropdown);
            }
        });
    });

    document.querySelectorAll('.btn-export').forEach(btn => {
        btn.addEventListener('click', () => handleExport(btn.getAttribute('data-format')));
    });

    // STATE MANAGEMENT & DATA COUPLING ENGINE
    let selectedStart = null;
    let selectedEnd = null;
    let activeCategories = ['collections', 'sales']; 
    
    // Global variable cache to store current data state safely
    let processedReportSummary = {}; 

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

    async function fetchAndRenderReportData(startDate, endDate) {
        try {
            const finalStart = startDate || formatDateToSQL(selectedStart);
            const finalEnd = endDate || formatDateToSQL(selectedEnd);

            if (!finalStart || !finalEnd) return;
            if (!window._supabase || typeof window._supabase.rpc !== 'function') {
                console.error("Supabase RPC not available");
                return;
            }

            const { data, error } = await window._supabase.rpc('get_material_transactions', {
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
                processedReportSummary = {}; // flush cache
                return;
            }
        
            if (emptyState) emptyState.style.display = 'none';
        
            const filteredData = data.filter(item => {
                if (!item.type) return true; 
                return activeCategories.includes(item.type.toLowerCase());
            });
        
            renderReportTable(filteredData, selectedStart);
        
        } catch (err) {
            console.error("Error handling interface rendering workflow:", err);
        }
    }

    function renderReportTable(transactions, startRangeDate) {
        const tableBody = document.getElementById('reportsTableBody'); 
        if (!tableBody) return;
        
        tableBody.innerHTML = ''; 
        const startRange = new Date(startRangeDate.getFullYear(), startRangeDate.getMonth(), startRangeDate.getDate());
        
        // Reset our calculation engine
        processedReportSummary = {}; 
    
        transactions.forEach(tx => {
            if (!tx.transaction_date) return;
            const parts = tx.transaction_date.split('T')[0].split('-');
            const txDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            
            const name = tx.material_name || "Unknown Material";
            const diffTime = txDate.getTime() - startRange.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            
            // Map cleanly to columns 
            let weekKey = 'week1';
            if (diffDays > 7 && diffDays <= 14) weekKey = 'week2';
            else if (diffDays > 14 && diffDays <= 21) weekKey = 'week3';
            else if (diffDays > 21) weekKey = 'week4';
    
            if (!processedReportSummary[name]) {
                processedReportSummary[name] = { week1: 0, week2: 0, week3: 0, week4: 0, total: 0 };
            }
    
            const currentWeight = parseFloat(tx.weight || 0);
            processedReportSummary[name][weekKey] += currentWeight;
            processedReportSummary[name].total += currentWeight;
        });
    
        if (Object.keys(processedReportSummary).length === 0) {
            const emptyState = document.getElementById('emptyState');
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        Object.keys(processedReportSummary).forEach(matName => {
            const rowData = processedReportSummary[matName];
            const rowHTML = `
                <tr>
                    <td class="col-material" style="font-weight: 600; color: #1e293b; text-align: left; padding: 14px 24px;">${matName}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week1.toFixed(1)}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week2.toFixed(1)}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week3.toFixed(1)}</td>
                    <td style="color: #334155; padding: 14px 24px;">${rowData.week4.toFixed(1)}</td>
                    <td class="col-total" style="font-weight: 700; color: #10b981; padding: 14px 24px;"><strong>${rowData.total.toFixed(1)}</strong></td>
                </tr>
            `;
            tableBody.insertAdjacentHTML('beforeend', rowHTML);
        });
    }
    
    // EXPORT ENGINE AND MODAL INTERACTION 
    function handleExport(format) {
        if (currentUserRole === 'Moderator') {
            alert("Access denied: You are not allowed to export reports.");
            return;
        }
    
        showExportModal(format);
    }

    function showModalErrors(overlay, errors) {
        var existing = overlay.querySelector('#exportModalErrors');
        if (existing) existing.remove();
        
        var box = document.createElement('div');
        box.id = 'exportModalErrors';
        box.style.cssText = 'background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-top:14px;font-size:12px;color:#b91c1c;';
        box.innerHTML = errors.map(function(e) { return '<div>• ' + e + '</div>'; }).join('');

        overlay.querySelector('#exportModalConfirm').closest('div').before(box);

        overlay.querySelector('div').addEventListener('input', function() {
            var err = overlay.querySelector('#exportModalErrors');
            if (err) err.remove();
        }, { once: true });
    }

    function showExportModal(format) {
        document.getElementById('exportFormModal')?.remove();

        const now = new Date();
        const fieldStyle = `border:1px solid #d1d5db;border-radius:7px;padding:7px 10px;font-size:13px;font-family:inherit;color:#0f172a;outline:none;width:100%;box-sizing:border-box;`;
        const labelStyle = `font-size:12px;font-weight:600;color:#374151;display:flex;flex-direction:column;gap:4px;`;

        const overlay = document.createElement('div');
        overlay.id = 'exportFormModal';
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(0,0,0,0.45);
            display: flex; align-items: center; justify-content: center;
            z-index: 9999; font-family: 'Inter', sans-serif;
        `;

        overlay.innerHTML = `
            <div style="background:#fff; border-radius:16px; padding:28px 32px; width:460px; max-width:92vw;
                        box-shadow:0 24px 48px rgba(0,0,0,0.18); position:relative;">
                <button id="exportModalClose" style="position:absolute;top:14px;right:16px;background:none;
                    border:none;font-size:20px;cursor:pointer;color:#64748b;line-height:1;">&#10005;</button>

                <h2 style="margin:0 0 4px;font-size:17px;font-weight:700;color:#0f172a;">
                    Export Junkshop Monitoring Form
                </h2>
                <p style="margin:0 0 20px;font-size:13px;color:#64748b;">
                    Fill in the form details for the <strong>${format}</strong> report.
                </p>

                <div style="display:grid;gap:10px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <label style="${labelStyle}">Month
                            <select id="expMonth" style="${fieldStyle}">
                                ${['January','February','March','April','May','June',
                                   'July','August','September','October','November','December']
                                   .map((m,i)=>`<option value="${i}" ${i===now.getMonth()?'selected':''}>${m}</option>`).join('')}
                            </select>
                        </label>
                        <label style="${labelStyle}">Year
                            <input id="expYear" type="number" value="${now.getFullYear()}" min="2000" max="2099" style="${fieldStyle}">
                        </label>
                    </div>

                    <label style="${labelStyle}">Junkshop Name
                        <input id="expJunkshop" type="text" value="TEZWA" readonly style="${fieldStyle}">
                    </label>
                    <label style="${labelStyle}">Address
                        <input id="expAddress" type="text" placeholder="Street, City" style="${fieldStyle}">
                    </label>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                        <label style="${labelStyle}">Barangay
                            <input id="expBrgy" type="text" value="830" style="${fieldStyle}">
                        </label>
                        <label style="${labelStyle}">Zone
                            <input id="expZone" type="text" style="${fieldStyle}">
                        </label>
                        <label style="${labelStyle}">District
                            <input id="expDistrict" type="text" style="${fieldStyle}">
                        </label>
                    </div>

                    <label style="${labelStyle}">Owner / In-Charge
                        <input id="expOwner" type="text" placeholder="Full name" style="${fieldStyle}">
                    </label>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                        <label style="${labelStyle}">Mobile No.
                            <input id="expMobile" type="text" placeholder="09XX-XXX-XXXX" style="${fieldStyle}">
                        </label>
                        <label style="${labelStyle}">Landline
                            <input id="expLandline" type="text" placeholder="(02) XXXX-XXXX" style="${fieldStyle}">
                        </label>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                        <label style="${labelStyle}">Date Established
                            <input id="expDateEst" type="text" placeholder="MM/DD/YYYY" style="${fieldStyle}">
                        </label>
                        <label style="${labelStyle}">Floor Area (sqm)
                            <input id="expFloor" type="text" style="${fieldStyle}">
                        </label>
                        <label style="${labelStyle}">No. of Aide
                            <input id="expAide" type="text" style="${fieldStyle}">
                        </label>
                    </div>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px;">
                    <button id="exportModalCancel" style="padding:9px 20px;border:1px solid #e5e7eb;
                        border-radius:8px;background:#fff;font-size:13px;cursor:pointer;color:#374151;
                        font-weight:500;">Cancel</button>
                    <button id="exportModalConfirm" style="padding:9px 22px;border:none;border-radius:8px;
                        background:#46B336;color:#fff;font-size:13px;font-weight:600;cursor:pointer;
                        display:flex;align-items:center;gap:6px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export ${format}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        overlay.querySelector('#exportModalClose').addEventListener('click', close);
        overlay.querySelector('#exportModalCancel').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        overlay.querySelector('#exportModalConfirm').addEventListener('click', async () => {
            var mobile   = overlay.querySelector('#expMobile').value.trim();
            var landline = overlay.querySelector('#expLandline').value.trim();
            var year     = parseInt(overlay.querySelector('#expYear').value);

            if (mobile && !/^(09\d{2}-?\d{3}-?\d{4}|09\d{9})$/.test(mobile)) {
                errors.push('Mobile No. must be a valid PH number (e.g. 09XX-XXX-XXXX).');
            }

            if (landline && !/^(\(\d{2,3}\)\s?\d{3,4}-?\d{4}|\d{7,8})$/.test(landline)) {
                errors.push('Landline must be a valid format (e.g. (02) XXXX-XXXX).');
            }

            if (isNaN(year) || year < 2000 || year > 2099) {
                errors.push('Year must be between 2000 and 2099.');
            }

            if (errors.length > 0) {
                showModalErrors(overlay, errors);
                return;
            }
            
            // GET VALUES FIRST 
            const month = parseInt(overlay.querySelector('#expMonth').value);
            const year  = parseInt(overlay.querySelector('#expYear').value);
        
            console.log("MONTH/YEAR:", month, year); // debug
        
            // NOW CALL FUNCTION 
            const aggregated = await JunkshopExport.aggregateSupabaseData(month, year);
        
            console.log("AGGREGATED DATA:", aggregated); 
            // Bundling the compiled metrics payload into options map
            const opts = {
                month:           parseInt(overlay.querySelector('#expMonth').value),
                year:            parseInt(overlay.querySelector('#expYear').value),
                junkshopName:    overlay.querySelector('#expJunkshop').value.trim(),
                address:         overlay.querySelector('#expAddress').value.trim(),
                barangay:        overlay.querySelector('#expBrgy').value.trim(),
                zone:            overlay.querySelector('#expZone').value.trim(),
                district:        overlay.querySelector('#expDistrict').value.trim(),
                owner:           overlay.querySelector('#expOwner').value.trim(),
                mobile:          overlay.querySelector('#expMobile').value.trim(),
                landline:        overlay.querySelector('#expLandline').value.trim(),
                dateEstablished: overlay.querySelector('#expDateEst').value.trim(),
                floorArea:       overlay.querySelector('#expFloor').value.trim(),
                noOfAide:        overlay.querySelector('#expAide').value.trim(),
                reportData: aggregated
            };
            // LOG EXPORT ACTION
            if (currentUserRole === 'Admin' || currentUserRole === 'Super Admin') {
                const exportType = format.toUpperCase(); // PDF or CSV
                await window.logAction(`Exported ${exportType} report for ${opts.junkshopName}`);
            }

            close();

            if (format === 'PDF') {
                if (typeof JunkshopExport !== 'undefined' && JunkshopExport.exportPDF) {
                    JunkshopExport.exportPDF(opts).catch(err => {
                        console.error('PDF export error:', err);
                        alert('PDF export failed. Please verify your print template parsing functions.');
                    });
                } else {
                    console.error('Missing: JunkshopExport object handler for PDF targets.');
                }
            } else {
                if (typeof JunkshopExport !== 'undefined' && JunkshopExport.exportCSV) {
                    JunkshopExport.exportCSV(opts);
                } else {
                    console.error('Missing: JunkshopExport object handler for CSV targets.');
                }
            }
        });
    }

    // CALENDAR & INTERFACE LOGIC SYNC
    const allCheckboxes = document.querySelectorAll('.category-popover input[type="checkbox"], .popover-content input[type="checkbox"]');

    allCheckboxes.forEach(cb => {
        if (activeCategories.includes(cb.value.toLowerCase())) {
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
                ...new Set([...allCheckboxes].filter(c => c.checked).map(c => c.value.toLowerCase()))
            ];
            
            fetchAndRenderReportData(formatDateToSQL(selectedStart), formatDateToSQL(selectedEnd));
        });
    });

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
            fetchAndRenderReportData(formatDateToSQL(selectedStart), formatDateToSQL(selectedEnd));
        });
    });

    // 6. INITIAL RUN SEQUENCE
    getUserRole()
    rebuildAllCalendars();
    fetchAndRenderReportData(formatDateToSQL(selectedStart), formatDateToSQL(selectedEnd));
});
