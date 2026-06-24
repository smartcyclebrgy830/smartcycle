(function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }
})();

if (!window._supabase) {
    const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';

    window._supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}
const _supabase = window._supabase; 

async function detectUserRole() {
    try {
        const { data: { user }, error: userError } = await _supabase.auth.getUser();
        if (userError || !user) {
            console.error("No logged-in user");
            window.currentUserRole = 'Moderator';
            return;
        }
        const { data: profile, error } = await _supabase
            .from('profiles')
            .select('type')
            .eq('auth_id', user.id)
            .single();

        if (error || !profile) {
            console.error("Profile not found:", error);
            window.currentUserRole = 'Moderator'; // fallback
            return;
        }

        window.currentUserRole = profile.type;
        console.log("Detected Role:", window.currentUserRole);

    } catch (err) {
        console.error("Role detection failed:", err);
        window.currentUserRole = 'Moderator';
    }
}

window.collections = [];
window.currentItems = [];
window.currentCategory = 'School';
window.editingIndex = -1; 
let currentPage = 1;
let currentFilter = 'all';
let currentSearch = '';
const itemsPerPage = 10;

document.addEventListener('DOMContentLoaded', async () => {
    await detectUserRole(); // wait for role first
    loadModalHTML();
    setupSearch();
    setupAddCollectionButton();
    await fetchAllCollections();
});

function setupAddCollectionButton() {
    const buttons = document.querySelectorAll('button');
    let addBtn = null;
    
    buttons.forEach(btn => {
        if (btn.textContent.includes('Add Collection')) {
            addBtn = btn;
        }
    });

    if (addBtn) {
        if (window.currentUserRole === 'Moderator') {
            addBtn.style.display = 'none';
        } else {
            addBtn.style.display = 'flex'; 
            
            addBtn.onclick = null; 
            addBtn.onclick = function() {
                window.editingIndex = -1; // Reset edit state for fresh entries
                const modal = document.getElementById('addCollectionModal');
                if (modal) {
                    modal.classList.add('show');
                    document.body.style.overflow = 'hidden';
                    
                    if (document.getElementById('inCustomer')) document.getElementById('inCustomer').value = '';
                    if (document.getElementById('inAddress')) document.getElementById('inAddress').value = '';
                    if (document.getElementById('inContact')) document.getElementById('inContact').value = '';
                    const dateInput = document.getElementById('inDate');
                    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
                    
                    window.currentItems = [];
                    if (typeof renderItems === 'function') renderItems();
                    
                    const submitBtn = document.querySelector('.btn-submit-green');
                    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="plus"></i> Submit';
                    if (typeof refreshIcons === 'function') refreshIcons();
            
                    // ✅ ADD THIS: Initialize the autocomplete listeners when the modal opens
                    if (!window._listenersInitialized && typeof window.setupFieldListeners === 'function') {
                        window.setupFieldListeners();
                        window._listenersInitialized = true;
                    }
                } else {
                    console.error("Modal element #addCollectionModal not found in DOM.");
                }
            };
        }
    }
}

