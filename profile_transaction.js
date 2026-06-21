const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ITEMS_PER_PAGE = 10;
let currentPage        = 1;
let allTransactions    = [];
let filteredTransactions = [];
let profileId          = null;
let profileName        = '';

// Date filter state
let selectedStart = null;
let selectedEnd   = null;
let calYear       = new Date().getFullYear();
let calMonth      = new Date().getMonth();

const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
];

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    profileId = params.get('id');

    if (!profileId) {
        window.location.href = 'profiles.html';
        return;
    }

    fetchProfile();
    fetchTransactions();
    initDateRange();
});

// PROFILE
async function fetchProfile() {
    const { data: profile, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

    if (error || !profile) {
        console.error('Error fetching profile:', error?.message);
        return;
    }

    profileName = profile.display_name || profile.name || 'Unknown';

    document.getElementById('profileName').textContent = profileName;

    const emailEl = document.getElementById('profileEmail');
    emailEl.textContent = profile.email || profile.address || '';
    if (!profile.email && !profile.address) emailEl.style.display = 'none';

    const contactEl = document.getElementById('profileContact');
    contactEl.textContent = profile.contact_num || '';
    if (!profile.contact_num) contactEl.style.display = 'none';

    const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#00BCD4', '#FF5722', '#8BC34A'];
    const avatarEl = document.getElementById('profileAvatar');
    avatarEl.style.background = colors[profileName.charCodeAt(0) % colors.length];
    avatarEl.style.color = '#fff';

    document.title = `Profile — ${profileName}`;
    const firstName = profileName.split(' ')[0];
    document.getElementById('transactionsTitle').textContent = `${firstName}'s Transaction`;

    lucide.createIcons();
}

// TRANSACTIONS
async function fetchTransactions() {
    showLoadingRow();

    const { data: salesData, error: salesError } = await _supabase
        .from('sales')
        .select(`
            id,
            date,
            created_at,
            total_weight,
            total_amount,
            receipt_image,
            sale_items (
                weight,
                rate,
                amount,
                price_list ( material_name )
            )
        `)
        .eq('partner_id', profileId)
        .order('date', { ascending: false });

    const { data: collectionsData, error: collectionsError } = await _supabase
        .from('collections')
        .select(`
            id,
            date_collected,
            created_at,
            customer_name,
            address,
            contact_number,
            collection_items (
                weight,
                rate,
                subtotal,
                price_list ( material_name )
            )
        `)
        .eq('customer_id', profileId)
        .order('date_collected', { ascending: false });

    if (salesError)       console.error('Sales fetch error:', salesError.message);
    if (collectionsError) console.error('Collections fetch error:', collectionsError.message);

    const normalisedSales = (salesData || []).map(s => {
        const items = (s.sale_items || []).map(i => ({
            material: i.price_list?.material_name || 'Unknown',
            weight:   Number(i.weight) || 0,
            rate:     Number(i.rate)   || 0,
            subtotal: Number(i.amount) || 0
        }));
        const uniqueMaterials = [...new Set(items.map(i => i.material))];
        return {
            id:           s.id,
            source:       'sale',
            rawDate:      s.date || s.created_at,
            date:         formatDate(s.date || s.created_at),
            material:     items.length === 0 ? 'N/A'
                          : uniqueMaterials.length === 1 ? uniqueMaterials[0]
                          : `${uniqueMaterials.length} types`,
            weight:       Number(s.total_weight)  || 0,
            total:        Number(s.total_amount)  || 0,
            receiptImage: s.receipt_image || null,
            items
        };
    });

    const normalisedCollections = (collectionsData || []).map(c => {
        const items = (c.collection_items || []).map(i => ({
            material: i.price_list?.material_name || 'Unknown',
            weight:   Number(i.weight)   || 0,
            rate:     Number(i.rate)     || 0,
            subtotal: Number(i.subtotal) || 0
        }));
        const uniqueMaterials = [...new Set(items.map(i => i.material))];
        return {
            id:            c.id,
            source:        'collection',
            rawDate:       c.date_collected || c.created_at,
            date:          formatDate(c.date_collected || c.created_at),
            material:      items.length === 0 ? 'N/A'
                           : uniqueMaterials.length === 1 ? uniqueMaterials[0]
                           : `${uniqueMaterials.length} types`,
            weight:        items.reduce((sum, i) => sum + i.weight,   0),
            total:         items.reduce((sum, i) => sum + i.subtotal, 0),
            customerName:  c.customer_name  || null,
            contactNumber: c.contact_number || null,
            address:       c.address        || null,
            items
        };
    });

    allTransactions      = [...normalisedSales, ...normalisedCollections]
        .sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
    filteredTransactions = [...allTransactions];
    currentPage          = 1;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('txTableBody');
    tbody.innerHTML = '';

    if (filteredTransactions.length === 0) {
        renderEmptyState();
        renderPagination(0, 0);
        return;
    }

    const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const start     = (currentPage - 1) * ITEMS_PER_PAGE;
    const pageItems = filteredTransactions.slice(start, start + ITEMS_PER_PAGE);

    pageItems.forEach((tx, index) => {
        tbody.appendChild(buildMainRow(tx, index));
        tbody.appendChild(buildDetailRow(tx, index));
    });

    lucide.createIcons();
    renderPagination(filteredTransactions.length, totalPages);
}

function buildMainRow(tx, index) {
    const row = document.createElement('tr');
    row.className = 'tx-main-row';
    row.setAttribute('data-index', index);

    const weight      = tx.weight != null ? `${Number(tx.weight).toFixed(1)} kg` : '—';
    const total       = tx.total  != null ? `₱${Number(tx.total).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : '—';
    const sourceBadge = tx.source === 'sale'
        ? `<span class="source-badge source-sale">Sale</span>`
        : `<span class="source-badge source-collection">Collection</span>`;

    row.innerHTML = `
        <td class="td-expand">
            <button class="expand-btn" title="Expand" data-index="${index}">
                <i data-lucide="chevron-down"></i>
            </button>
        </td>
        <td class="td-date">${tx.date || '—'}</td>
        <td class="td-material">${tx.material || '—'} ${sourceBadge}</td>
        <td class="td-weight">${weight}</td>
        <td class="td-total">${total}</td>
        <td class="td-actions">
            <div class="tx-action-btns">
                <button class="tx-action-btn tx-btn-download" title="Download Receipt" data-id="${tx.id}">
                    <i data-lucide="arrow-down-to-line"></i>
                </button>
                <button class="tx-action-btn tx-btn-preview" title="Preview Receipt" data-id="${tx.id}">
                    <i data-lucide="eye"></i>
                </button>
            </div>
        </td>
    `;

    row.querySelector('.expand-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDetail(index);
    });

    row.querySelector('.tx-btn-download').addEventListener('click', (e) => {
        e.stopPropagation();
        tx.source === 'sale' ? downloadSaleReceipt(tx) : downloadCollectionReceipt(tx);
    });

    row.querySelector('.tx-btn-preview').addEventListener('click', (e) => {
        e.stopPropagation();
        tx.source === 'sale' ? previewSaleReceipt(tx) : previewCollectionReceipt(tx);
    });

    return row;
}

function buildDetailRow(tx, index) {
    const detailRow = document.createElement('tr');
    detailRow.id        = `sub-${index}`;
    detailRow.className = 'sub-row-container';

    const itemsHTML = (!tx.items || tx.items.length === 0)
        ? `<tr><td colspan="5" style="text-align:center; color:#94a3b8; padding:20px; font-style:italic;">
               No specific material item rows attached to this record.
           </td></tr>`
        : tx.items.map(i => `
            <tr>
                <td style="text-align:center;">${Number(i.weight).toFixed(1)}</td>
                <td style="text-align:center;">kg</td>
                <td style="text-align:left; padding-left:8px;">${i.material || 'Unknown'}</td>
                <td style="text-align:center;">₱${Number(i.rate).toFixed(2)}</td>
                <td style="text-align:center;">₱${Number(i.subtotal).toFixed(2)}</td>
            </tr>`).join('');

    detailRow.innerHTML = `
        <td colspan="6" style="padding:0 !important; border:none;">
            <div class="expanded-content">
                <table class="expanded-table">
                    <thead>
                        <tr>
                            <th style="text-align:center;">QTY</th>
                            <th style="text-align:center;">UNIT</th>
                            <th style="text-align:left; padding-left:8px;">DESCRIPTION</th>
                            <th style="text-align:center;">PRICE</th>
                            <th style="text-align:center;">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHTML}</tbody>
                </table>
                <div style="text-align:right; padding:15px 25px; border-top:1px solid #f1f5f9;">
                    <span style="font-size:13px; color:#64748b; margin-right:10px;">Total Amount:</span>
                    <span style="font-weight:700; color:#10b981;">₱${Number(tx.total).toFixed(2)}</span>
                </div>
            </div>
        </td>
    `;

    return detailRow;
}

function toggleDetail(index) {
    const subRow  = document.getElementById(`sub-${index}`);
    const mainRow = document.querySelector(`.tx-main-row[data-index="${index}"]`);
    if (!subRow || !mainRow) return;

    const isOpen = subRow.classList.contains('show');
    document.querySelectorAll('.sub-row-container').forEach(r => r.classList.remove('show'));
    document.querySelectorAll('.tx-main-row').forEach(r => r.classList.remove('open'));

    if (!isOpen) {
        subRow.classList.add('show');
        mainRow.classList.add('open');
    }
}

function showLoadingRow() {
    document.getElementById('txTableBody').innerHTML = `
        <tr class="loading-row">
            <td colspan="6">Loading transactions…</td>
        </tr>
    `;
}

function renderEmptyState() {
    document.getElementById('txTableBody').innerHTML = `
        <tr class="empty-state-row">
            <td colspan="6">
                <div class="empty-state-inner">
                    <i data-lucide="inbox"></i>
                    <p>No transactions found</p>
                </div>
            </td>
        </tr>
    `;
    lucide.createIcons();
}

function renderPagination(totalItems, totalPages) {
    const nav = document.getElementById('txPagination');
    if (!nav) return;

    if (totalItems <= ITEMS_PER_PAGE) {
        nav.innerHTML     = '';
        nav.style.display = 'none';
        return;
    }

    nav.style.display = 'flex';
    nav.innerHTML     = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.innerHTML = '<i data-lucide="chevron-left"></i>';
    prev.disabled  = currentPage === 1;
    prev.setAttribute('aria-label', 'Previous page');
    prev.addEventListener('click', () => { currentPage--; renderTable(); });
    nav.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.setAttribute('aria-label', `Page ${i}`);
        btn.addEventListener('click', () => { currentPage = i; renderTable(); });
        nav.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.innerHTML = '<i data-lucide="chevron-right"></i>';
    next.disabled  = currentPage === totalPages;
    next.setAttribute('aria-label', 'Next page');
    next.addEventListener('click', () => { currentPage++; renderTable(); });
    nav.appendChild(next);

    lucide.createIcons();
}

// DATE FILTER
function initDateRange() {
    const btn      = document.getElementById('dateRangeBtn');
    const popover  = document.getElementById('datePopover');
    const clearBtn = document.getElementById('clearDateBtn');

    btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = popover.getAttribute('aria-hidden') === 'false';
        isOpen ? closeCalPopover() : (popover.setAttribute('aria-hidden', 'false'), btn.setAttribute('aria-expanded', 'true'));
    });

    document.addEventListener('click', function (e) {
        if (!btn.contains(e.target) && !popover.contains(e.target)) closeCalPopover();
    });

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeCalPopover();
    });

    popover.addEventListener('click', function (e) { e.stopPropagation(); });

    clearBtn.addEventListener('click', function () {
        selectedStart = null;
        selectedEnd   = null;
        document.querySelectorAll('.quick-dates li button').forEach(b => b.classList.remove('active'));
        buildCalendar();
        applyFilter();
    });

    document.getElementById('calPrev').addEventListener('click', function () {
        calMonth--;
        if (calMonth < 0) { calMonth = 11; calYear--; }
        buildCalendar();
    });

    document.getElementById('calNext').addEventListener('click', function () {
        calMonth++;
        if (calMonth > 11) { calMonth = 0; calYear++; }
        buildCalendar();
    });

    document.querySelectorAll('.quick-dates li button').forEach(function (qBtn) {
        qBtn.addEventListener('click', function () {
            document.querySelectorAll('.quick-dates li button').forEach(b => b.classList.remove('active'));
            qBtn.classList.add('active');

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const range = qBtn.getAttribute('data-range');

            if (range === 'yesterday') {
                const y = new Date(today);
                y.setDate(today.getDate() - 1);
                selectedStart = new Date(y);
                selectedEnd   = new Date(y);
            } else if (range === 'last-week') {
                const endLW = new Date(today);
                endLW.setDate(today.getDate() - today.getDay() - 1);
                const startLW = new Date(endLW);
                startLW.setDate(endLW.getDate() - 6);
                selectedStart = startLW;
                selectedEnd   = endLW;
            } else if (range === 'last-month') {
                selectedStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                selectedEnd   = new Date(today.getFullYear(), today.getMonth(), 0);
            } else if (range === 'last-quarter') {
                const q = Math.floor(today.getMonth() / 3);
                selectedStart = new Date(today.getFullYear(), (q - 1) * 3, 1);
                selectedEnd   = new Date(today.getFullYear(), q * 3, 0);
            }

            buildCalendar();
            applyFilter();
        });
    });

    buildCalendar();
}

function closeCalPopover() {
    const popover = document.getElementById('datePopover');
    const btn     = document.getElementById('dateRangeBtn');
    if (popover) popover.setAttribute('aria-hidden', 'true');
    if (btn)     btn.setAttribute('aria-expanded', 'false');
}

function buildCalendar() {
    const tbody = document.getElementById('calBody');
    const label = document.getElementById('calMonthLabel');
    if (!tbody) return;

    if (label) label.textContent = monthNames[calMonth] + ' ' + calYear;
    tbody.innerHTML = '';

    const today       = new Date();
    const firstDay    = new Date(calYear, calMonth, 1).getDay();
    const startOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    let day = 1 - startOffset;

    for (let row = 0; row < 6; row++) {
        const tr = document.createElement('tr');
        let rowHasDays = false;

        for (let col = 0; col < 7; col++, day++) {
            const td  = document.createElement('td');
            const btn = document.createElement('button');
            btn.type  = 'button';

            if (day < 1 || day > daysInMonth) {
                btn.textContent = new Date(calYear, calMonth, day).getDate();
                btn.classList.add('other-month');
                btn.disabled = true;
            } else {
                rowHasDays    = true;
                btn.textContent = day;
                const thisDate  = new Date(calYear, calMonth, day);

                if (today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day) {
                    btn.classList.add('today');
                }

                applyRangeClasses(btn, thisDate);
                btn.addEventListener('click', () => onDateClick(thisDate));
            }

            td.appendChild(btn);
            tr.appendChild(td);
        }

        if (rowHasDays || row === 0) tbody.appendChild(tr);
    }

    lucide.createIcons();
    updateBtnLabel();
}

function applyRangeClasses(btn, date) {
    btn.classList.remove('selected', 'range-start', 'range-end', 'in-range');
    if (!selectedStart) return;

    const t = date.getTime();
    const s = selectedStart.getTime();

    if (!selectedEnd) {
        if (t === s) btn.classList.add('selected');
        return;
    }

    const e = selectedEnd.getTime();
    if      (t === s)        btn.classList.add('range-start');
    else if (t === e)        btn.classList.add('range-end');
    else if (t > s && t < e) btn.classList.add('in-range');
}

function onDateClick(date) {
    if (!selectedStart || (selectedStart && selectedEnd)) {
        selectedStart = date;
        selectedEnd   = null;
    } else {
        if (date < selectedStart) {
            selectedEnd   = selectedStart;
            selectedStart = date;
        } else {
            selectedEnd = date;
        }
    }
    buildCalendar();
    applyFilter();
}

function updateBtnLabel() {
    const btn = document.getElementById('dateRangeBtn');
    if (!btn) return;
    if (selectedStart && selectedEnd) {
        btn.childNodes[btn.childNodes.length - 1].textContent = ' ' + fmtShort(selectedStart) + ' — ' + fmtShort(selectedEnd);
    } else if (selectedStart) {
        btn.childNodes[btn.childNodes.length - 1].textContent = ' ' + fmtShort(selectedStart);
    } else {
        btn.childNodes[btn.childNodes.length - 1].textContent = ' Search Date Range';
    }
}

function applyFilter() {
    if (!selectedStart && !selectedEnd) {
        filteredTransactions = [...allTransactions];
    } else {
        filteredTransactions = allTransactions.filter(tx => {
            const txDate = new Date(tx.rawDate);
            txDate.setHours(0, 0, 0, 0);
            const s = selectedStart ? selectedStart.getTime() : null;
            const e = selectedEnd   ? selectedEnd.getTime()   : s;
            const t = txDate.getTime();
            if (s && t < s) return false;
            if (e && t > e) return false;
            return true;
        });
    }
    currentPage = 1;
    renderTable();
}

// EDIT PROFILE
// RECEIPTS
function buildCollectionReceiptHTML(tx) {
    var itemRows = (tx.items && tx.items.length > 0)
        ? tx.items.map(function(i) {
            return `
            <tr>
                <td style="font-size:7.5px;padding:2px 3px;border:0.5px solid #111;text-align:center;color:#111;vertical-align:top;">${Number(i.weight).toFixed(1)}</td>
                <td style="font-size:7.5px;padding:2px 3px;border:0.5px solid #111;text-align:center;color:#111;vertical-align:top;">kg</td>
                <td style="font-size:7.5px;padding:2px 3px;border:0.5px solid #111;text-align:left;color:#111;vertical-align:top;">${i.material || ''}</td>
                <td style="font-size:7.5px;padding:2px 3px;border:0.5px solid #111;text-align:center;color:#111;vertical-align:top;">&#8369;${Number(i.rate).toFixed(2)}</td>
                <td style="font-size:7.5px;padding:2px 3px;border:0.5px solid #111;text-align:center;color:#111;vertical-align:top;">&#8369;${Number(i.subtotal).toFixed(2)}</td>
            </tr>`;
        }).join('')
        : '';

    var emptyCount = Math.max(0, 8 - (tx.items ? tx.items.length : 0));
    var emptyRows  = Array(emptyCount).fill(
        `<tr>
            <td style="font-size:7.5px;padding:0;border:0.5px solid #111;height:13px;"></td>
            <td style="font-size:7.5px;padding:0;border:0.5px solid #111;height:13px;"></td>
            <td style="font-size:7.5px;padding:0;border:0.5px solid #111;height:13px;"></td>
            <td style="font-size:7.5px;padding:0;border:0.5px solid #111;height:13px;"></td>
            <td style="font-size:7.5px;padding:0;border:0.5px solid #111;height:13px;"></td>
        </tr>`
    ).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Collection Receipt</title>
<style>
  @page { size: A5 landscape; margin: 6mm 8mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 8px; color: #111; width: 95mm; max-width: 95mm; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>

<div class="receipt-preview" style="background:white;padding:5px 8px;font-family:Arial,sans-serif;font-size:8px;color:#111;border:1px solid #111;">

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:6px;padding-bottom:5px;border-bottom:1px solid #111;margin-bottom:5px;">
    <img src="photo/tezwa_logo.jpg" alt="Logo" onerror="this.style.display='none'" style="width:32px;height:auto;object-fit:contain;border-radius:50%;flex-shrink:0;">
    <div style="flex:1;text-align:center;">
      <h3 style="font-size:8px;font-weight:700;color:#0ea5e9;text-transform:uppercase;margin:0 0 1px 0;letter-spacing:0.2px;">TAGUMPAY 83ZERO WASTE ASSOCIATION</h3>
      <p style="font-size:7px;color:#444;margin:1px 0;line-height:1.3;">South Nagtahan, Brgy. 830, Zone 90 District VI, Paco, Manila</p>
      <p style="font-size:7px;color:#444;margin:1px 0;line-height:1.3;">Email: <a style="color:#0ea5e9;text-decoration:underline;">tezwa.manila@gmail.com</a></p>
      <p style="font-size:7px;color:#444;margin:1px 0;line-height:1.3;">Contact No.: 0927-286-7378</p>
    </div>
  </div>

  <!-- Receipt No. + Date -->
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:4px;gap:10px;">
    <div style="display:flex;align-items:flex-end;gap:3px;flex:1;">
      <label style="font-size:8px;font-weight:700;white-space:nowrap;color:#111;">Cash Receipt No.</label>
      <div style="flex:1;border-bottom:0.5px solid #111;min-width:40px;font-size:8px;color:#111;padding-bottom:1px;min-height:10px;">${tx.id ? String(tx.id).slice(-6).toUpperCase() : ''}</div>
    </div>
    <div style="display:flex;align-items:flex-end;gap:3px;flex:1;">
      <label style="font-size:8px;font-weight:700;white-space:nowrap;color:#111;">Date</label>
      <div style="flex:1;border-bottom:0.5px solid #111;min-width:40px;font-size:8px;color:#111;padding-bottom:1px;min-height:10px;">${tx.date || ''}</div>
    </div>
  </div>

  <!-- Customer fields -->
  <div style="display:flex;flex-direction:column;gap:3px;margin-bottom:5px;">
    <div style="display:flex;gap:10px;">
      <div style="display:flex;align-items:flex-end;gap:3px;flex:1;">
        <label style="font-size:8px;font-weight:700;white-space:nowrap;color:#111;">Customer</label>
        <div style="flex:1;border-bottom:0.5px solid #111;font-size:8px;color:#111;padding-bottom:1px;min-height:10px;">${tx.customerName || profileName || ''}</div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:3px;flex:1;">
        <label style="font-size:8px;font-weight:700;white-space:nowrap;color:#111;">Contact No.</label>
        <div style="flex:1;border-bottom:0.5px solid #111;font-size:8px;color:#111;padding-bottom:1px;min-height:10px;">${tx.contactNumber || ''}</div>
      </div>
    </div>
    <div style="display:flex;gap:10px;">
      <div style="display:flex;align-items:flex-end;gap:3px;flex:1;">
        <label style="font-size:8px;font-weight:700;white-space:nowrap;color:#111;">Address</label>
        <div style="flex:1;border-bottom:0.5px solid #111;font-size:8px;color:#111;padding-bottom:1px;min-height:10px;">${tx.address || ''}</div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:3px;flex:1;">
        <label style="font-size:8px;font-weight:700;white-space:nowrap;color:#111;">Salesman</label>
        <div style="flex:1;border-bottom:0.5px solid #111;font-size:8px;color:#111;padding-bottom:1px;min-height:10px;"></div>
      </div>
    </div>
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;border:0.75px solid #111;margin-bottom:5px;">
    <thead>
      <tr>
        <th style="font-size:7.5px;font-weight:700;text-transform:uppercase;text-align:center;padding:3px 2px;border:0.75px solid #111;background:white;color:#111;letter-spacing:0.2px;">QTY</th>
        <th style="font-size:7.5px;font-weight:700;text-transform:uppercase;text-align:center;padding:3px 2px;border:0.75px solid #111;background:white;color:#111;letter-spacing:0.2px;">UNIT</th>
        <th style="font-size:7.5px;font-weight:700;text-transform:uppercase;text-align:left;padding:3px 2px;border:0.75px solid #111;background:white;color:#111;letter-spacing:0.2px;">DESCRIPTION</th>
        <th style="font-size:7.5px;font-weight:700;text-transform:uppercase;text-align:center;padding:3px 2px;border:0.75px solid #111;background:white;color:#111;letter-spacing:0.2px;">PRICE</th>
        <th style="font-size:7.5px;font-weight:700;text-transform:uppercase;text-align:center;padding:3px 2px;border:0.75px solid #111;background:white;color:#111;letter-spacing:0.2px;">AMOUNT</th>
      </tr>
    </thead>
    <tbody>${itemRows}${emptyRows}</tbody>
  </table>

  <!-- Total -->
  <div style="text-align:right;font-size:8.5px;font-weight:700;color:#111;margin-bottom:5px;padding-top:3px;border-top:1px solid #111;">
    TOTAL: <strong style="color:#46B336;font-size:9px;">&#8369;${Number(tx.total).toFixed(2)}</strong>
  </div>

  <!-- Signatures -->
  <div style="display:flex;justify-content:space-between;margin-top:6px;padding-top:3px;">
    <div style="display:flex;flex-direction:column;gap:2px;width:45%;">
      <span style="font-size:8px;font-weight:700;color:#111;">Received By:</span>
      <div style="border-bottom:0.5px solid #111;width:100%;margin-top:14px;"></div>
      <span style="font-size:7px;font-weight:600;color:#111;text-align:center;margin-top:2px;">Signature Over Printed Name</span>
    </div>
    <div style="display:flex;flex-direction:column;gap:2px;width:45%;">
      <span style="font-size:8px;font-weight:700;color:#111;">Approved By:</span>
      <div style="border-bottom:0.5px solid #111;width:100%;margin-top:14px;"></div>
      <span style="font-size:7px;font-weight:600;color:#111;text-align:center;margin-top:2px;">Signature Over Printed Name</span>
    </div>
  </div>

</div>
</body>
</html>`;
}

