// CONFIGURATION
const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';
window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 🟩 FIXED GLOBAL APP STATE (Explicitly shared with the window context)
window.collections = [];
window.currentItems = [];       // Changed from let to window.
window.currentCategory = 'School'; // Changed from let to window.
window.editingIndex = -1;       // Changed from let to window.
let currentPage = 1;
let currentFilter = 'all';
const itemsPerPage = 10;

// 1. INITIALIZATION
document.addEventListener('DOMContentLoaded', async () => {
    loadModalHTML();
    setupSearch();
    await fetchAllCollections();
});

// Helper utility to safely re-trigger Lucide icons across components
function refreshIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Helper utility to convert YYYY-MM-DD string to MM-DD-YYYY
function formatDateToMDY(dateString) {
    if (!dateString) return 'N/A';
    // Splits the 'YYYY-MM-DD' format explicitly to prevent timezone shifts
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; 
    const [year, month, day] = parts;
    return `${month}-${day}-${year}`;
}    

// 2. DATA MANAGEMENT (FETCH)
window.fetchAllCollections = async function() {
    console.log("Fetching collections from Supabase...");
    
    const { data, error } = await _supabase
        .from('collections')
        .select(`
            *, 
            collection_items (
                *,
                price_list (
                    material_name
                )
            )
        `)
        .order('date_collected', { ascending: false })
        .order('id', { ascending: false });

    if (error) {
        console.error("Error fetching data from Supabase:", error.message);
        return;
    }

    console.log("Raw Data Received:", data);

    window.collections = data.map(col => {
        // Safe extraction of collection items
        const rawItems = col.collection_items || [];
        
    // Locate this block inside window.fetchAllCollections inside collection.js
    const mappedItems = rawItems.map(item => {
        let materialName = 'Unknown';
        
        // Check if the relation object exists and isn't null
        if (item.price_list) {
            if (Array.isArray(item.price_list) && item.price_list.length > 0) {
                materialName = item.price_list[0].material_name || 'Unknown';
            } else if (item.price_list.material_name) {
                materialName = item.price_list.material_name;
            }
        } else if (item.material_name) {
            // Fallback for flat tables or alternative inserts
            materialName = item.material_name;
        }
        
        return {
            material: materialName,
            rate: parseFloat(item.rate) || 0,
            weight: parseFloat(item.weight) || 0,
            subtotal: parseFloat(item.subtotal) || 0
        };
    });

        // Map database fields directly to the keys your renderTable() expects
        return {
            id: col.id,
            date: formatDateToMDY(col.date_collected),
            customer: col.customer_name,
            category: col.type || 'School',
            totalAmount: mappedItems.reduce((sum, i) => sum + i.subtotal, 0),
            totalWeight: mappedItems.reduce((sum, i) => sum + i.weight, 0),
            address: col.address,
            contact: col.contact_number,
            items: mappedItems // Crucial: This populates the expanded sub-rows
        };
    });

    console.log("Parsed Collections State:", window.collections);
    renderTable();
};

// CORE FILTER DATA PROVIDER
function getFilteredCollections() {
    if (currentFilter === 'all') return window.collections;
    return window.collections.filter(col => 
        col.category && col.category.toLowerCase() === currentFilter.toLowerCase()
    );
}

// 3. UI GENERATION & RENDERING
function loadModalHTML() {
    fetch('add_collection.html')
        .then(res => res.text())
        .then(html => {
            document.getElementById('modalContainer').innerHTML = html;

            const weightInput = document.getElementById('inWeight');
            if (weightInput) {
                weightInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        addItem();
                    }
                });
            }

            // Intercept form submission or bind update buttons dynamically
            const form = document.querySelector('#modalContainer form') || document.getElementById('collectionForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await saveCollection();
                });
            } else {
                // Fallback direct binding on update action buttons if form wrappers aren't present
                const submitBtn = document.querySelector('.btn-submit-green') || document.querySelector('.btn-update');
                if (submitBtn) {
                    submitBtn.addEventListener('click', async (e) => {
                        e.preventDefault();
                        await saveCollection();
                    });
                }
            }

            if (typeof setupFieldListeners === 'function') setupFieldListeners();
            refreshIcons();
        })
        .catch(() => console.log('Using fallback inline HTML modal configuration'));
}