function refreshIcons() {
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function formatDateToMDY(dateString) {
    if (!dateString) return 'N/A';
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString; 
    const [year, month, day] = parts;
    return `${month}-${day}-${year}`;
}    

window.loadMaterialDropdownOptions = async function() {
    const materialSelect = document.getElementById('selMaterial') || 
                           document.getElementById('inMaterial') || 
                           document.querySelector('select[name="material"]'); 
    if (!materialSelect) return;
    try {
        const { data: materials, error } = await _supabase
            .from('price_list')
            .select('id, material_name, price, unit, status');
        if (error) throw error;
        
        materialSelect.innerHTML = '<option value="" disabled selected>Select a material...</option>';
        if (!materials || materials.length === 0) return;

        const activeMaterials = materials.filter(item => {
            if (!item.status) return true; 
            return item.status.toLowerCase() === 'active';
        });
        
        activeMaterials.forEach(item => {
            const option = document.createElement('option');
            option.value = item.id; 
            option.setAttribute('data-rate', item.price);
            option.textContent = `${item.material_name} (₱${item.price}/${item.unit || 'kg'})`;
            materialSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Failed to load materials:", err.message);
    }
};

window.fetchAllCollections = async function() {
    const { data, error } = await _supabase
        .from('collections')
        .select(`
    *, 
    collection_items (
        *,
        price_list:material_id (
            material_name
        )
    ),
    salesman
`)
        .order('date_collected', { ascending: false })
        .order('id', { ascending: false });

    if (error) {
        console.error("Error fetching data from Supabase:", error.message);
        return;
    }

    window.collections = data.map(col => {
        const rawItems = col.collection_items || [];
        const mappedItems = rawItems.map(item => {
            let materialName = 'Unknown';
            if (item.price_list) {
                if (Array.isArray(item.price_list) && item.price_list.length > 0) {
                    materialName = item.price_list[0].material_name || 'Unknown';
                } else if (item.price_list.material_name) {
                    materialName = item.price_list.material_name;
                }
            } else if (item.material_name) {
                materialName = item.material_name;
            }
            return {
                material_id: item.material_id, 
                material: materialName,
                rate: parseFloat(item.rate) || 0,
                weight: parseFloat(item.weight) || 0,
                subtotal: parseFloat(item.subtotal) || 0
            };
        });
        return {
            id: col.id,
            date: formatDateToMDY(col.date_collected),
            customer: col.customer_name,
            category: col.type || 'School',
            totalAmount: mappedItems.reduce((sum, i) => sum + i.subtotal, 0),
            totalWeight: mappedItems.reduce((sum, i) => sum + i.weight, 0),
            address: col.address,
            contact: col.contact_number,
            items: mappedItems,
            salesman: col.salesman || '',
            receipt_image: col.receipt_image || null
        };
    });
    renderTable();
};

function getFilteredCollections() {
    let data = window.collections;

    // 🔹 Filter by category
    if (currentFilter !== 'all') {
        data = data.filter(col =>
            col.category &&
            col.category.toLowerCase() === currentFilter.toLowerCase()
        );
    }

    // 🔹 Filter by CUSTOMER NAME ONLY
    if (currentSearch) {
        data = data.filter(col =>
            col.customer &&
            col.customer.toLowerCase().replace(/\s+/g, ' ')
                .includes(currentSearch.replace(/\s+/g, ' '))
        );
    }

    return data;
}

function loadModalHTML() {
    if (window.currentUserRole === 'Moderator') return;

    fetch('add_collection.html')
        .then(res => res.text())
        .then(async html => {
            document.getElementById('modalContainer').innerHTML = html;
            await window.loadMaterialDropdownOptions();

            // 1. Existing Weight Input Filter
            const weightInput = document.getElementById('inWeight');
            if (weightInput) {
                weightInput.addEventListener('input', (e) => {
                    let value = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = value.split('.');
                    if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
                    e.target.value = value;
                });
            }

            // 2. NEW: Strict Contact Number Filter (Blocks letters completely. Strict Philippine Mobile Masking (Forces 09XX-XXX-XXXX)
            const contactInput = document.getElementById('inContact');
            if (contactInput) {
                // Optional UX: Auto-fill '09' when the user clicks/focuses on an empty field
                contactInput.addEventListener('focus', (e) => {
                    if (!e.target.value) {
                        e.target.value = '09';
                        if (typeof updatePreview === 'function') updatePreview();
                    }
                });
            
                contactInput.addEventListener('input', (e) => {
                    // 1. Strip out absolutely everything except numbers
                    let raw = e.target.value.replace(/\D/g, '');
                    
                    // 2. If the user clears the field entirely, let it be empty
                    if (raw.length === 0) {
                        e.target.value = '';
                        if (typeof updatePreview === 'function') updatePreview();
                        return;
                    }
                    
                    // 3. Force '09' at the very beginning if it's missing
                    if (!raw.startsWith('09')) {
                        // Strips any accidental leading zeros the user typed before prepending '09'
                        raw = '09' + raw.replace(/^0+/, '');
                    }
                    
                    // 4. Cap raw digits to 11 characters maximum (09 + 9 digits)
                    if (raw.length > 11) {
                        raw = raw.substring(0, 11);
                    }
                    
                    // 5. Construct the 09XX-XXX-XXXX layout dynamically
                    let formatted = raw.substring(0, 4); // 09XX
                    if (raw.length > 4) {
                        formatted += '-' + raw.substring(4, 7); // 09XX-XXX
                    }
                    if (raw.length > 7) {
                        formatted += '-' + raw.substring(7, 11); // 09XX-XXX-XXXX
                    }
                    
                    // 6. Pass the masked text back to the input UI
                    e.target.value = formatted;
                    
                    // 7. Instantly sync with your receipt preview panel
                    if (typeof updatePreview === 'function') {
                        updatePreview();
                    }
                });
            }
            const dateInput = document.getElementById('inDate');
            if (dateInput && !dateInput.value) {
                dateInput.value = new Date().toISOString().split('T')[0];
            }
            
            const form = document.querySelector('#modalContainer form') || document.getElementById('collectionForm');
            if (form) {
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await saveCollection();
                });
            }
            refreshIcons();
        })
        .catch(() => console.log('Using fallback inline HTML modal configuration'));
}

function renderTable() {
    const tbody = document.getElementById('collectionTableBody');
    if (!tbody) return;
    
    setupAddCollectionButton();

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

        //Receipt Icon Button
        let actionButtonsHTML = `
        <div class="receipt-dropdown-wrap">
            <button class="icon-btn receipt-btn" onclick="toggleReceiptDropdown(event, ${actualIndex})"><i data-lucide="image"></i></button>
        </div>
        `;
        
        if (window.currentUserRole !== 'Moderator') {
            actionButtonsHTML += `
                <button class="icon-btn" onclick="editEntry(${actualIndex})"><i data-lucide="edit-2"></i></button>
                <button class="icon-btn delete" onclick="deleteEntry(${actualIndex})"><i data-lucide="trash-2"></i></button>
            `;
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
                ${actionButtonsHTML}
              </div>
            </td>
          </tr>
          <tr id="${rowId}" class="sub-row-container">
            <td colspan="8" style="border:none;">
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
                    <tbody>${typeof buildReceiptItemRows === 'function' ? buildReceiptItemRows(collection.items || [], 0) : ''}</tbody>
                </table>
                <div style="text-align:right; padding: 15px 25px; border-top: 1px solid #f1f5f9;">
                    <span style="font-size:13px; color:#64748b; margin-right:10px;">Total Amount:</span>
                    <span style="font-weight:700; color:#10b981;">₱${collection.totalAmount.toFixed(2)}</span>
                </div>
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
        currentSearch = e.target.value.toLowerCase().trim();
        currentPage = 1; // reset to first page
        renderTable();
    });
}

