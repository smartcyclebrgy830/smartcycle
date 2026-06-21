window.editingIndex = typeof window.editingIndex !== 'undefined' ? window.editingIndex : -1;
window.currentCategory = typeof window.currentCategory !== 'undefined' ? window.currentCategory : 'School';
window.currentItems = window.currentItems || []; 

document.addEventListener('DOMContentLoaded', () => {
 
let loadedPricesCache = [];

function generateDisplayId(prefix) {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

window.openAddModal = async () => {
    const modal = document.getElementById('addCollectionModal');
    if (!modal) return;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    window.editingIndex = -1; 
    resetForm();

    if (window._listenersInitialized) return;
    window._listenersInitialized = true;
    setupFieldListeners();
    // Dynamically fetch and fill up material prices matching your Price List dashboard
    await loadActivePrices();

    document.getElementById('inDate').value = new Date().toISOString().split('T')[0];
    updatePreview();
    setTimeout(refreshIcons, 100);
};

window.openEditModal = async (index, collectionHeader, detailedItems) => {
    const modal = document.getElementById('addCollectionModal');
    if (!modal) return;

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    window.editingIndex = parseInt(index, 10); 
    clearAllErrors();

    await loadActivePrices();

    window.currentCategory = collectionHeader.type || 'School';
    document.querySelectorAll('.m-tab').forEach(tab => {
        const tabCategory = tab.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
        tab.classList.toggle('active', tabCategory === window.currentCategory);
    });

    if (document.getElementById('inCustomer')) document.getElementById('inCustomer').value = collectionHeader.customer_name || '';
    if (document.getElementById('inDate')) document.getElementById('inDate').value = collectionHeader.date_collected || '';
    if (document.getElementById('inAddress')) document.getElementById('inAddress').value = collectionHeader.address || '';
    if (document.getElementById('inContact')) document.getElementById('inContact').value = collectionHeader.contact_number || '';

    window.currentItems = (detailedItems || []).map(item => {
        const materialId = parseInt(item.material_id || item.price_list?.id, 10);
    
        const cachedItem = loadedPricesCache.find(
            p => parseInt(p.id, 10) === materialId
        );
    
        const materialName =
            item.price_list?.material_name ||
            item.material_name ||
            (cachedItem ? cachedItem.material_name : null);
    
        return {
            materialId: materialId,
            material_id: materialId,
            material: materialName || 'Unknown',
            material_name: materialName || 'Unknown',
            rate: Number(item.rate ?? cachedItem?.price ?? 0),
            weight: Number(item.weight || 0),
            subtotal: Number(item.subtotal || 0)
        };
    });
    if (window.currentItems.length > 0) {
        const selMaterial = document.getElementById('selMaterial');
        if (selMaterial) {
           selMaterial.value = window.currentItems[0].material_id; 
           selMaterial.dispatchEvent(new Event('change'));
        }
    }

    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) {
        submitBtn.onclick = null;
        submitBtn.onclick = (e) => window.submitCollection(e);
        submitBtn.innerHTML = '<i data-lucide="check"></i> Update Entry';
    }

    updatePreview();
    renderItems();
    setTimeout(refreshIcons, 100);
};

async function loadActivePrices() {
    const selMaterial = document.getElementById('selMaterial');
    if (!selMaterial) return;

    try {
        // Corrected target table to 'price_list' and selected the correct columns matching your dashboard
        const { data: prices, error } = await _supabase
            .from('price_list')
            .select('id, material_name, price, status')
            .eq('status', 'Active'); // Ensures only Active rows are pulled

        if (error) throw error;

        if (prices && prices.length > 0) {
            loadedPricesCache = prices; 
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
        
        // Updated hardcoded fallback IDs to precisely match your actual Supabase table IDs
        loadedPricesCache = [
            { id: 4, material_name: "Plastic", price: 6 },
            { id: 5, material_name: "Bakal", price: 13 },
            { id: 6, material_name: "Paper Assorted", price: 8 },
            { id: 7, material_name: "Yero", price: 7 },
            { id: 8, material_name: "PET Assorted", price: 5 }
        ];
        
        selMaterial.innerHTML = `
            <option value="4" data-name="Plastic" data-rate="6" selected>Plastic - ₱6/kg</option>
            <option value="5" data-name="Bakal" data-rate="13">Bakal - ₱13/kg</option>
            <option value="6" data-name="Paper Assorted" data-rate="8">Paper Assorted - ₱8/kg</option>
            <option value="7" data-name="Yero" data-rate="7">Yero - ₱7/kg</option>
            <option value="8" data-name="PET Assorted" data-rate="5">PET Assorted - ₱5/kg</option>
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

document.addEventListener('click', (e) => {
    const modal = document.getElementById('addCollectionModal');
    if (modal && e.target === modal) {
        window.closeAddModal();
    }
});

document.addEventListener('click', function (e) {
    const inCustomer = document.getElementById('inCustomer');
    const suggestionsBox = document.getElementById('customerSuggestions');
   if (
       inCustomer &&
       suggestionsBox &&
       !inCustomer.contains(e.target) &&
       !suggestionsBox.contains(e.target)
   ) {
       suggestionsBox.style.display = 'none';
   }
});

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

    const cleaned = value.replace(/\D/g, '');
    return /^09\d{9}$/.test(cleaned);
}

function formatContact(value) {
    // 1. Instantly strip out all non-numeric characters (handles paste-ins safely)
    let cleaned = value.replace(/\D/g, '');

    // 2. If completely empty, allow clearing the field
    if (!cleaned) return '';

    // 3. Guarantee that it starts with '09'
    if (!cleaned.startsWith('09')) {
        if (cleaned.startsWith('9')) {
            cleaned = '0' + cleaned;
        } else {
            cleaned = '09' + cleaned;
        }
    }

    // 4. Hard cap the raw digits to 11
    cleaned = cleaned.slice(0, 11);

    // 5. Build out the 09XX-XXX-XXXX dash sequence systematically
    let parts = [];
    if (cleaned.length > 0) parts.push(cleaned.slice(0, 4));  // 09XX
    if (cleaned.length > 4) parts.push(cleaned.slice(4, 7));  // XXX
    if (cleaned.length > 7) parts.push(cleaned.slice(7, 11)); // XXXX

    return parts.join('-');
}

function resetForm() {
    ['inCustomer', 'inDate', 'inAddress', 'inContact', 'inWeight'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    clearAllErrors();
    window.currentItems = []; 
    window.editingIndex = -1; // Reset unified global tracking reference

    window.currentCategory = 'School';
    document.querySelectorAll('.m-tab').forEach((tab, idx) => {
        tab.classList.toggle('active', idx === 0);
    });

    const submitBtn = document.querySelector('.btn-submit-green');
    if (submitBtn) {
        submitBtn.onclick = (e) => window.submitCollection(e);
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
    window.currentCategory = category;
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

window.addItem = function() {
    const sel = document.getElementById('selMaterial');
    const weightInput = document.getElementById('inWeight');
    if (!sel || !weightInput) return;

    const weight = Number(weightInput.value);
    const selectedOption = sel.selectedOptions[0];
    
    const materialId = parseInt(sel.value, 10); 
    
    // 1. Attempt to find the rate from dataset, fallback to cache, fallback to parsing text
    const cachedItem = loadedPricesCache.find(p => parseInt(p.id, 10) === materialId);
    const rate = Number(selectedOption?.dataset.rate || cachedItem?.price || 0);
    
    // 2. Extract material name reliably even if data-name attribute is completely missing
    let materialName = selectedOption?.dataset.name || cachedItem?.material_name;
    
    if (!materialName && selectedOption) {
        // Splits text at '(' or '-' and trims whitespace to isolate just the name string
        materialName = selectedOption.textContent.split(/[(-]/)[0].trim();
    }

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
                    <button type="button" class="remove-item-btn" onclick="removeItem(${index})" title="Remove item">
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
    }

    itemsBody.innerHTML = mainRowsHtml || '<tr><td colspan="5" style="text-align:center; color: #94a3b8; padding: 20px;">No items added yet</td></tr>';
    preItemsBody.innerHTML = previewRowsHtml || '<tr><td colspan="5" style="text-align:center; color: #94a3b8; padding: 20px;">No items</td></tr>';

    if (window.currentItems.length > 0 && formTotalLine) {
        formTotalLine.style.display = 'flex';
        const formTotalEl = document.getElementById('formTotal');
        if (formTotalEl) formTotalEl.innerText = `₱${total.toFixed(2)}`;
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

window.submitCollection = async function(e) {
    // Intercept native browser handling to block structural resets mid-operation
    if (e) {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        if (typeof e.stopPropagation === 'function') e.stopPropagation();
    } else if (window.event) {
        window.event.preventDefault();
    }

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
            submitBtn.innerHTML = window.editingIndex !== -1 ? 'Updating...' : 'Saving...';
        }

        const formattedCustomer = toTitleCase(customer);
        const collectionPayload = { 
            customer_name: formattedCustomer, 
            date_collected: date, 
            address: address || 'N/A', 
            contact_number: contact || 'N/A', 
            type: window.currentCategory 
        };

        // VARIABLE TO TRACK THE TARGET COLLECTION ID FOR ITEM INSERTION
        let activeCollectionId = null;

        if (window.editingIndex !== -1) {
            // --- UPDATE MODE ---
            const targetedCollection = (typeof getFilteredCollections === 'function') 
                ? getFilteredCollections()[window.editingIndex] 
                : window.collections[window.editingIndex];

            if (!targetedCollection || !targetedCollection.id) {
                throw new Error("Unable to identify targeted collection ID context.");
            }

            const targetId = targetedCollection.id;
            activeCollectionId = targetId; // Assign for item insertion later

            // 1. Fetch the actual customer_id directly from the database 
            const { data: dbCollection, error: fetchErr } = await _supabase
                .from('collections')
                .select('customer_id, customer_name')
                .eq('id', targetId)
                .single();

            if (fetchErr) throw fetchErr;

            let actualCustomerId = targetedCollection.customer_id || (dbCollection ? dbCollection.customer_id : null);

            // Fallback: If customer_id is somehow still missing, lookup by original name
            if (!actualCustomerId && dbCollection && dbCollection.customer_name) {
                const { data: fallbackProfile } = await _supabase
                    .from('profiles')
                    .select('id')
                    .ilike('name', dbCollection.customer_name)
                    .maybeSingle();
                
                if (fallbackProfile) actualCustomerId = fallbackProfile.id;
            }

            // 2. Sync header changes in 'collections'
            const { error: headerUpdateError } = await _supabase
                .from('collections')
                .update(collectionPayload)
                .eq('id', targetId);

            if (headerUpdateError) throw headerUpdateError;

            // 3. Update the linked profile reliably
            if (actualCustomerId) {
                const { error: profileUpdateError } = await _supabase
                    .from('profiles')
                    .update({
                        name: formattedCustomer,
                        category: window.currentCategory || 'Walk-ins',
                        address: address || 'N/A',
                        contact_num: contact || 'N/A'
                    })
                    .eq('id', actualCustomerId);

                if (profileUpdateError) throw profileUpdateError;
            }

            // 4. Safely wipe out sub-item rows to overwrite additions/removals smoothly
            const { error: itemsClearError } = await _supabase
                .from('collection_items')
                .delete()
                .eq('collection_id', targetId);
            
            if (itemsClearError) throw itemsClearError;

            alert("Collection entry updated successfully!");
            if (typeof logAction === 'function') {
                logAction(`Updated collection for ${formattedCustomer}`, window.location.pathname);
            }

        } else {
            // --- INSERT MODE ---
            const displayId = generateDisplayId('C');
            let profileId = null;
            
            const { data: existingProfile } = await _supabase
                .from('profiles')
                .select('id, name, address, contact_num')
                .ilike('name', formattedCustomer)
                .maybeSingle();
            
            let determinedType = 'customer'; 

            if (existingProfile) {
                profileId = existingProfile.id;
                const updatePayload = {};
                
                if (existingProfile.name !== formattedCustomer) updatePayload.name = formattedCustomer;
                if (existingProfile.address === 'N/A' || !existingProfile.address) updatePayload.address = address || 'N/A';
                if (existingProfile.contact_num === 'N/A' || !existingProfile.contact_num) updatePayload.contact_num = contact || 'N/A';
                
                updatePayload.category = window.currentCategory || 'Walk-ins';
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
            
            const { data: headerData, error: headerError } = await _supabase
                .from('collections')
                .insert([collectionPayload])
                .select()
                .single();
            
            if (headerError) throw headerError;
            
            activeCollectionId = headerData.id; // Assign for item insertion later
            alert("Collection entry added successfully!");

            if (typeof logAction === 'function') {
                logAction(`Added collection for ${formattedCustomer}`, window.location.pathname);
            }
        }

        // --- SHARED ITEM INSERTION FOR BOTH MODES ---
        // Ensure we have a valid collection ID before proceeding
        if (activeCollectionId) {
            const itemsToInsert = window.currentItems.map(item => ({
                collection_id: activeCollectionId,
                material_id: parseInt(item.materialId || item.material_id, 10), 
                rate: Number(item.rate),
                weight: Number(item.weight),
                subtotal: Number(item.subtotal)
            }));
            
            const { error: itemsError } = await _supabase
                .from('collection_items')
                .insert(itemsToInsert);
        
            if (itemsError) throw itemsError;
        }

        window.closeAddModal();
        if (typeof fetchAllCollections === 'function') await fetchAllCollections();

    } catch (err) {
        console.error("Database Transaction Error:", err.message);
        alert("Failed to save: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            if (window.editingIndex !== -1) {
                submitBtn.innerHTML = '<i data-lucide="check"></i> Update Entry';
            } else {
                submitBtn.innerHTML = '<i data-lucide="check"></i> Submit';
            }
            if (typeof refreshIcons === 'function') refreshIcons();
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
        inContact.addEventListener('input', (e) => {
            // Apply clean mask formatting
            e.target.value = formatContact(e.target.value);
            
            // Force-sync preview immediately so the receipt matches character-for-character
            if (typeof updatePreview === 'function') {
                updatePreview();
            }
            clearError('inContact');
        });
    
        // Explicitly block non-numeric typing at keystroke level
        inContact.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });
    
        // Optional Quality of Life: Auto-fill '09' when user clicks into an empty field
        inContact.addEventListener('focus', (e) => {
            if (!e.target.value) {
                e.target.value = '09';
                if (typeof updatePreview === 'function') updatePreview();
            }
        });
    }
    const inWeight = document.getElementById('inWeight');
    if (inWeight) {
        inWeight.addEventListener('input', () => clearError('inWeight'));
    }
    const suggestionsBox = document.getElementById('customerSuggestions');    
    if (inCustomer && suggestionsBox) {
        let profilesCache = [];
    
        async function loadProfiles() {
            // ✅ FIX: Use window._supabase to avoid cross-file reference errors
            const { data, error } = await window._supabase
             .from('profiles')
             .select('name, address, contact_number')
             .is('auth_id', null) // ✅ ADD THIS: Only fetches rows where auth_id is empty/null
             .order('name', { ascending: true });
        
            if (!error && data) {
                profilesCache = data;
        
                if (profilesCache.length > 0) {
                    inCustomer.placeholder = `Ex: ${profilesCache[0].name}`;
                }
            }
        }
    
        // 🔥 CALL THIS IMMEDIATELY
        loadProfiles();

        inCustomer.addEventListener('focus', () => {
            suggestionsBox.innerHTML = '';
    
            profilesCache.slice(0, 5).forEach(p => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = p.name;
    
             div.onclick = () => {
                 // 1. Fill the customer name
                 inCustomer.value = p.name;
                 
                 // 2. Target the other input fields
                 const addrInput = document.getElementById('inAddress');
                 const contactInput = document.getElementById('inContact');
                 
                 // 3. Auto-fill the data if it exists in the database
                 if (addrInput) addrInput.value = p.address || '';
                 if (contactInput) {
                     contactInput.value = p.contact_number || '';
                     
                     // 🔥 Trigger the input event manually so your strict phone number mask applies to the auto-filled data
                     contactInput.dispatchEvent(new Event('input')); 
                 }
             
                 // 4. Clean up the UI
                 suggestionsBox.style.display = 'none';
                 clearError('inCustomer');
                 if (typeof updatePreview === 'function') updatePreview();
             };
    
                suggestionsBox.appendChild(div);
            });
    
            suggestionsBox.style.display = profilesCache.length ? 'block' : 'none';
        });
        
        inCustomer.addEventListener('input', function () {
            const query = this.value.toLowerCase().trim();
    
            suggestionsBox.innerHTML = '';
    
            if (!query) {
                suggestionsBox.style.display = 'none';
                return;
            }
    
            const filtered = profilesCache.filter(p =>
                p.name.toLowerCase().includes(query)
            ).sort((a, b) => {
                // Sort so that names STARTING with the query appear first
                const aStarts = a.name.toLowerCase().startsWith(query);
                const bStarts = b.name.toLowerCase().startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return 0;
            }).slice(0, 5); // limit results
    
            if (!filtered.length) {
                suggestionsBox.style.display = 'none';
                return;
            }
    
            filtered.forEach(p => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.textContent = p.name;
    
            div.onclick = () => {
                // 1. Fill the customer name
                inCustomer.value = p.name;
                
                // 2. Target the other input fields
                const addrInput = document.getElementById('inAddress');
                const contactInput = document.getElementById('inContact');
                
                // 3. Auto-fill the data if it exists in the database
                if (addrInput) addrInput.value = p.address || '';
                if (contactInput) {
                    contactInput.value = p.contact_number || '';
                    
                    // 🔥 Trigger the input event manually so your strict phone number mask applies to the auto-filled data
                    contactInput.dispatchEvent(new Event('input')); 
                }
            
                // 4. Clean up the UI
                suggestionsBox.style.display = 'none';
                clearError('inCustomer');
                if (typeof updatePreview === 'function') updatePreview();
            };
    
                suggestionsBox.appendChild(div);
            });
    
            suggestionsBox.style.display = 'block';
        });
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
});
