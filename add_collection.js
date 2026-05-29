// Ensure strict tracking context variables exist safely at module/global scale
let editingIndex = -1;
let currentCategory = 'School';
window.currentItems = []; // Initializing to prevent undefined array

// Local cache to resolve names during edit mode if needed
let loadedPricesCache = [];

function generateDisplayId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// GLOBAL ASSIGNMENTS & MODAL INTERACTIONS
window.openAddModal = async () => {
    const modal = document.getElementById('addCollectionModal');
    if (!modal) return;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    editingIndex = -1;
    resetForm();

    // Dynamically fetch and fill up material prices matching your Price List dashboard
    await loadActivePrices();

    document.getElementById('inDate').value = new Date().toISOString().split('T')[0];
    updatePreview();
    setTimeout(refreshIcons, 100);
};

/**
 * NEW FIXED ENGINE FUNCTION: Called from your main dashboard controller to safely open edit mode.
 * Resolves the missing 'material' name mapping bug from 'collection_items' structural relations.
 */
window.openEditModal = async (index, collectionHeader, detailedItems) => {
    const modal = document.getElementById('addCollectionModal');
    if (!modal) return;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    editingIndex = index;
    clearAllErrors();

    // 1. Force reload live prices into dropdown select and wait for cache population
    await loadActivePrices();

    // 2. Populate Header Fields
    currentCategory = collectionHeader.type || 'School';
    document.querySelectorAll('.m-tab').forEach(tab => {
        const tabCategory = tab.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        tab.classList.toggle('active', tabCategory === currentCategory);
    });

    if (document.getElementById('inCustomer')) document.getElementById('inCustomer').value = collectionHeader.customer_name || '';
    if (document.getElementById('inDate')) document.getElementById('inDate').value = collectionHeader.date_collected || '';
    if (document.getElementById('inAddress')) document.getElementById('inAddress').value = collectionHeader.address || '';
    if (document.getElementById('inContact')) document.getElementById('inContact').value = collectionHeader.contact_number || '';

    // 3. SECURE FIX: Safely parse names using the robust local cache array directly
        window.currentItems = (detailedItems || []).map(item => {
        const targetMaterialId = parseInt(item.material_id, 10);
        const cachedItem = loadedPricesCache.find(p => parseInt(p.id, 10) === targetMaterialId);
        const finalName = item.material_name || item.material || (cachedItem ? cachedItem.material_name : 'Unknown Material');

        return {
            materialId: targetMaterialId,
            material: finalName,        // Resolves your modal preview layout
            material_name: finalName,   // Resolves your main dashboard loop template
            rate: Number(item.rate || (cachedItem ? cachedItem.price : 0)),
            weight: Number(item.weight || 0),
            subtotal: Number(item.subtotal || (item.rate * item.weight) || 0)
        };
    });

    // 🟩 ADDED FIX: Match dropdown value to the first existing item in the collection when editing
    if (window.currentItems.length > 0) {
        const selMaterial = document.getElementById('selMaterial');
        if (selMaterial) {
            selMaterial.value = window.currentItems[0].materialId;
        }
    }

    // 4. Transform Action Button to Update context
    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) {
        submitBtn.onclick = () => submitCollection();
        submitBtn.innerHTML = '<i data-lucide="check"></i> Update Entry';
    }

    updatePreview();
    renderItems();
    setTimeout(refreshIcons, 100);
};

// FIXED ENGINE: Added 'id' to the select string so item.id isn't undefined
async function loadActivePrices() {
    const selMaterial = document.getElementById('selMaterial');
    if (!selMaterial) return;

    try {
        const { data: prices, error } = await _supabase
            .from('price_list')
            .select('id, material_name, price')
            .eq('status', 'Active'); 

        if (error) throw error;

        if (prices && prices.length > 0) {
            loadedPricesCache = prices; // Store references globally to parse safely on edit tasks
            selMaterial.innerHTML = prices.map((item, idx) => {
                const rate = Math.round(item.price); 
                return `<option value="${item.id}" data-name="${item.material_name}" data-rate="${rate}" ${idx === 0 ? 'selected' : ''}>
                    ${item.material_name} - ₱${rate}/kg
                </option>`;
            }).join('');
        } else {
            selMaterial.innerHTML = '<option value="" disabled>No active materials found</option>';
        }
    } catch (err) {
        console.error("Error fetching live price rates from database:", err.message);
        // Fallback structures initialized cleanly to maintain operational tracking integrity
        loadedPricesCache = [
            { id: 1, material_name: "Plastic", price: 3 },
            { id: 2, material_name: "Bakal", price: 15 },
            { id: 3, material_name: "PET-Assorted", price: 5 },
            { id: 4, material_name: "Paper Assorted", price: 8 },
            { id: 5, material_name: "Yero", price: 8 }
        ];
        selMaterial.innerHTML = `
            <option value=1 data-name="Plastic" data-rate="3" selected>Plastic - ₱3/kg</option>
            <option value=2 data-name="Bakal" data-rate="15">Bakal - ₱15/kg</option>
            <option value=3 data-name="PET-Assorted" data-rate="5">PET-Assorted - ₱5/kg</option>
            <option value=4 data-name="Paper Assorted" data-rate="8">Paper Assorted - ₱8/kg</option>
            <option value=5 data-name="Yero" data-rate="8">Yero - ₱8/kg</option>
        `;
    }
}