window.editEntry = function(index) {
    if (window.currentUserRole === 'Moderator') {
        alert("Access Denied: Moderators do not have edit capabilities.");
        return;
    }

    const parsedIndex = parseInt(index, 10);
    const filteredList = getFilteredCollections();
    const data = filteredList[parsedIndex];
    if (!data) return;

    // Normalize date from MM-DD-YYYY back to YYYY-MM-DD for the form
    let dateVal = data.date_collected || data.date;
    if (dateVal && dateVal !== 'N/A') {
        if (dateVal.includes('-') && dateVal.split('-')[0].length !== 4) {
            const [m, d, y] = dateVal.split('-');
            dateVal = `${y}-${m}-${d}`;
        }
    } else {
        dateVal = new Date().toISOString().split('T')[0];
    }

    // Build the collectionHeader object openEditModal expects
    const collectionHeader = {
        customer_name: data.customer || '',
        date_collected: dateVal,
        address: data.address || '',
        contact_number: data.contact || '',
        salesman: data.salesman || '',
        type: data.category || 'School'
    };

    // Build detailedItems — material_id must be present for dropdown pre-selection
    const detailedItems = (data.items || []).map(item => ({
        material_id: item.material_id,
        material_name: item.material,
        rate: item.rate,
        weight: item.weight,
        subtotal: item.subtotal
    }));

    // Hand off to openEditModal which handles loadActivePrices + renderItems
    if (typeof window.openEditModal === 'function') {
        window.openEditModal(parsedIndex, collectionHeader, detailedItems);
    }
};