function renderTable() {
    const tbody = document.getElementById('collectionTableBody');
    if (!tbody) return;

    const filtered = getFilteredCollections();
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const pageCollections = filtered.slice(startIdx, startIdx + itemsPerPage);

    tbody.innerHTML = '';

    if (pageCollections.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:#94a3b8;">No collections found</td></tr>`;
        updatePagination(totalPages);
        return;
    }

    pageCollections.forEach((collection, pageIndex) => {
        const actualIndex = startIdx + pageIndex;
        const rowId = `col-${actualIndex}`;

        let materialSummary = 'N/A';
        if (collection.items && collection.items.length > 0) {
            const uniqueMaterials = [...new Set(collection.items.map(item => item.material))];
            materialSummary = uniqueMaterials.length === 1 ? uniqueMaterials[0] : `${uniqueMaterials.length} types`;
        }

        tbody.innerHTML += `
          <tr class="main-row" data-row-idx="${actualIndex}" onclick="toggleDetails('${rowId}', this)">
            <td class="chevron-cell"><i data-lucide="chevron-down" style="width:18px;"></i></td>
            <td>${collection.date}</td>
            <td><span class="id-badge">${collection.id}</span></td>
            <td style="font-weight:600;">${collection.customer}</td>
            <td><span style="color:#64748b;">${materialSummary}</span></td>
            <td style="text-align:center">${collection.totalWeight.toFixed(1)} kg</td>
            <td style="text-align:right; font-weight:700; color:#10b981;">₱${collection.totalAmount.toFixed(2)}</td>
            <td onclick="event.stopPropagation()">
              <div class="action-btns">
                <button class="icon-btn receipt-btn" onclick="viewReceipt(${actualIndex})"><i data-lucide="image"></i></button>
                <button class="icon-btn" onclick="editEntry(${actualIndex})"><i data-lucide="edit-2"></i></button>
                <button class="icon-btn delete" onclick="deleteEntry(${actualIndex})"><i data-lucide="trash-2"></i></button>
              </div>
            </td>
          </tr>
          <tr id="${rowId}" class="sub-row-container">
            <td colspan="8" style="padding:0 !important; border:none;">
              <div class="expanded-content">
                <table class="expanded-table">
                    <thead>
                        <tr>
                          <th style="text-align:center;">QTY</th>
                          <th style="text-align:center;">UNIT</th>
                          <th style="text-align:left; padding-left:0px;">DESCRIPTION</th>
                          <th style="text-align:center;">PRICE</th>
                          <th style="text-align:center;">AMOUNT</th>
                        </tr>
                      </thead>
                    <tbody>${buildReceiptItemRows(collection.items || [], 0)}</tbody>
                </table>
              </div>
            </td>
          </tr>`;
    });

    refreshIcons();
    updatePagination(totalPages);
}

function updatePagination(totalPages) {
    const pagination = document.querySelector('.pagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';

    let paginationHTML = `
        <button class="page-btn" onclick="changePage('prev')" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''}>
          <i data-lucide="chevron-left"></i>
        </button>
        <button class="page-btn ${currentPage === 1 ? 'active' : ''}" onclick="goToPage(1)">1</button>
    `;

    if (currentPage > 3) {
        paginationHTML += `<span class="page-btn" style="cursor: default; border: none;">...</span>`;
    }

    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        paginationHTML += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    if (currentPage < totalPages - 2) {
        paginationHTML += `<span class="page-btn" style="cursor: default; border: none;">...</span>`;
    }

    paginationHTML += `
        <button class="page-btn ${currentPage === totalPages ? 'active' : ''}" onclick="goToPage(${totalPages})">${totalPages}</button>
        <button class="page-btn" onclick="changePage('next')" aria-label="Next page" ${currentPage === totalPages ? 'disabled' : ''}>
          <i data-lucide="chevron-right"></i>
        </button>
    `;

    pagination.innerHTML = paginationHTML;
    refreshIcons();
}

// 4. INTERACTION & UTILITIES
window.goToPage = function(page) {
    currentPage = page;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.changePage = function(direction) {
    const totalPages = Math.ceil(getFilteredCollections().length / itemsPerPage);
    if (direction === 'prev' && currentPage > 1) currentPage--;
    if (direction === 'next' && currentPage < totalPages) currentPage++;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.toggleDetails = function(id, rowEl) {
    const subRow = document.getElementById(id);
    if (!subRow) return;

    const isOpen = subRow.classList.contains('show');
    document.querySelectorAll('.sub-row-container').forEach(r => r.classList.remove('show'));
    document.querySelectorAll('.main-row').forEach(r => r.classList.remove('open'));

    if (!isOpen) {
        subRow.classList.add('show');
        rowEl.classList.add('open');
    }
};

window.filterByCategory = function(category, btn) {
    currentFilter = category;
    currentPage = 1;
    document.querySelectorAll('.table-tabs .tab').forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');
    renderTable();
};

function setupSearch() {
    const searchInput = document.getElementById('collectionSearch');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.main-row').forEach(row => {
            const text = row.innerText.toLowerCase();
            const actualIndex = row.getAttribute('data-row-idx');
            const subRow = document.getElementById(`col-${actualIndex}`);

            if (text.includes(searchTerm)) {
                row.style.display = '';
                if (subRow && row.classList.contains('open')) subRow.style.display = 'table-row';
            } else {
                row.style.display = 'none';
                if (subRow) subRow.style.display = 'none';
            }
        });
    });
}