function previewCollectionReceipt(tx) {
    openReceiptModal(buildCollectionReceiptHTML(tx), 'collection', null);
}

function downloadCollectionReceipt(tx) {
    const safeDate = (tx.date || 'receipt').replace(/[\/\\:]/g, '-');
    const safeName = (tx.customerName || profileName || 'customer').replace(/\s+/g, '_');
    const filename = `collection-receipt_${safeName}_${safeDate}.pdf`;

    const html = buildCollectionReceiptHTML(tx);
    const iframe = document.createElement('iframe');
    // Give iframe a fixed width
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:400px;height:600px;border:none;visibility:hidden;';
    document.body.appendChild(iframe);

    iframe.onload = async () => {
        try {
            const receiptEl = iframe.contentDocument.querySelector('.receipt-preview');
            if (!receiptEl) throw new Error('Receipt element not found');

            // Add 2px extra
            const captureW = receiptEl.scrollWidth + 4;
            const captureH = receiptEl.scrollHeight + 4;

            const canvas = await html2canvas(receiptEl, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                width: captureW,
                height: captureH
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.98);

            // A5 landscape
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });

            const pageW = pdf.internal.pageSize.getWidth();   // 210
            const pageH = pdf.internal.pageSize.getHeight();  // 148

            // Fit receipt into left half
            const margin = 5;
            const maxW = (pageW / 2) - margin * 2;
            const maxH = pageH - margin * 2;
            const imgW = canvas.width;
            const imgH = canvas.height;
            // Scale to fill full height, cap at half-page width
            const ratio = maxH / imgH;
            const drawH = maxH;
            const drawW = Math.min(imgW * ratio, maxW);
            const x = margin;
            const y = margin;

            pdf.addImage(imgData, 'JPEG', x, y, drawW, drawH);
            pdf.save(filename);
        } catch (err) {
            console.error('PDF generation failed:', err);
            alert('Could not generate PDF. Please try again.');
        } finally {
            document.body.removeChild(iframe);
        }
    };

    iframe.srcdoc = html;
}

