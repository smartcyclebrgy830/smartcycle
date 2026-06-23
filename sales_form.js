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
function wireModal() {
    if (isModalWired) return; // Prevent multiple event 
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
    var receiptErr = document.getElementById('receiptError');

    let isSubmitting = false;

    if (!saleModal) return;

    // Open Modal
    openSaleModalBtn?.addEventListener('click', async () => {
        editingId = null;
        resetModal();
        await loadProfiles();
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
    
        const materialId = parseInt(sel.value); 
        const selectedOption = sel.selectedOptions[0];
        const name = selectedOption?.dataset.name || ''; 
        const rate = Number(selectedOption?.dataset.rate || 0);
        const weight = parseFloat(weightEl.value) || 0;
    
        if (!materialId || weight <= 0 || weight > 10000) {
            if (matErr) matErr.textContent = !materialId ? 'Please select a material.' : 'Invalid weight. Enter a value between 1 and 10,000.';
            return;
        }
        if (matErr) matErr.textContent = '';
    
        saleMaterials.push({ materialId, name, rate, weight });
        weightEl.value = '';
        weightEl.focus();
        renderMaterialsTable();
    });

    // Enter key shortcuts
    document.getElementById('materialWeight')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addMaterialBtn?.click(); }
    });

    const weightInput = document.getElementById('materialWeight');

    weightInput?.addEventListener('input', (e) => {
        let value = e.target.value;
    
        // Allow only numbers and decimal
        value = value.replace(/[^0-9.]/g, '');
    
        // Prevent multiple decimals
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts[1];
        }
    
        let [integer, decimal] = value.split('.');
    
        // LIMIT INTEGER PART TO 5 DIGITS
        if (integer.length > 5) {
            integer = integer.slice(0, 5);
        }
    
        // Optional: limit decimal to 2 places
        if (decimal) {
            decimal = decimal.slice(0, 2);
            value = `${integer}.${decimal}`;
        } else {
            value = integer;
        }
    
        e.target.value = value;
    });

    // Remove Material list
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
        if (receiptErr) receiptErr.textContent = '';
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
        let digits = e.target.value.replace(/\D/g, '');
    
        // FORCE "09" prefix
        if (!digits.startsWith('09')) {
            digits = '09' + digits.replace(/^0+/, ''); // avoid multiple 0s
        }
    
        // Limit to 11 digits total
        digits = digits.slice(0, 11);
    
        // FORMAT: 09XX-XXX-XXXX
        let formatted = digits;
    
        if (digits.length > 4 && digits.length <= 7) {
            formatted = `${digits.slice(0,4)}-${digits.slice(4)}`;
        } else if (digits.length > 7) {
            formatted = `${digits.slice(0,4)}-${digits.slice(4,7)}-${digits.slice(7,11)}`;
        }
    
        e.target.value = formatted;
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
        [partnerErr, addressErr, dateErr, contactErr, matErr, receiptErr].forEach(el => { if (el) el.textContent = ''; });

        let hasError = false;
        if (!partnerVal) { if (partnerErr) partnerErr.textContent = 'Partner name is required.'; hasError = true; }
        if (!dateVal) { if (dateErr) dateErr.textContent = 'Date is required.'; hasError = true; }
        if (contactVal && !validateContact(contactVal)) { if (contactErr) contactErr.textContent = 'Use format: 09XX-XXX-XXXX'; hasError = true; }
        if (saleMaterials.length === 0) { if (matErr) matErr.textContent = 'Please add at least one material.'; hasError = true; }
        if (!editingId && (!receiptInput.files || receiptInput.files.length === 0)) { if (receiptErr) receiptErr.textContent = 'Please attach a receipt.'; hasError = true; }
        
        if (hasError) { 
            isSubmitting = false;
            return;
        }

        const activeTab = saleModal.querySelector('.m-tab.active');
        const type = activeTab?.getAttribute('data-type') || 'organization';

        // Determine Profile Type for Sales (Organization/Junkshop = Partner)
        let determinedProfileType = 'customer';
        const typeLower = type.toLowerCase();
        if (typeLower === 'organization' || typeLower === 'junkshop') {
            determinedProfileType = 'partner';
        }

        // Format Date (YYYY-MM-DD) for database compatibility since sales.date is a Date field type
        const saleDateFormatted = dateVal; 

        let totalAmount = 0;
        let totalWeight = 0;
        saleMaterials.forEach(m => { totalAmount += m.rate * m.weight; totalWeight += m.weight; });

        let receiptImage = null;

        if (receiptInput.files.length > 0) {
            const file = receiptInput.files[0];
        
            const fileName = `receipt-${Date.now()}-${file.name}`;
        
            const { data, error } = await window._supabase
                .storage
                .from('receipts')
                .upload(fileName, file);
        
            if (error) {
                throw new Error("Image upload failed: " + error.message);
            }
        
            const { data: publicUrlData } = window._supabase
                .storage
                .from('receipts')
                .getPublicUrl(fileName);
        
            receiptImage = publicUrlData.publicUrl;
        }
        // KEEP EXISTING IMAGE WHEN EDITING AND NO NEW FILE
        if (!receiptImage && editingId) {
            const { data: existingSale } = await window._supabase
                .from('sales')
                .select('receipt_image')
                .eq('id', editingId)
                .single();
        
            receiptImage = existingSale?.receipt_image || null;
        }

        const saleData = {
            date: saleDateFormatted,
            type: type,
            total_amount: totalAmount,
            total_weight: totalWeight,
            receipt_image: receiptImage
        };
        
        try {
            if (editingId) {
                // UPDATE FLOW 
                const { data: currentSale, error: fetchSaleError } = await window._supabase
                    .from('sales')
                    .select('partner_id')
                    .eq('id', editingId)
                    .single();

                if (fetchSaleError) throw new Error("Failed to fetch sale context: " + fetchSaleError.message);

                if (currentSale && currentSale.partner_id) {
                    const { error: profileUpdateError } = await window._supabase
                        .from('profiles')
                        .update({
                            name: partnerVal,
                            category: type,
                            address: addressVal || 'N/A',
                            contact_num: contactVal || 'N/A',
                            type: determinedProfileType // Sync type based on category
                        })
                        .eq('id', currentSale.partner_id);
                        
                    // Catch the error here if the update fails
                    if (profileUpdateError) throw new Error("Failed to update profile: " + profileUpdateError.message);
                }

                const { error: updateError } = await window._supabase.from('sales').update(saleData).eq('id', editingId);
                if (updateError) throw new Error("Update failed: " + updateError.message);
            
                const { error: deleteItemsError } = await window._supabase.from('sale_items').delete().eq('sale_id', editingId);
                if (deleteItemsError) throw new Error("Failed to clear old items: " + deleteItemsError.message);
            
                const itemsToInsert = saleMaterials.map(m => ({
                    sale_id: editingId,
                    material_id: m.materialId, 
                    weight: m.weight,
                    rate: m.rate,
                    amount: m.rate * m.weight
                }));
            
                const { error: insertItemsError } = await window._supabase.from('sale_items').insert(itemsToInsert);
                if (insertItemsError) throw new Error("Failed to insert items: " + insertItemsError.message);
                await window.logAction(`Updated sale for ${partnerVal}`, 'Sales');
            } else {
                // INSERT FLOW
                const displayId = generateDisplayId('S');
                let profileId = null;
                
                const { data: existingProfile, error: fetchError } = await window._supabase
                    .from('profiles')
                    .select('id')
                    .ilike('name', partnerVal)
                    .maybeSingle();
                
                // Allow non-existent rows, but catch actual DB errors
                if (fetchError && fetchError.code !== 'PGRST116') {
                    throw new Error("Error checking for existing profile: " + fetchError.message);
                }
                
                if (existingProfile) {
                    profileId = existingProfile.id;
                    const { error: profileUpdateError } = await window._supabase
                        .from('profiles')
                        .update({ 
                            name: partnerVal,
                            category: type,
                            address: addressVal || 'N/A', 
                            contact_num: contactVal || 'N/A',
                            type: determinedProfileType // Sync type based on category
                        })
                        .eq('id', profileId);
                        
                    // Catch the error here so old NULL values don't quietly remain
                    if (profileUpdateError) throw new Error("Failed to update existing profile: " + profileUpdateError.message);
                } else {
                    const { data: newProfile, error: profileError } = await window._supabase
                        .from('profiles')
                        .insert([{
                            name: partnerVal,
                            category: type,
                            address: addressVal || 'N/A',
                            contact_num: contactVal || 'N/A',
                            display_id: displayId,
                            type: determinedProfileType 
                        }])
                        .select()
                        .single();
                
                    if (profileError) throw new Error("Failed to create new profile: " + profileError.message);
                    profileId = newProfile.id;
                }
                
                const { data: insertedSale, error: insertError } = await window._supabase
                    .from('sales')
                    .insert([{
                        ...saleData,
                        partner_id: profileId 
                    }])
                    .select()
                    .single();
                
                if (insertError) throw new Error("Failed to insert sale: " + insertError.message);
        
                const itemsToInsert = saleMaterials.map(m => ({
                    sale_id: insertedSale.id, 
                    material_id: m.materialId, 
                    weight: m.weight,
                    rate: m.rate,
                    amount: m.rate * m.weight
                }));
        
                const { error: insertItemsError } = await window._supabase
                    .from('sale_items')
                    .insert(itemsToInsert);
        
                if (insertItemsError) throw new Error("Failed to insert sale items: " + insertItemsError.message);
                await window.logAction(`Added sale for ${partnerVal}`, 'Sales');
            }
        
            closeModal();
            if (typeof window.renderTable === 'function') await window.renderTable();
        } catch (dbError) {
            alert(dbError.message); // This will surface exactly why 'type' isn't writing
        } finally {
            isSubmitting = false; 
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
    // Add these variables to your script
    let allProfiles = [];
    
    // Fetch profiles once when modal opens
    async function loadProfiles() {
        const { data } = await window._supabase.from('profiles').select('*');
        allProfiles = data || [];
    }
    
    // Add event listeners inside wireModal()
    const suggestionsBox = document.getElementById('partnerSuggestions');
    
    function showSuggestions(filter = '') {
        // Sort alphabetically
        const sortedProfiles = [...allProfiles].sort((a, b) => 
            a.name.localeCompare(b.name)
        );
    
        // Filter by type 'partner' and search text
        const filtered = sortedProfiles.filter(p => 
            p.type === 'partner' && 
            p.name.toLowerCase().includes(filter.toLowerCase())
        );
    
        // Limit to first 5 items
        const limitedList = filtered.slice(0, 5);
    
        suggestionsBox.innerHTML = '';
        if (limitedList.length === 0) {
            suggestionsBox.style.display = 'none';
            return;
        }
    
        limitedList.forEach(p => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = p.name;
            div.onclick = () => {
                partnerInput.value = p.name;
                const addrEl = document.getElementById('saleAddress');
                const contEl = document.getElementById('saleContact');
                if (addrEl) addrEl.value = p.address || '';
                if (contEl) contEl.value = p.contact_num || '';
                suggestionsBox.style.display = 'none';
            };
            suggestionsBox.appendChild(div);
        });
        suggestionsBox.style.display = 'block';
    }
    
    // Show all when input is focused
    partnerInput.addEventListener('focus', () => showSuggestions());
    
    // Filter as user types
    partnerInput.addEventListener('input', (e) => showSuggestions(e.target.value));
    
    // Hide when clicking outside
    document.addEventListener('click', (e) => {
        if (!partnerInput.contains(e.target)) suggestionsBox.style.display = 'none';
    });
}