// 5. DATA MODIFICATION MATCHES (EDIT / SAVE / DELETE)
window.editEntry = function(index) {
    editingIndex = index;
    const data = getFilteredCollections()[index]; // Source data accurately from filtered collections context
    const modal = document.getElementById('addCollectionModal');
    if (!modal || !data) return;

    document.getElementById('inCustomer').value = data.customer;
    document.getElementById('inAddress').value = data.address || '';
    document.getElementById('inContact').value = data.contact || '';
    
    // Convert 'MM-DD-YYYY' back to 'YYYY-MM-DD' for the native HTML date input field
    if (data.date && data.date.includes('-')) {
        const parts = data.date.split('-');
        if (parts.length === 3) {
            const [month, day, year] = parts;
            document.getElementById('inDate').value = `${year}-${month}-${day}`;
        } else {
            document.getElementById('inDate').value = data.date;
        }
    } else {
        document.getElementById('inDate').value = data.date;
    }

    currentCategory = data.category;
    document.querySelectorAll('.m-tab').forEach(tab => {
        tab.classList.toggle('active', tab.innerText.trim() === data.category);
    });

    currentItems = [...(data.items || [])];
    if (typeof renderItems === 'function') renderItems();

    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="check"></i> Update';

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    if (typeof updatePreview === 'function') updatePreview();
    setTimeout(refreshIcons, 100);
};

// NEW SUBMISSION HANDLER THAT UPDATES BOTH THE COLLECTION ENTRY AND THE ITEMS ARRAY
async function saveCollection() {
    const customer = document.getElementById('inCustomer').value;
    const address = document.getElementById('inAddress').value;
    const contact = document.getElementById('inContact').value;
    const date = document.getElementById('inDate').value;

    if (!customer || !date) {
        alert("Customer name and Date are required fields.");
        return;
    }

    const collectionData = {
        customer_name: customer,
        address: address,
        contact_number: contact,
        date_collected: date,
        type: currentCategory
    };

    try {
        if (editingIndex > -1) {
            // --- EDIT MODE ---
            const originalCollection = getFilteredCollections()[editingIndex];
            const collectionId = originalCollection.id;

            // 1. Update Collection Parent Details
            const { error: updateCollectionError } = await _supabase
                .from('collections')
                .update(collectionData)
                .eq('id', collectionId);

            if (updateCollectionError) throw updateCollectionError;

            // 2. Clear old items associated with this specific collection id
            const { error: deleteItemsError } = await _supabase
                .from('collection_items')
                .delete()
                .eq('collection_id', collectionId);

            if (deleteItemsError) throw deleteItemsError;

            // 3. Map and Insert updated array back into sub-table
            if (currentItems.length > 0) {
                // Map your objects to explicitly match your database column parameters
                const itemsToInsert = currentItems.map(item => ({
                    collection_id: collectionId,
                    material_id: item.materialId, // Ensure you store and pass the numeric ID from your selector here!
                    rate: item.rate,
                    weight: item.weight,
                    subtotal: item.subtotal
                }));

                const { error: insertItemsError } = await _supabase
                    .from('collection_items')
                    .insert(itemsToInsert);

                if (insertItemsError) throw insertItemsError;
            }

            alert("Collection updated successfully!");
        } else {
            // --- INSERT MODE ---
            const { data: newCollection, error: insertCollectionError } = await _supabase
                .from('collections')
                .insert([collectionData])
                .select();
            
            if (insertCollectionError) throw insertCollectionError;
            
            if (currentItems.length > 0 && newCollection && newCollection.length > 0) {
                const collectionId = newCollection[0].id;
                const itemsToInsert = currentItems.map(item => ({
                    collection_id: collectionId,
                    material_id: item.materialId, //  Changed from material_name to match your schema constraint
                    rate: item.rate,
                    weight: item.weight,
                    subtotal: item.subtotal
                }));
            
                const { error: insertItemsError } = await _supabase
                    .from('collection_items')
                    .insert(itemsToInsert);
            
                if (insertItemsError) throw insertItemsError;
            }
            alert("Collection saved successfully!");
        }

        // Close modal, reset layout tracking variables and sync view state
        closeModal();
        await fetchAllCollections();

    } catch (err) {
        console.error("Database mutation error:", err);
        alert("Failed to save collection updates: " + err.message);
    }
}