async function saveCollection() {
    if (window.currentUserRole === 'Moderator') {
        alert("Access Denied: Action prohibited.");
        return;
    }

    const customer = document.getElementById('inCustomer')?.value.trim();
    const address = document.getElementById('inAddress')?.value.trim();
    const contact = document.getElementById('inContact')?.value.trim();
    const date = document.getElementById('inDate')?.value;
    const submitBtn = document.querySelector('.btn-submit-green');

    if (!customer || !date) {
        alert("Customer name and Date are required fields.");
        return;
    }
    if (window.currentItems.length === 0) {
        alert("Please add at least one item before saving.");
        return;
    }
    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = window.editingIndex > -1 ? 'Updating...' : 'Saving...';
        }

        const formattedCustomer = typeof toTitleCase === 'function' ? toTitleCase(customer) : customer;
        const collectionPayload = {
            customer_name: formattedCustomer,
            address: address || 'N/A',
            contact_number: contact || 'N/A',
            date_collected: date,
            type: window.currentCategory,
            receipt_image: window.currentReceiptImage || null
        };

        let targetId;
        let profileId = null;

        // Sync and associate customer profile details cleanly for both additions and modifications
        const { data: existingProfile } = await _supabase
            .from('profiles')
            .select('id, name')
            .ilike('name', formattedCustomer)
            .maybeSingle();

        let determinedType = 'customer';
        if (window.currentCategory?.toLowerCase() === 'partner_category_name') {
            determinedType = 'partner';
        }

        if (existingProfile) {
            profileId = existingProfile.id;
            await _supabase
                .from('profiles')
                .update({
                    address: address || 'N/A',
                    contact_num: contact || 'N/A',
                    category: window.currentCategory || 'Walk-ins',
                    type: determinedType
                })
                .eq('id', profileId);
        } else {
            const displayId = typeof generateDisplayId === 'function' ? generateDisplayId('C') : 'C-' + Date.now();
            const { data: newProfile, error: profileError } = await _supabase
                .from('profiles')
                .insert([{
                    name: formattedCustomer,
                    category: window.currentCategory || 'Walk-ins',
                    address: address || 'N/A',
                    contact_num: contact || 'N/A',
                    display_id: displayId,
                    type: determinedType
                }])
                .select()
                .single();

            if (profileError) throw profileError;
            profileId = newProfile.id;
        }

        collectionPayload.customer_id = profileId;

        if (window.editingIndex > -1) {
            const originalCollection = getFilteredCollections()[window.editingIndex];
            targetId = originalCollection.id;

            const { error: updateCollectionError } = await _supabase
                .from('collections')
                .update(collectionPayload)
                .eq('id', targetId);

            if (updateCollectionError) throw updateCollectionError;

            const { error: deleteItemsError } = await _supabase
                .from('collection_items')
                .delete()
                .eq('collection_id', targetId);

            if (deleteItemsError) throw deleteItemsError;

        } else {
            const { data: newCollection, error: insertCollectionError } = await _supabase
                .from('collections')
                .insert([collectionPayload])
                .select()
                .single();

            if (insertCollectionError) throw insertCollectionError;
            targetId = newCollection.id;
        }

        if (window.currentItems.length > 0) {
            const itemsToInsert = window.currentItems.map(item => ({
                collection_id: targetId,
                material_id: parseInt(item.material_id || item.materialId, 10),
                rate: item.rate,
                weight: item.weight,
                subtotal: item.subtotal
            }));

            const { error: insertItemsError } = await _supabase
                .from('collection_items')
                .insert(itemsToInsert);

            if (insertItemsError) throw insertItemsError;
        }
        const isEdit = window.editingIndex > -1;
        
        alert(isEdit ? "Collection updated successfully!" : "Collection saved successfully!");
        
        if (typeof closeAddModal === 'function') closeAddModal(); 
        else if (typeof closeModal === 'function') closeModal();

        await fetchAllCollections();

    } catch (err) {
        console.error("Database mutation error:", err);
        alert("Failed to save collection updates: " + err.message);
    } finally { 
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check"></i> Submit';
            refreshIcons();
        }
    }
}