function previewSaleReceipt(tx) {
    if (!tx.receiptImage) { alert('No receipt image uploaded for this sale.'); return; }
    openReceiptModal(null, 'sale', tx.receiptImage);
}

function downloadSaleReceipt(tx) {
    if (!tx.receiptImage) { alert('No receipt image uploaded for this sale.'); return; }
    const a = document.createElement('a');
    a.href     = tx.receiptImage;
    a.download = `sale-receipt-${tx.id}.jpg`;
    a.target   = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function openReceiptModal(html, type, imageUrl) {
    let modal = document.getElementById('receiptViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id        = 'receiptViewModal';
        modal.className = 'receipt-view-overlay';
        modal.innerHTML = `
            <div class="receipt-view-container">
                <button class="receipt-view-close" id="receiptViewClose" aria-label="Close">
                    <i data-lucide="x"></i>
                </button>
                <div class="receipt-view-body" id="receiptViewBody"></div>
            </div>`;
        document.body.appendChild(modal);
        document.getElementById('receiptViewClose').addEventListener('click', closeReceiptModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeReceiptModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeReceiptModal(); });
    }

    const body = document.getElementById('receiptViewBody');
    body.innerHTML = '';

    if (type === 'collection') {
        const iframe = document.createElement('iframe');
        iframe.className = 'receipt-view-iframe';
        iframe.srcdoc    = html;
        body.appendChild(iframe);
    } else {
        const img = document.createElement('img');
        img.src       = imageUrl;
        img.className = 'receipt-view-image';
        img.alt       = 'Sale Receipt';
        body.appendChild(img);
    }

    modal.classList.add('show');
    lucide.createIcons();
}

function closeReceiptModal() {
    const modal = document.getElementById('receiptViewModal');
    if (modal) modal.classList.remove('show');
}

// HELPERS
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}-${dd}-${yy}`;
}

function fmtShort(date) {
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
}