// Clean UI closure functionality resets tracking values safely
function closeModal() {
    const modal = document.getElementById('addCollectionModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
    
    // Clear dynamic global forms parameters back to original entry states
    editingIndex = -1;
    currentItems = [];
    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="plus"></i> Submit';
}

window.deleteEntry = function(index) {
    const filteredList = getFilteredCollections();
    const collection = filteredList[index];
    if (!collection) return;

    if (!document.getElementById('deleteConfirmModal')) {
        const modalHTML = `
          <div id="deleteConfirmModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.45); z-index:3000; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
            <div style="background:white; border-radius:20px; padding:36px 32px 28px; width:360px; max-width:90vw; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,0.2);">
              <div style="width:64px; height:64px; background:#fef2f2; border-radius:50%; display:flex; align-items:center; justify-content:center; margin:0 auto 18px;">
                <i data-lucide="trash-2" style="width:28px;height:28px;color:#ef4444;"></i>
              </div>
              <h3 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px;">Delete Collection</h3>
              <p id="deleteConfirmText" style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.5;"></p>
              <div style="display:flex;gap:12px;">
                <button id="deleteCancelBtn" style="flex:1; padding:12px; border-radius:10px; border:1px solid #e5e7eb; background:white; font-size:14px; font-weight:600; color:#374151; cursor:pointer; font-family:inherit;">Cancel</button>
                <button id="deleteConfirmBtn" style="flex:1; padding:12px; border-radius:10px; border:none; background:#ef4444; color:white; font-size:14px; font-weight:600; cursor:pointer; font-family:inherit;">Delete</button>
              </div>
            </div>
          </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        refreshIcons();
    }

    const modal = document.getElementById('deleteConfirmModal');
    document.getElementById('deleteConfirmText').textContent = `Are you sure you want to delete the collection for "${collection.customer}"? This action cannot be undone.`;
    modal.style.display = 'flex';

    // Event handlers cleanup to prevent multiple event fires on stale instances
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const cancelBtn = document.getElementById('deleteCancelBtn');
    
    // Locate this block in your code and replace confirmBtn.onclick with this:
    confirmBtn.onclick = async () => {
        try {
            // 1. Delete associated child items first to satisfy the foreign key constraint
            const { error: itemsDeleteError } = await _supabase
                .from('collection_items')
                .delete()
                .eq('collection_id', collection.id);
    
            if (itemsDeleteError) throw itemsDeleteError;
    
            // 2. Now it's perfectly safe to delete the parent collection record
            const { error: collectionDeleteError } = await _supabase
                .from('collections')
                .delete()
                .eq('id', collection.id);
                
            if (collectionDeleteError) throw collectionDeleteError;
    
            // 3. Update local state array & UI tracking view
            window.collections = window.collections.filter(c => c.id !== collection.id);
            renderTable();
            
            modal.style.display = 'none';
            alert("Collection deleted successfully.");
        } catch (err) {
            console.error("Deletion lifecycle failure:", err);
            alert("Error deleting record: " + err.message);
        }
    };

    cancelBtn.onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
};

// 6. RECEIPT COMPONENT ENGINE
function buildReceiptItemRows(items, minRows) {
    let rows = items.map(item => `
      <tr>
        <td style="text-align:center;">${item.weight}</td>
        <td style="text-align:center;">kg</td>
        <td style="text-align:left; padding-left:8px;">${item.material}</td>
        <td style="text-align:center;">₱${item.rate}</td>
        <td style="text-align:center;">₱${item.subtotal.toFixed(2)}</td>
      </tr>
    `).join('');

    const emptyCount = Math.max(0, minRows - items.length);
    for (let i = 0; i < emptyCount; i++) {
        rows += `<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
    return rows;
}

window.viewReceipt = function(index) {
    const data = getFilteredCollections()[index];
    if (!data) return;

    const receiptHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <base href="${window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1)}">
      <title>Receipt - ${data.customer}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 30px 20px; }
        .receipt { background: white; border: 2px solid #333; padding: 30px 36px; max-width: 700px; margin: 0 auto; font-size: 12px; color: #111; }
        .receipt-header { display: flex; align-items: center; gap: 20px; padding-bottom: 16px; border-bottom: 2px solid #111; margin-bottom: 20px; }
        .receipt-header img { width: 70px; height: 70px; object-fit: contain; }
        .org-info { flex: 1; text-align: center; }
        .org-info h2 { font-size: 15px; font-weight: 800; color: #0ea5e9; text-transform: uppercase; margin-bottom: 4px; }
        .org-info p { font-size: 11px; color: #444; margin: 2px 0; }
        .org-info a { color: #0ea5e9; }
        .field-row { display: flex; gap: 30px; margin-bottom: 18px; }
        .field-item { display: flex; align-items: flex-end; gap: 6px; flex: 1; }
        .field-item label { font-size: 11px; font-weight: 700; white-space: nowrap; color: #111; }
        .field-value { flex: 1; border-bottom: 1.5px solid #111; font-size: 11px; color: #111; padding-bottom: 2px; min-height: 16px; overflow: hidden; word-break: break-all; min-width: 0; }
        table { width: 100%; border-collapse: collapse; border: 1.5px solid #111; margin-bottom: 10px; table-layout: fixed; word-break: break-word;}
        th { font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center; padding: 8px 6px; border: 1.5px solid #111; background: white; color: #111; letter-spacing: 0.3px; }
        th:nth-child(3) { text-align: left; padding-left: 8px; }
        td { font-size: 11px; padding: 10px 6px; border: 1px solid #111; text-align: center; color: #111; vertical-align: top; }
        .empty-row td { height: 30px; padding: 0; }
        .receipt-total { text-align: right; font-size: 13px; font-weight: 800; padding-top: 6px; border-top: 2px solid #111; margin-bottom: 30px; color: #111; }
        .receipt-total span { color: #46B336; font-size: 14px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 20px; }
        .sig-block { width: 45%; }
        .sig-block p { font-size: 11px; font-weight: 700; margin-bottom: 28px; }
        .sig-line { border-bottom: 1.5px solid #111; width: 100%; margin-bottom: 4px; }
        .sig-sublabel { font-size: 9px; font-weight: 600; text-align: center; color: #111; }
        .no-print { text-align: center; margin-top: 24px; }
        @media print { body { background: white; padding: 0; } .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="receipt-header">
          <img src="photo/tezwa_logo.jpg" alt="Logo" onerror="this.style.display='none'">
          <div class="org-info">
            <h2>TAGUMPAY 83ZERO WASTE ASSOCIATION</h2>
            <p>South Nagtahan, Brgy. 830, Zone 90 District VI, Paco, Manila</p>
            <p>Email: <a href="mailto:tezwa.manila@gmail.com">tezwa.manila@gmail.com</a></p>
            <p>Contact No.: 0927-286-7378</p>
          </div>
        </div>
        <div class="field-row">
          <div class="field-item"><label>Cash Receipt No.</label><div class="field-value">${data.id || ''}</div></div>
          <div class="field-item"><label>Date</label><div class="field-value">${data.date || ''}</div></div>
        </div>
        <div class="field-row">
          <div class="field-item"><label>Customer</label><div class="field-value">${data.customer || ''}</div></div>
          <div class="field-item"><label>Contact No.</label><div class="field-value">${data.contact || ''}</div></div>
        </div>
        <div class="field-row">
          <div class="field-item"><label>Address</label><div class="field-value">${data.address || ''}</div></div>
          <div class="field-item"><label>Salesman</label><div class="field-value"></div></div>
        </div>
        <table>
          <thead>
            <tr><th>QTY</th><th>UNIT</th><th style="text-align:left; padding-left:8px;">DESCRIPTION</th><th>PRICE</th><th>AMOUNT</th></tr>
          </thead>
          <tbody>${buildReceiptItemRows(data.items || [], 9)}</tbody>
        </table>
        <div class="receipt-total">TOTAL: <span>₱${data.totalAmount ? data.totalAmount.toFixed(2) : '0.00'}</span></div>
        <div class="signatures">
          <div class="sig-block"><p>Received By:</p><div class="sig-line"></div><div class="sig-sublabel">Signature Over Printed Name</div></div>
          <div class="sig-block"><p>Approved By:</p><div class="sig-line"></div><div class="sig-sublabel">Signature Over Printed Name</div></div>
        </div>
      </div>
      <div class="no-print">
        <button onclick="window.print()" style="background:#46B336;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Print Receipt</button>
        <button onclick="window.close()" style="background:#6b7280;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-left:10px;">Close</button>
      </div>
    </body>
    </html>`;

    const receiptWindow = window.open('', '_blank', 'width=750,height=900');
    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
};