window.closeAddModal = () => {
    const modal = document.getElementById('addCollectionModal');
    if (!modal) return;

    modal.classList.remove('show');
    document.body.style.overflow = '';
    resetForm();
};

// Outside click modal dismiss handler
document.addEventListener('click', (e) => {
    const modal = document.getElementById('addCollectionModal');
    if (modal && e.target === modal) {
        closeAddModal();
    }
});

// FORM SYSTEM UTILITIES & VALIDATION HELPERS
function showError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    field.classList.add('input-error');
    let errEl = field.parentElement.querySelector('.field-error');
    if (!errEl) {
        errEl = document.createElement('span');
        errEl.className = 'field-error';
        field.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
}

function clearError(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    field.classList.remove('input-error');
    const errEl = field.parentElement.querySelector('.field-error');
    if (errEl) errEl.textContent = '';
}

function clearAllErrors() {
    ['inCustomer', 'inDate', 'inAddress', 'inContact', 'inWeight'].forEach(clearError);
    const itemsErr = document.getElementById('itemsError');
    if (itemsErr) itemsErr.textContent = '';
}

function validateContact(value) {
    if (!value) return true;
    return /^09\d{9}$/.test(value.replace(/[-\s]/g, ''));
}

function formatContact(value) {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 7)}-${cleaned.slice(7, 11)}`;
}

// RESET STATE ACTIONS
function resetForm() {
    ['inCustomer', 'inDate', 'inAddress', 'inContact', 'inWeight'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    clearAllErrors();
    window.currentItems = []; 
    renderItems();

    currentCategory = 'School';
    document.querySelectorAll('.m-tab').forEach((tab, idx) => {
        tab.classList.toggle('active', idx === 0);
    });

    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) {
        submitBtn.onclick = () => submitCollection();
        submitBtn.innerHTML = '<i data-lucide="check"></i> Submit';
    }

    const previewFields = { preCustomer: '---', preDate: '---', preAddress: '---', preContact: '---', preTotal: '₱0' };
    Object.entries(previewFields).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    });

    refreshIcons();
}

window.setCategory = (category, btn) => {
    currentCategory = category;
    document.querySelectorAll('.m-tab').forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');
    updatePreview();
};

window.updatePreview = function() {
    const customer = document.getElementById('inCustomer')?.value || '---';
    const date = document.getElementById('inDate')?.value || '---';
    const address = document.getElementById('inAddress')?.value || '---';
    const contact = document.getElementById('inContact')?.value || '---';

    let formattedDate = date;
    if (date !== '---') {
        formattedDate = new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    const updates = { preCustomer: customer, preDate: formattedDate, preAddress: address, preContact: contact };
    Object.entries(updates).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    });
};

// RECEIPT LINE ITEMS CONTROLLER
// Replace your existing window.addItem function with this:
window.addItem = function() {
    const sel = document.getElementById('selMaterial');
    const weightInput = document.getElementById('inWeight');
    if (!sel || !weightInput) return;

    const weight = Number(weightInput.value);
    const selectedOption = sel.selectedOptions[0];
    const rate = Number(selectedOption?.dataset.rate || 0);
    
    const materialId = parseInt(sel.value, 10); 
    const materialName = selectedOption?.dataset.name || '';

    if (isNaN(materialId)) {
        alert("Please select a valid material collection type.");
        return;
    }

    if (!weight || weight <= 0 || weight > 10000) {
        showError('inWeight', weight > 10000 ? 'Invalid weight. Enter a value between 1 and 10,000.' : 'Please enter a valid weight');
        weightInput.focus();
        return;
    }

    clearError('inWeight');
    const itemsErr = document.getElementById('itemsError');
    if (itemsErr) itemsErr.textContent = '';

    window.currentItems.push({ 
        materialId,
        material: materialName,     // Matches layout expectation
        material_name: materialName, // Matches database expectation
        rate, 
        weight, 
        subtotal: rate * weight 
    });
    
    weightInput.value = '';
    weightInput.focus();

    renderItems();
};

function renderItems() {
    const itemsBody = document.getElementById('itemsBody');
    const preItemsBody = document.getElementById('preItemsBody');
    const formTotalLine = document.getElementById('formTotalLine');
    if (!itemsBody || !preItemsBody) return;

    let total = 0;
    let mainRowsHtml = '';
    let previewRowsHtml = '';

    if (window.currentItems.length === 0) {
        itemsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #94a3b8; padding: 20px;">No items added yet</td></tr>';
        preItemsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #94a3b8; padding: 20px;">No items</td></tr>';
        if (formTotalLine) formTotalLine.style.display = 'none';
    } else {
        window.currentItems.forEach((item, index) => {
            total += item.subtotal;
            mainRowsHtml += `
                <tr>
                  <td>${item.material || 'Unknown'}</td>
                  <td>₱${item.rate}</td>
                  <td>${item.weight} kg</td>
                  <td><strong>₱${item.subtotal.toFixed(2)}</strong></td>
                  <td>
                    <button class="remove-item-btn" onclick="removeItem(${index})" title="Remove item">
                      <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                  </td>
                </tr>`;

            previewRowsHtml += `
                <tr>
                  <td style="text-align:center;">${item.weight}</td>
                  <td style="text-align:center;">kg</td>
                  <td style="text-align:left;">${item.material || 'Unknown'}</td>
                  <td style="text-align:center;">₱${item.rate}</td>
                  <td style="text-align:center;">₱${item.subtotal.toFixed(2)}</td>
                </tr>`;
        });

        itemsBody.innerHTML = mainRowsHtml;
        preItemsBody.innerHTML = previewRowsHtml;

        if (formTotalLine) {
            formTotalLine.style.display = 'flex';
            const formTotalEl = document.getElementById('formTotal');
            if (formTotalEl) formTotalEl.innerText = `₱${total.toFixed(2)}`;
        }
    }

    const emptyRowsNeeded = Math.max(0, 8 - window.currentItems.length);
    for (let i = 0; i < emptyRowsNeeded; i++) {
        preItemsBody.innerHTML += '<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td></tr>';
    }

    const preTotalEl = document.getElementById('preTotal');
    if (preTotalEl) preTotalEl.innerText = `₱${total.toFixed(2)}`;

    refreshIcons();
}

window.removeItem = (index) => {
    window.currentItems.splice(index, 1);
    renderItems();
};

// PERSISTENCE (SUPABASE SYNC ENGINE)
// PERSISTENCE (SUPABASE SYNC ENGINE)
window.submitCollection = async function() {
    const customer = document.getElementById('inCustomer')?.value.trim();
    const date = document.getElementById('inDate')?.value;
    const address = document.getElementById('inAddress')?.value.trim();
    const contact = document.getElementById('inContact')?.value.trim();
    const submitBtn = document.querySelector('.btn-submit-green');

    clearAllErrors();
    let hasError = false;

    if (!customer) { showError('inCustomer', 'Customer name is required'); hasError = true; }
    if (!date) { showError('inDate', 'Date is required'); hasError = true; }
    if (contact && !validateContact(contact)) { showError('inContact', 'Use format: 09XX-XXX-XXXX'); hasError = true; }
    
    if (window.currentItems.length === 0) {
        const itemsErr = document.getElementById('itemsError');
        if (itemsErr) itemsErr.textContent = 'Please add at least one item';
        hasError = true;
    }
    if (hasError) return;

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = editingIndex !== -1 ? 'Updating...' : 'Saving...';
        }

        const collectionPayload = { 
            customer_name: customer, 
            date_collected: date, 
            address: address, 
            contact_number: contact, 
            type: currentCategory 
        };

        if (editingIndex !== -1) {
            const targetedCollection = (typeof getFilteredCollections === 'function') 
                ? getFilteredCollections()[editingIndex] 
                : window.collections[editingIndex];

            if (!targetedCollection || !targetedCollection.id) {
                throw new Error("Unable to identify targeted collection ID context.");
            }

            const targetId = targetedCollection.id;

            const { error: headerUpdateError } = await _supabase
                .from('collections')
                .update(collectionPayload)
                .eq('id', targetId);

            if (headerUpdateError) throw headerUpdateError;

            const { error: itemsClearError } = await _supabase
                .from('collection_items')
                .delete()
                .eq('collection_id', targetId);
            
            if (itemsClearError) throw itemsClearError;
            
            const itemsToInsert = window.currentItems.map(item => ({
                collection_id: targetId,
                material_id: item.materialId, 
                rate: item.rate,
                weight: item.weight,
                subtotal: item.subtotal
            }));
        
            const { error: itemsInsertError } = await _supabase
                .from('collection_items')
                .insert(itemsToInsert);
        
            if (itemsInsertError) throw itemsInsertError;
            
            alert("Collection entry updated successfully!");

        } else {
            // --- INSERT MODE ---
            const displayId = generateDisplayId('C');
            const formattedCustomer = toTitleCase(customer.trim()); 
            collectionPayload.customer_name = formattedCustomer; 

            let profileId = null;
            
            const { data: existingProfile } = await _supabase
                .from('profiles')
                .select('id, name, address, contact_num')
                .ilike('name', formattedCustomer)
                .maybeSingle();
            
            // NEW LOGIC: Fixed routing per your correction
            const lowerCat = currentCategory ? currentCategory.toLowerCase() : '';
            let determinedType = 'customer'; // Default to customer
            
            // If you have specific categories that act as partners, enter them here:
            if (lowerCat === 'partner_category_name' || lowerCat === 'another_partner') {
                determinedType = 'partner';
            }

            if (existingProfile) {
                profileId = existingProfile.id;
                const updatePayload = {};
                
                if (existingProfile.name !== formattedCustomer) {
                    updatePayload.name = formattedCustomer;
                }
                if (existingProfile.address === 'N/A' || !existingProfile.address) {
                    updatePayload.address = address || 'N/A';
                }
                if (existingProfile.contact_num === 'N/A' || !existingProfile.contact_num) {
                    updatePayload.contact_num = contact || 'N/A';
                }
                
                updatePayload.category = currentCategory || 'Walk-ins';
                updatePayload.type = determinedType; 

                await _supabase
                    .from('profiles')
                    .update(updatePayload)
                    .eq('id', profileId);

            } else {
                const { data: newProfile, error: profileError } = await _supabase
                    .from('profiles')
                    .insert([{
                        name: formattedCustomer,          
                        category: currentCategory || 'Walk-ins', 
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
            
            const { data: headerData, error: headerError } = await _supabase
                .from('collections')
                .insert([collectionPayload])
                .select()
                .single();
            
            if (headerError) throw headerError;
            
            const itemsToInsert = window.currentItems.map(item => ({
                collection_id: headerData.id,
                material_id: item.materialId, 
                rate: item.rate,
                weight: item.weight,
                subtotal: item.subtotal
            }));
            
            const { error: itemsError } = await _supabase
                .from('collection_items')
                .insert(itemsToInsert);
            
            if (itemsError) throw itemsError;
        }

        closeAddModal();
        if (typeof fetchAllCollections === 'function') await fetchAllCollections();

    } catch (err) {
        console.error("Database Transaction Error:", err.message);
        alert("Failed to save: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check"></i> Submit';
            refreshIcons();
        }
    }
};

window.setupFieldListeners = function() {
    const inCustomer = document.getElementById('inCustomer');
    if (inCustomer) {
        inCustomer.addEventListener('input', () => { if (inCustomer.value.trim()) clearError('inCustomer'); });
        inCustomer.addEventListener('blur', () => {
            const val = inCustomer.value.trim();
            if (!val) showError('inCustomer', 'Customer name is required');
            else if (val.length > 100) showError('inCustomer', 'Max 100 characters');
            else clearError('inCustomer');
        });
    }

    const inDate = document.getElementById('inDate');
    if (inDate) {
        inDate.addEventListener('change', () => { if (inDate.value) clearError('inDate'); else showError('inDate', 'Date is required'); });
    }

    const inContact = document.getElementById('inContact');
    if (inContact) {
        inContact.addEventListener('input', () => {
            inContact.value = formatContact(inContact.value.replace(/[^\d]/g, '').slice(0, 11));
            clearError('inContact');
        });
    }

    const inWeight = document.getElementById('inWeight');
    if (inWeight) {
        inWeight.addEventListener('input', () => clearError('inWeight'));
    }
};

function togglePreview() {
    const left = document.querySelector('.modal-left');
    const right = document.querySelector('.modal-right');
    if (!left || !right) return;
    
    right.classList.add('show-preview');
    left.style.display = 'none';
    refreshIcons();
}

function closePreview() {
    const left = document.querySelector('.modal-left');
    const right = document.querySelector('.modal-right');
    if (!left || !right) return;

    right.classList.remove('show-preview');
    left.style.display = 'block';
    refreshIcons();
}
