// MODAL FUNCTIONS
window.openAddModal = () => {
  const modal = document.getElementById('addCollectionModal');
  if (!modal) return;

  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  editingIndex = -1;
  resetForm();

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('inDate').value = today;

  updatePreview();

  if (typeof lucide !== 'undefined') {
    setTimeout(() => lucide.createIcons(), 100);
  }
};

window.closeAddModal = () => {
  const modal = document.getElementById('addCollectionModal');
  if (!modal) return;

  modal.classList.remove('show');
  document.body.style.overflow = '';
  resetForm();
};

// VALIDATION HELPERS
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
  const cleaned = value.replace(/[-\s]/g, '');
  return /^09\d{9}$/.test(cleaned);
}

function formatContact(value) {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0,4)}-${cleaned.slice(4)}`;
  return `${cleaned.slice(0,4)}-${cleaned.slice(4,7)}-${cleaned.slice(7,11)}`;
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
  const modal = document.getElementById('addCollectionModal');
  if (modal && e.target === modal) {
    closeAddModal();
  }
});

// RESET FORM
function resetForm() {
  ['inCustomer', 'inDate', 'inAddress', 'inContact', 'inWeight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  clearAllErrors();

  currentItems = [];
  renderItems();

  currentCategory = 'School';
  document.querySelectorAll('.m-tab').forEach((tab, index) => {
    tab.classList.remove('active');
    if (index === 0) tab.classList.add('active');
  });

  const submitBtn = document.querySelector('.btn-submit-green');
  if (submitBtn) {
    submitBtn.onclick = () => submitCollection();
    submitBtn.innerHTML = '<i data-lucide="check"></i> Submit';
  }

  const previewFields = {
    'preCustomer': '---',
    'preDate': '---',
    'preAddress': '---',
    'preContact': '---',
    'preTotal': '₱0'
  };

  Object.entries(previewFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

// CATEGORY SELECTION
window.setCategory = (category, btn) => {
  currentCategory = category;
  document.querySelectorAll('.m-tab').forEach(tab => tab.classList.remove('active'));
  btn.classList.add('active');
  updatePreview();
};

// LIVE PREVIEW FUNCTION
window.updatePreview = function() {
  const customer = document.getElementById('inCustomer')?.value || '---';
  const date = document.getElementById('inDate')?.value || '---';
  const address = document.getElementById('inAddress')?.value || '---';
  const contact = document.getElementById('inContact')?.value || '---';

  let formattedDate = date;
  if (date !== '---') {
    const d = new Date(date);
    formattedDate = d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  const updates = {
    'preCustomer': customer,
    'preDate': formattedDate,
    'preAddress': address,
    'preContact': contact
  };

  Object.entries(updates).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  });
};

// ADD ITEM TO LIST
window.addItem = function() {
  const sel = document.getElementById('selMaterial');
  const weightInput = document.getElementById('inWeight');

  if (!sel || !weightInput) return;

  const weight = Number(weightInput.value);
  const rate = Number(sel.selectedOptions[0].dataset.rate);
  const material = sel.value;

  if (!weight || weight <= 0) {
    showError('inWeight', 'Please enter a valid weight');
    weightInput.focus();
    return;
  }

  if (weight > 10000) {
    showError('inWeight', 'Invalid weight. Please enter a value between 1 and 10,000.');
    weightInput.focus();
    return;
  }

  clearError('inWeight');
  const itemsErr = document.getElementById('itemsError');
  if (itemsErr) itemsErr.textContent = '';

  currentItems.push({ material, rate, weight, subtotal: rate * weight });

  weightInput.value = '';
  weightInput.focus();

  renderItems();
};

// RENDER ITEMS — Form table and Receipt preview
function renderItems() {
  const itemsBody = document.getElementById('itemsBody');
  const preItemsBody = document.getElementById('preItemsBody');
  const formTotalLine = document.getElementById('formTotalLine');

  if (!itemsBody || !preItemsBody) return;

  let total = 0;
  itemsBody.innerHTML = '';
  preItemsBody.innerHTML = '';

  if (currentItems.length === 0) {
    itemsBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: #94a3b8; padding: 20px;">No items added yet</td></tr>';
    preItemsBody.innerHTML = '<tr><td colspan="4" style="text-align:center; color: #94a3b8; padding: 20px;">No items</td></tr>';
    if (formTotalLine) formTotalLine.style.display = 'none';
  } else {
    currentItems.forEach((item, index) => {
      total += item.subtotal;

      itemsBody.innerHTML += `
        <tr>
          <td>${item.material}</td>
          <td>₱${item.rate}</td>
          <td>${item.weight} kg</td>
          <td><strong>₱${item.subtotal.toFixed(2)}</strong></td>
          <td>
            <button class="remove-item-btn" onclick="removeItem(${index})" title="Remove item">
              <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
            </button>
          </td>
        </tr>
      `;

      preItemsBody.innerHTML += `
        <tr>
          <td style="text-align:center;">${item.weight}</td>
          <td style="text-align:center;">kg</td>
          <td style="text-align:left;">${item.material}</td>
          <td style="text-align:center;">₱${item.rate}</td>
          <td style="text-align:center;">₱${item.subtotal.toFixed(2)}</td>
        </tr>
      `;
    });

    if (formTotalLine) {
      formTotalLine.style.display = 'flex';
      const formTotalEl = document.getElementById('formTotal');
      if (formTotalEl) formTotalEl.innerText = `₱${total.toFixed(2)}`;
    }
  }

  const emptyRowsNeeded = Math.max(0, 8 - currentItems.length);
  for (let i = 0; i < emptyRowsNeeded; i++) {
    preItemsBody.innerHTML += '<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td></tr>';
  }

  const preTotalEl = document.getElementById('preTotal');
  if (preTotalEl) preTotalEl.innerText = `₱${total.toFixed(2)}`;

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// REMOVE ITEM
window.removeItem = (index) => {
  currentItems.splice(index, 1);
  renderItems();
};

// SUBMIT COLLECTION
// UPDATED SUBMIT COLLECTION FOR SUPABASE
// UPDATED SUBMIT COLLECTION FOR SUPABASE
window.submitCollection = async function() {
    const customer = document.getElementById('inCustomer')?.value.trim();
    const date = document.getElementById('inDate')?.value;
    const address = document.getElementById('inAddress')?.value.trim();
    const contact = document.getElementById('inContact')?.value.trim();
    const submitBtn = document.querySelector('.btn-submit-green');

    clearAllErrors();
    let hasError = false;

    // --- Standard Validations (Existing Logic) ---
    if (!customer) {
        showError('inCustomer', 'Customer name is required');
        hasError = true;
    }
    if (!date) {
        showError('inDate', 'Date is required');
        hasError = true;
    }
    if (contact && !validateContact(contact)) {
        showError('inContact', 'Use format: 09XX-XXX-XXXX');
        hasError = true;
    }
    if (currentItems.length === 0) {
        const itemsErr = document.getElementById('itemsError');
        if (itemsErr) itemsErr.textContent = 'Please add at least one item';
        hasError = true;
    }
    if (hasError) return;

    // --- Supabase Integration Logic ---
    try {
        // Disable button to prevent double-submitting
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Saving...';
        }

        if (editingIndex !== -1) {
            // OPTIONAL: Logic for updating existing records would go here
            alert("Edit mode via Supabase coming soon! Currently only supporting new adds.");
        } else {
            // 1. Insert the Header (The Collection)
            const { data: headerData, error: headerError } = await _supabase
                .from('collections')
                .insert([{
                    customer_name: customer,
                    date_collected: date,
                    address: address,
                    contact_number: contact,
                    type: currentCategory // 'School', 'Barangay', etc.
                }])
                .select()
                .single();

            if (headerError) throw headerError;

          // --- ADDED: SYNC TO PROFILES TABLE ---
            // This ensures the Profile page reflects the latest info
            const { error: profileError } = await _supabase
                .from('profiles')
                .upsert({
                    name: customer,
                    address: address,
                    contact_num: contact,
                    type: currentCategory
                }, { 
                    onConflict: 'name' 
                });

            if (profileError) {
                console.warn("Profile synced with issues:", profileError.message);
                // We don't 'throw' here so the collection still saves even if profile sync blips
            }
            // ---------------------------------------

            // 2. Insert the Line Items linked to that Header ID
            const itemsToInsert = currentItems.map(item => ({
                collection_id: headerData.id, // Linking to the UUID created above
                material_name: item.material,
                rate: item.rate,
                weight: item.weight,
                subtotal: item.subtotal
            }));

            const { error: itemsError } = await _supabase
                .from('collection_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;
        }

        // --- Success Handlers ---
        alert("Collection saved to database!");
        closeAddModal();
        
        // Refresh the main table in collection.js
        if (typeof fetchAllCollections === 'function') {
            await fetchAllCollections(); 
        }

    } catch (err) {
        console.error("Database Error:", err.message);
        alert("Failed to save: " + err.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check"></i> Submit';
            lucide.createIcons();
        }
    }
};

// REAL-TIME FIELD LISTENERS
window.setupFieldListeners = function() {
  const inCustomer = document.getElementById('inCustomer');
  if (inCustomer) {
    inCustomer.addEventListener('input', () => {
      if (inCustomer.value.trim()) clearError('inCustomer');
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
      if (inDate.value) clearError('inDate');
      else showError('inDate', 'Date is required');
    });
  }

  const inContact = document.getElementById('inContact');
  if (inContact) {
    inContact.addEventListener('input', () => {
      // FIX: removed unused `pos` variable (was captured via selectionStart but never applied back)
      const raw = inContact.value.replace(/[^\d]/g, '').slice(0, 11);
      inContact.value = formatContact(raw);
      clearError('inContact');
    });
    inContact.addEventListener('blur', () => {
      const val = inContact.value.trim();
      if (val && !validateContact(val)) {
        showError('inContact', 'Use format: 09XX-XXX-XXXX');
      } else {
        clearError('inContact');
      }
    });
  }

  const inWeight = document.getElementById('inWeight');
  if (inWeight) {
    inWeight.addEventListener('input', () => clearError('inWeight'));
  }
};

// MOBILE PREVIEW TOGGLE
function togglePreview() {
  const left = document.querySelector('.modal-left');
  const right = document.querySelector('.modal-right');

  right.classList.add('show-preview');
  left.style.display = 'none';

  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closePreview() {
  const left = document.querySelector('.modal-left');
  const right = document.querySelector('.modal-right');

  right.classList.remove('show-preview');
  left.style.display = 'block';

  if (typeof lucide !== 'undefined') lucide.createIcons();
}