// DATA LOAD DRIP ARCHITECTURE
async function loadMaterialsToDropdown() {
    const { data, error } = await window._supabase
        .from('price_list')
        .select('*')
        .eq('status', 'Active') 
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
        option.value = item.id; 
        option.textContent = `${item.material_name} (₱${parseFloat(item.price).toFixed(2)}/${item.unit})`;
        option.dataset.rate = item.price; 
        option.dataset.name = item.material_name; 
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
    .then(async html => { 
        document.getElementById('sale-modal-container').innerHTML = html;
        lucide.createIcons();
        
        wireModal();
        
        await loadMaterialsToDropdown(); 
        
        if (typeof window.renderTable === 'function') window.renderTable();
    })
    .catch((err) => {
        console.error('Could not load sales form:', err);
        if (typeof window.renderTable === 'function') window.renderTable();
    });

// EDIT MODAL TRIGGER ENGINE
async function openEditModal(id) {
    if (typeof fetchSales !== 'function') return;
    const allSales = await fetchSales();
    const sale = allSales.find(s => String(s.id) === String(id));
    
    if (!sale) return;

    editingId = id;
    
    // Inside openEditModal(id) in your sales_form.js:
    saleMaterials = (sale.items || []).map(item => ({
        materialId: item.material_id, 
        name: item.name, // 🔹 Match the transformed name property directly
        rate: item.rate,
        weight: item.weight
    }));

    const modal = document.getElementById('saleModal');
    if (!modal) return;

    document.getElementById('partnerName').value = sale.partner || '';
    document.getElementById('saleAddress').value = sale.address || '';
    
   function formatContactForInput(num) {
        if (!num) return '';
        const digits = num.replace(/\D/g, '').slice(0, 11);
    
        if (digits.length <= 4) return digits;
        if (digits.length <= 7) return `${digits.slice(0,4)}-${digits.slice(4)}`;
        return `${digits.slice(0,4)}-${digits.slice(4,7)}-${digits.slice(7,11)}`;
    }
    
    document.getElementById('saleContact').value = formatContactForInput(sale.contact);

    if (sale.date) {
        // splits "2026-05-25T23:39:58" down to "2026-05-25"
        document.getElementById('saleDate').value = sale.date.split('T')[0];
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