function closeModal() {
    const modal = document.getElementById('addCollectionModal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
    
    window.editingIndex = -1;
    window.currentItems = [];
    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="plus"></i> Submit';
}

window.deleteEntry = function(index) {
    if (window.currentUserRole === 'Moderator') {
        alert("Access Denied: Delete operation unauthorized.");
        return;
    }

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
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const cancelBtn = document.getElementById('deleteCancelBtn');
    confirmBtn.onclick = async () => {
        try {
            const { error: itemsDeleteError } = await _supabase
                .from('collection_items')
                .delete()
                .eq('collection_id', collection.id);
    
            if (itemsDeleteError) throw itemsDeleteError;
    
            const { error: collectionDeleteError } = await _supabase
                .from('collections')
                .delete()
                .eq('id', collection.id);
                
            if (collectionDeleteError) throw collectionDeleteError;
    
            window.collections = window.collections.filter(c => c.id !== collection.id);
            renderTable();
            modal.style.display = 'none';
            alert("Collection deleted successfully.");
            if (typeof logAction === 'function') {
                logAction(`Deleted collection for ${collection.customer}`, window.location.pathname);
            }
        } catch (err) {
            console.error(err);
            alert("Error deleting record: " + err.message);
        }
    };

    cancelBtn.onclick = () => modal.style.display = 'none';
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
};

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
          <div class="field-item"><label>Salesman</label><div class="field-value">${data.salesman || ''}</div></div>
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
        <button onclick="window.print(); if (window.opener && typeof window.opener.logAction === 'function') {
        window.opener.logAction('Printed receipt for ${data.customer}', window.opener.location.pathname);
    }" style="background:#46B336;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;">Print Receipt</button>
        <button onclick="window.close()" style="background:#6b7280;color:white;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;margin-left:10px;">Close</button>
      </div>
    </body>
    </html>`;

    const receiptWindow = window.open('', '_blank', 'width=750,height=900');
    receiptWindow.document.write(receiptHTML);
    receiptWindow.document.close();
};

// For Image Receipt Choices
window.toggleReceiptDropdown = function(e, index) {
    e.stopPropagation();

    const existingDrop = document.getElementById('rdrop-' + index);
    if (existingDrop) {
        closeReceiptDropdown();
        return;
    }
    
    closeReceiptDropdown();

    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();

    const drop = document.createElement('div');
    drop.className = 'receipt-dropdown';
    drop.id = 'rdrop-' + index;
    drop.innerHTML = `
        <button onclick="viewReceipt(${index}); closeReceiptDropdown()">Generated Receipt</button>
        <button onclick="viewAttachedReceipt(${index}); closeReceiptDropdown()">Attached Receipt</button>
    `;

    drop.style.position = 'fixed';
    drop.style.top = (rect.bottom + 4) + 'px';
    drop.style.left = (rect.left + rect.width / 2) + 'px';
    drop.style.transform = 'translateX(-50%)';
    drop.style.zIndex = '99999';

    document.body.appendChild(drop);
};

window.closeReceiptDropdown = function() {
    document.querySelectorAll('.receipt-dropdown').forEach(function(d) {
        d.remove();
    });
};

document.addEventListener('click', function() {
    closeReceiptDropdown();
});

window.viewAttachedReceipt = function(index) {
    var data = getFilteredCollections()[index];
    if (!data) return;

    if (!data.receipt_image) {
        alert('No attached receipt for: ' + data.customer);
        return;
    }

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Receipt - ${data.customer}</title>
        <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;}
        img{max-width:100%;max-height:100vh;object-fit:contain;border-radius:8px;}</style></head>
        <body><img src="${data.receipt_image}" alt="Receipt for ${data.customer}"></body></html>`);
};
