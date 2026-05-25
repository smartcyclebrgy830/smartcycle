let saleMaterials = [];
let editingId = null;
const ITEMS_PER_PAGE = 10;
let currentSearch = '';
let isModalWired = false;

const salesTableBody = document.getElementById('salesTableBody');
const emptyState = document.getElementById('emptyState');


function generateDisplayId(prefix) {
    const time = Date.now().toString().slice(-6);
    const rand = Math.floor(Math.random() * 1000);
    return `${prefix}-${time}${rand}`;
}
// ==========================================
// RENDER MATERIALS TABLE
// ==========================================
function renderMaterialsTable() {
    const materialsBody = document.getElementById('materialsBody');
    const formTotalLine = document.getElementById('saleFormTotalLine');
    const materialsTotalEl = document.getElementById('saleFormTotal');
    if (!materialsBody) return;

    materialsBody.innerHTML = '';

    if (saleMaterials.length === 0) {
        materialsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:20px;">No materials added yet</td></tr>';
        if (formTotalLine) formTotalLine.style.display = 'none';
        return;
    }

    let total = 0;
    saleMaterials.forEach((m, idx) => {
        const subtotal = m.rate * m.weight;
        total += subtotal;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.name}</td>
            <td>${m.weight} kg</td>
            <td><strong>&#8369;${subtotal.toFixed(2)}</strong></td>
            <td>
                <button class="remove-item-btn" data-idx="${idx}" type="button">
                    <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                </button>
            </td>
        `;
        materialsBody.appendChild(tr);
    });

    if (formTotalLine) formTotalLine.style.display = 'flex';
    if (materialsTotalEl) materialsTotalEl.innerHTML = `&#8369;${total.toFixed(2)}`;
    lucide.createIcons();
}
// ==========================================
// WIRE MODAL & EVENT LISTENERS
// ==========================================
function wireModal() {
    if (isModalWired) return; // Prevent multiple event listener bindings
    isModalWired = true;
    
    const saleModal = document.getElementById('saleModal');
    const openSaleModalBtn = document.getElementById('openSaleModalBtn');
    const cancelSaleBtn = document.getElementById('cancelSaleBtn');
    const submitSaleBtn = document.getElementById('submitSaleBtn');
    const addMaterialBtn = document.getElementById('addMaterialBtn');
    const materialsBody = document.getElementById('materialsBody');
    const attachReceiptBtn = document.getElementById('attachReceiptBtn');
    const receiptInput = document.getElementById('receiptInput');
    const receiptPreview = document.getElementById('receiptPreview');
    const receiptPreviewImg = document.getElementById('receiptPreviewImg');
    const removeReceiptBtn = document.getElementById('removeReceiptBtn');
    const receiptFilenameLabel = document.getElementById('receiptFilenameLabel');
    
    // Form Input Elements
    const partnerInput = document.getElementById('partnerName');
    const addressInput = document.getElementById('saleAddress');
    const dateInput = document.getElementById('saleDate');
    const contactInput = document.getElementById('saleContact');
    
    // Error Fields
    const partnerErr = document.getElementById('partnerNameError');
    const addressErr = document.getElementById('saleAddressError');
    const dateErr = document.getElementById('saleDateError');
    const contactErr = document.getElementById('saleContactError');
    const matErr = document.getElementById('materialsError');

    let isSubmitting = false;

    if (!saleModal) return;

    // Open Modal
    openSaleModalBtn?.addEventListener('click', async () => {
        editingId = null;
        resetModal();
        await loadMaterialsToDropdown();
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        saleModal.classList.add('show');
        document.body.style.overflow = 'hidden';
        lucide.createIcons();
    });

    // Close Modal
    function closeModal() {
        saleModal.classList.remove('show');
        document.body.style.overflow = '';
        editingId = null;
        resetModal();
    }

    cancelSaleBtn?.addEventListener('click', closeModal);
    saleModal.addEventListener('click', (e) => { if (e.target === saleModal) closeModal(); });

    // Tab Selection
    saleModal.querySelectorAll('.m-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            saleModal.querySelectorAll('.m-tab').forEach(t => {
                t.classList.remove('active');
                t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('active');
            tab.setAttribute('aria-selected', 'true');
        });
    });

    // Add Material to list
    addMaterialBtn?.addEventListener('click', () => {
        const sel = document.getElementById('materialSelect');
        const weightEl = document.getElementById('materialWeight');
        if (!sel || !weightEl) return;

        const name = sel.value;
        const rate = Number(sel.selectedOptions[0]?.dataset.rate || 0);
        const weight = parseFloat(weightEl.value) || 0;

        if (!name || weight <= 0 || weight > 10000) {
            if (matErr) matErr.textContent = !name ? 'Please select a material.' : 'Invalid weight. Enter a value between 1 and 10,000.';
            return;
        }
        if (matErr) matErr.textContent = '';

        saleMaterials.push({ name, rate, weight });
        weightEl.value = '';
        weightEl.focus();
        renderMaterialsTable();
    });

    // Enter key shortcuts
    document.getElementById('materialWeight')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addMaterialBtn?.click(); }
    });

    // Remove Material from list
    materialsBody?.addEventListener('click', (e) => {
        const delBtn = e.target.closest('.remove-item-btn');
        if (!delBtn) return;
        const idx = Number(delBtn.dataset.idx);
        if (!isNaN(idx)) {
            saleMaterials.splice(idx, 1);
            renderMaterialsTable();
        }
    });

    // Receipt Attachment Flow
    attachReceiptBtn?.addEventListener('click', () => receiptInput?.click());

    receiptInput?.addEventListener('change', () => {
        const file = receiptInput.files[0];
        if (!file) return;
        if (receiptFilenameLabel) receiptFilenameLabel.textContent = file.name;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            if (receiptPreviewImg) receiptPreviewImg.src = e.target.result;
            receiptPreview?.classList.add('visible');
            attachReceiptBtn?.classList.add('hidden');
            lucide.createIcons();
        };
        reader.readAsDataURL(file);
    });

    removeReceiptBtn?.addEventListener('click', () => {
        if (receiptInput) receiptInput.value = '';
        if (receiptPreviewImg) receiptPreviewImg.src = '';
        receiptPreview?.classList.remove('visible');
        attachReceiptBtn?.classList.remove('hidden');
        if (receiptFilenameLabel) receiptFilenameLabel.textContent = '';
    });

    // Contact Formatting and Validation
    function validateContact(value) {
        if (!value) return true;
        return /^09\d{9}$/.test(value.replace(/[-\s]/g, ''));
    }

    contactInput?.addEventListener('input', (e) => {
        const raw = e.target.value.replace(/[^\d]/g, '').slice(0, 11);
        let fmt = raw;
        if (raw.length > 4 && raw.length <= 7) fmt = `${raw.slice(0,4)}-${raw.slice(4)}`;
        else if (raw.length > 7) fmt = `${raw.slice(0,4)}-${raw.slice(4,7)}-${raw.slice(7,11)}`;
        e.target.value = fmt;
    });

    // Real-time clear error text inputs
    partnerInput?.addEventListener('input', () => { if (partnerErr) partnerErr.textContent = ''; });
    addressInput?.addEventListener('input', () => { if (addressErr) addressErr.textContent = ''; });
    dateInput?.addEventListener('change', () => { if (dateErr) dateErr.textContent = ''; });
    contactInput?.addEventListener('input', () => { if (contactErr) contactErr.textContent = ''; });

    // Submit / Update Operations
    submitSaleBtn?.addEventListener('click', async () => {
        if (isSubmitting) return; 
        isSubmitting = true;
        
        const partnerVal = partnerInput?.value.trim();
        const addressVal = addressInput?.value.trim();
        const dateVal = dateInput?.value;
        const contactVal = contactInput?.value.trim();

        // Clear all old errors
        [partnerErr, addressErr, dateErr, contactErr, matErr].forEach(el => { if (el) el.textContent = ''; });

        let hasError = false;
        if (!partnerVal) { if (partnerErr) partnerErr.textContent = 'Partner name is required.'; hasError = true; }
        if (!dateVal) { if (dateErr) dateErr.textContent = 'Date is required.'; hasError = true; }
        if (contactVal && !validateContact(contactVal)) { if (contactErr) contactErr.textContent = 'Use format: 09XX-XXX-XXXX'; hasError = true; }
        if (saleMaterials.length === 0) { if (matErr) matErr.textContent = 'Please add at least one material.'; hasError = true; }
        
        if (hasError) { 
            isSubmitting = false;
            return;
        }

        const activeTab = saleModal.querySelector('.m-tab.active');
        const type = activeTab?.getAttribute('data-type') || 'organization';

        // Format Date (MM-DD-YY)
        const dateObj = new Date(dateVal);
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        const year = String(dateObj.getFullYear()).slice(-2);
        const displayDate = `${month}-${day}-${year}`;

        let totalAmount = 0;
        let totalWeight = 0;
        saleMaterials.forEach(m => { totalAmount += m.rate * m.weight; totalWeight += m.weight; });

        let receiptImage = (receiptPreviewImg?.src && receiptPreviewImg.src !== window.location.href) ? receiptPreviewImg.src : null;

        const saleData = {
            date: displayDate,
            raw_date: dateVal, 
            partner: partnerVal,
            address: addressVal, 
            contact: contactVal,
            type: type,
            total_amount: totalAmount,
            total_weight: totalWeight,
            receipt_image: receiptImage
        };
        
        try {
            if (editingId) {
                // UPDATE FLOW
                const { error: updateError } = await window._supabase.from('sales').update(saleData).eq('id', editingId);
                if (updateError) throw new Error("Update failed: " + updateError.message);
            
                const { error: deleteItemsError } = await window._supabase.from('sale_items').delete().eq('sale_id', editingId);
                if (deleteItemsError) throw new Error("Failed to clear old items: " + deleteItemsError.message);
            
                const itemsToInsert = saleMaterials.map(m => ({
                    sale_id: editingId,
                    material_name: m.name,
                    weight: m.weight,
                    rate: m.rate,
                    amount: m.rate * m.weight
                }));
            
                const { error: insertItemsError } = await window._supabase.from('sale_items').insert(itemsToInsert);
                if (insertItemsError) throw new Error("Failed to insert items: " + insertItemsError.message);
            
            } else {
                // INSERT FLOW
                // 🔹 Generate display ID immediately
                const displayId = generateDisplayId('S');
                
                // 🔹 1. Check if profile already exists
                let profileId = null;
                
                const { data: existingProfile } = await window._supabase
                    .from('profiles')
                    .select('id')
                    .ilike('name', partnerVal)
                    .maybeSingle();
                
                if (existingProfile) {
                    profileId = existingProfile.id;
                } else {
                    // 🔹 2. Create profile WITH display_id
                    const { data: newProfile, error: profileError } = await window._supabase
                        .from('profiles')
                        .insert([{
                            name: partnerVal,
                            category: type,
                            address: addressVal || 'N/A',
                            contact_num: contactVal || 'N/A',
                            display_id: displayId
                        }])
                        .select()
                        .single();
                
                    if (profileError) throw profileError;
                    profileId = newProfile.id;
                }
                
                // 🔹 3. Insert sale with reference
                const { data: insertedSale, error: insertError } = await window._supabase
                    .from('sales')
                    .insert([{
                        ...saleData,
                        partner_id: profileId // ✅ LINKED
                    }])
                    .select()
                    .single();
                
                if (insertError) throw insertError;
            }

            closeModal();
            if (typeof window.renderTable === 'function') await window.renderTable();
        } catch (dbError) {
            alert(dbError.message);
        } finally {
            isSubmitting = false; // Safely unlocks submission state
        }
    });

    // Reset Modal Elements Window
    function resetModal() {
        saleMaterials = [];
        renderMaterialsTable();
        if (partnerInput) partnerInput.value = '';
        if (addressInput) addressInput.value = ''; 
        if (dateInput) dateInput.value = '';
        if (contactInput) contactInput.value = '';
        
        if (receiptInput) receiptInput.value = '';
        if (receiptPreviewImg) receiptPreviewImg.src = '';
        receiptPreview?.classList.remove('visible');
        attachReceiptBtn?.classList.remove('hidden');
        if (receiptFilenameLabel) receiptFilenameLabel.textContent = '';
        
        saleModal.querySelectorAll('.m-tab').forEach((t, i) => {
            t.classList.toggle('active', i === 0);
            t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        });
        
        [partnerErr, addressErr, dateErr, contactErr, matErr].forEach(el => { if (el) el.textContent = ''; });
        if (submitSaleBtn) submitSaleBtn.innerHTML = '<i data-lucide="check"></i> Submit';
        lucide.createIcons();
    }
}

