// Ensure strict tracking context variables exist safely at module/global scale
let editingIndex = -1;
let currentCategory = 'School';
window.currentItems = []; // Initializing to prevent undefined array pushes

// Local cache to resolve names during edit mode if needed
let loadedPricesCache = [];

// Safety utility wrapper for external rendering dependencies
function safeRefreshIcons() {
    if (typeof refreshIcons === 'function') {
        refreshIcons();
    } else if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

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

    const dateField = document.getElementById('inDate');
    if (dateField) {
        dateField.value = new Date().toISOString().split('T')[0];
    }
    
    updatePreview();
    setTimeout(safeRefreshIcons, 100);
};

/**
 * FIXED ENGINE FUNCTION: Called from your main dashboard controller to safely open edit mode.
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
        
        // Find the matched object directly in the array data fetched from Supabase
        const cachedItem = loadedPricesCache.find(p => parseInt(p.id, 10) === targetMaterialId);
        
        // Match standard naming fallbacks across both frontend layouts and backend joined fields
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

    // 4. Transform Action Button to Update context
    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) {
        submitBtn.onclick = () => submitCollection();
        submitBtn.innerHTML = '<i data-lucide="check"></i> Update Entry';
    }

    updatePreview();
    renderItems();
    setTimeout(safeRefreshIcons, 100);
};

// FIXED CACHE ENGINE: Fetches all records for precise translation mapping, but dropdown filters for Active ones
async function loadActivePrices() {
    const selMaterial = document.getElementById('selMaterial');
    if (!selMaterial) return;

    try {
        const { data: prices, error } = await _supabase
            .from('price_list')
            .select('id, material_name, price, status');

        if (error) throw error;

        if (prices && prices.length > 0) {
            loadedPricesCache = prices; // Store references globally to parse safely on edit tasks
            
            // Only show active items in the select drop-down list selection menu
            const activePrices = prices.filter(p => p.status === 'Active');
            
            if (activePrices.length > 0) {
                selMaterial.innerHTML = activePrices.map((item, idx) => {
                    const rate = Math.round(item.price); 
                    return `<option value="${item.id}" data-name="${item.material_name}" data-rate="${rate}" ${idx === 0 ? 'selected' : ''}>
                        ${item.material_name} - ₱${rate}/kg
                    </option>`;
                }).join('');
            } else {
                selMaterial.innerHTML = '<option value="" disabled>No active materials found</option>';
            }
        } else {
            selMaterial.innerHTML = '<option value="" disabled>No active materials found</option>';
        }
    } catch (err) {
        console.error("Error fetching live price rates from database:", err.message);
        // Fallback structures initialized cleanly to maintain operational tracking integrity
        loadedPricesCache = [
            { id: 1, material_name: "Plastic", price: 3, status: "Active" },
            { id: 2, material_name: "Bakal", price: 15, status: "Active" },
            { id: 3, material_name: "PET-Assorted", price: 5, status: "Active" },
            { id: 4, material_name: "Paper Assorted", price: 8, status: "Active" },
            { id: 5, material_name: "Yero", price: 8, status: "Active" }
        ];
        selMaterial.innerHTML = `
            <option value="1" data-name="Plastic" data-rate="3" selected>Plastic - ₱3/kg</option>
            <option value="2" data-name="Bakal" data-rate="15">Bakal - ₱15/kg</option>
            <option value="3" data-name="PET-Assorted" data-rate="5">PET-Assorted - ₱5/kg</option>
            <option value="4" data-name="Paper Assorted" data-rate="8">Paper Assorted - ₱8/kg</option>
            <option value="5" data-name="Yero" data-rate="8">Yero - ₱8/kg</option>
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

    safeRefreshIcons();
}

window.setCategory = (category, btn) => {
    currentCategory = category;
    document.querySelectorAll('.m-tab').forEach(tab => tab.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updatePreview();
};

window.updatePreview = function() {
    const customer = document.getElementById('inCustomer')?.value || '---';
    const date = document.getElementById('inDate')?.value || '---';
    const address = document.getElementById('inAddress')?.value || '---';
    const contact = document.getElementById('inContact')?.value || '---';

    let formattedDate = date;
    if (date !== '---' && date) {
        formattedDate = new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    const updates = { preCustomer: customer, preDate: formattedDate, preAddress: address, preContact: contact };
    Object.entries(updates).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value || '---';
    });
};

// RECEIPT LINE ITEMS CONTROLLER
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
        material: materialName,     
        material_name: materialName, 
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
                    <button class="remove-item-btn" type="button" onclick="removeItem(${index})" title="Remove item">
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

    safeRefreshIcons();
}

window.removeItem = (index) => {
    window.currentItems.splice(index, 1);
    renderItems();
};

// PERSISTENCE ENGINE WITH SECURE COMPOSITE PROFILE ROUTING
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

        const formattedCustomer = toTitleCase(customer.trim()); 
        let determinedType = 'customer'; 

        // =========================================================
        // 🛡️ UNIFIED ANTI-DUPLICATE CONSTRAINT RESOLUTION STRATEGY
        // =========================================================
        let profileId = null;

        // Check if this profile name exists *anywhere* in the system safely
        const { data: existingProfile, error: profileFindError } = await _supabase
            .from('profiles')
            .select('id, name, address, contact_num')
            .ilike('name', formattedCustomer)
            .maybeSingle();

        if (profileFindError) throw profileFindError;

        if (existingProfile) {
            // A profile with this name already exists! Connect to it instead of forcing a unique name collision.
            profileId = existingProfile.id;

            const profileUpdatePayload = {};
            if (existingProfile.address === 'N/A' || !existingProfile.address) {
                profileUpdatePayload.address = address || 'N/A';
            }
            if (existingProfile.contact_num === 'N/A' || !existingProfile.contact_num) {
                profileUpdatePayload.contact_num = contact || 'N/A';
            }
            profileUpdatePayload.category = currentCategory || 'Walk-ins';
            profileUpdatePayload.type = determinedType;

            const { error: updateErr } = await _supabase
                .from('profiles')
                .update(profileUpdatePayload)
                .eq('id', profileId);
                
            if (updateErr) throw updateErr;

        } else {
            // No profile with this name exists anywhere yet.
            if (editingIndex !== -1) {
                // EDIT MODE: Let's extract the target collection entry payload details
                const targetedCollection = (typeof getFilteredCollections === 'function') 
                    ? getFilteredCollections()[editingIndex] 
                    : (window.collections ? window.collections[editingIndex] : null);

                const { data: parentRecord } = await _supabase
                    .from('collections')
                    .select('customer_id')
                    .eq('id', targetedCollection.id)
                    .single();

                if (parentRecord && parentRecord.customer_id) {
                    // Check if this old profile ID container row is shared by other collections
                    const { count, error: countErr } = await _supabase
                        .from('collections')
                        .select('id', { count: 'exact', head: true })
                        .eq('customer_id', parentRecord.customer_id)
                        .neq('id', targetedCollection.id);

                    if (!countErr && count === 0) {
                        // Safe to change/rename the exclusive profile row directly
                        profileId = parentRecord.customer_id;
                        const { error: renameErr } = await _supabase
                            .from('profiles')
                            .update({
                                name: formattedCustomer,
                                address: address || 'N/A',
                                contact_num: contact || 'N/A',
                                category: currentCategory || 'Walk-ins',
                                type: determinedType
                         })
                            .eq('id', profileId);
                            
                        if (renameErr) throw renameErr;
                    } else {
                        // Profile is shared by other collections, so create a separate isolated unique profile row
                        const displayId = generateDisplayId('C');
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
                }
            } else {
                // INSERT MODE: Brand new profile instance generation
                const displayId = generateDisplayId('C');
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
        }

        // Setup unified collection payload referencing the resolved profile entity element reference
        const collectionPayload = { 
            customer_name: formattedCustomer, 
            date_collected: date, 
            address: address || 'N/A', 
            contact_number: contact || 'N/A', 
            type: currentCategory,
            customer_id: profileId
        };

        if (editingIndex !== -1) {
            const targetedCollection = (typeof getFilteredCollections === 'function') 
                ? getFilteredCollections()[editingIndex] 
                : (window.collections ? window.collections[editingIndex] : null);

            const targetId = targetedCollection.id;

            // Update parent collections details row
            const { error: headerUpdateError } = await _supabase
                .from('collections')
                .update(collectionPayload)
                .eq('id', targetId);

            if (headerUpdateError) throw headerUpdateError;

            // Clear old structural row items array
            const { error: itemsClearError } = await _supabase
                .from('collection_items')
                .delete()
                .eq('collection_id', targetId);
            
            if (itemsClearError) throw itemsClearError;
            
            // Reinsert new elements
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
            alert("Collection entry and profile details synchronized successfully!");

        } else {
            // Standard Insert Mode Pipeline Execution block
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
            alert("Collection entry saved successfully!");
        }

        closeAddModal();
        if (typeof fetchAllCollections === 'function') await fetchAllCollections();

    } catch (err) {
        console.error("Database Transaction Error:", err.message);
        alert("Failed to save: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = editingIndex !== -1 ? '<i data-lucide="check"></i> Update Entry' : '<i data-lucide="check"></i> Submit';
            safeRefreshIcons();
        }
    }
};

window.setupFieldListeners = function() {
    const inCustomer = document.getElementById('inCustomer');
    if (inCustomer) {
        inCustomer.addEventListener('input', () => { 
            if (inCustomer.value.trim()) clearError('inCustomer'); 
            updatePreview();
        });
        inCustomer.addEventListener('blur', () => {
            const val = inCustomer.value.trim();
            if (!val) showError('inCustomer', 'Customer name is required');
            else if (val.length > 100) showError('inCustomer', 'Max 100 characters');
            else clearError('inCustomer');
        });
    }

    const inDate = document.getElementById('inDate');
    if (inDate) {
        inDate.addEventListener('change', () => { 
            if (inDate.value) clearError('inDate'); else showError('inDate', 'Date is required'); 
            updatePreview();
        });
    }

    const inAddress = document.getElementById('inAddress');
    if (inAddress) {
        inAddress.addEventListener('input', () => {
            updatePreview();
        });
    }

    const inContact = document.getElementById('inContact');
    if (inContact) {
        inContact.addEventListener('input', () => {
            inContact.value = formatContact(inContact.value.replace(/[^\d]/g, '').slice(0, 11));
            clearError('inContact');
            updatePreview();
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
    safeRefreshIcons();
}

function closePreview() {
    const left = document.querySelector('.modal-left');
    const right = document.querySelector('.modal-right');
    if (!left || !right) return;

    right.classList.remove('show-preview');
    left.style.display = 'block';
    safeRefreshIcons();
}

// Automatically bind document listeners once DOMContentLoaded completes
document.addEventListener('DOMContentLoaded', () => {
    window.setupFieldListeners();
});