// ==========================================
// DATA LOAD DRIP ARCHITECTURE
// ==========================================
async function loadMaterialsToDropdown() {
    const { data, error } = await window._supabase
        .from('price_list')
        .select('*')
        .eq('status', 'active') // Ensure case matches your Supabase row records exactly
        .order('material_name', { ascending: true });

    if (error) {
        console.error("Error loading materials:", error);
        return;
    }

    const select = document.getElementById('materialSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select material</option>';

    data.forEach(item => {
        const option = document.createElement('option');
        option.value = item.material_name;
        option.textContent = `${item.material_name} (₱${parseFloat(item.price).toFixed(2)}/${item.unit})`;
        option.dataset.rate = item.price; // Save tracking index context
        select.appendChild(option);
    });
}

function renderPagination(totalCount) {
    const paginationEl = document.getElementById('pagination');
    if (paginationEl) paginationEl.innerHTML = '';
}

// Initialize and Fetch HTML Component Templates
fetch('sales_form.html')
    .then(res => res.text())
    .then(async html => { // 1. Added async here
        document.getElementById('sale-modal-container').innerHTML = html;
        lucide.createIcons();
        
        wireModal();
        
        // 2. 🔹 CRITICAL FIX: Run this here now that #materialSelect is safely in the DOM
        await loadMaterialsToDropdown(); 
        
        if (typeof window.renderTable === 'function') window.renderTable();
    })
    .catch((err) => {
        console.error('Could not load sales form:', err);
        if (typeof window.renderTable === 'function') window.renderTable();
    });

// ==========================================
// EDIT MODAL TRIGGER ENGINE
// ==========================================
async function openEditModal(id) {
    if (typeof fetchSales !== 'function') return;
    const allSales = await fetchSales();
    const sale = allSales.find(s => String(s.id) === String(id));
    
    if (!sale) return;

    editingId = id;
    saleMaterials = [...(sale.items || [])];

    const modal = document.getElementById('saleModal');
    if (!modal) return;

    document.getElementById('partnerName').value = sale.partner || '';
    document.getElementById('saleAddress').value = sale.address || '';
    document.getElementById('saleContact').value = sale.contact || '';

    if (sale.raw_date) {
        document.getElementById('saleDate').value = sale.raw_date;
    }

    modal.querySelectorAll('.m-tab').forEach(t => {
        const match = t.getAttribute('data-type') === sale.type;
        t.classList.toggle('active', match);
        t.setAttribute('aria-selected', match ? 'true' : 'false');
    });

    const submitBtn = document.getElementById('submitSaleBtn');
    if (submitBtn) submitBtn.innerHTML = '<i data-lucide="check"></i> Update';

    renderMaterialsTable();
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    lucide.createIcons();
}
