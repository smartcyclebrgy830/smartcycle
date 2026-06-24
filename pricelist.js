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

let currentUserRole = null;

async function getUserRole() {
    const { data: { user }, error: userError } =  await _supabase.auth.getUser();

    if (userError || !user) {
        console.error('User not found');
        return null;
    }

    const { data, error } = await _supabase
        .from('profiles')
        .select('type')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Error fetching role:', error);
        return null;
    }

    return data.type; // Super Admin, Admin, Moderator
}

async function initRoleControl() {
    currentUserRole = await getUserRole();

    const addBtn = document.getElementById('addItemBtn');

    if (currentUserRole !== 'Super Admin') {
        // Hide Add button
        if (addBtn) addBtn.style.display = 'none';

        // Remove ACTION column header
        const actionHeader = document.querySelector('.action-column');
        if (actionHeader) actionHeader.remove();
    }
}

document.addEventListener('DOMContentLoaded', () => {

    let editRow = null;
    let currentSearch = '';
    let allRows = [];
    let currentPage = 1;
    const itemsPerPage = 10;

    const addItemBtn        = document.getElementById('addItemBtn');
    const modalOverlay      = document.getElementById('itemModalOverlay');
    const cancelBtn         = document.getElementById('cancelBtn');
    const saveBtn           = document.getElementById('saveBtn');
    const modalTitle        = document.getElementById('modalTitle');
    const materialNameInput = document.getElementById('materialName');
    const unitSelect        = document.getElementById('unit');
    const priceInput        = document.getElementById('itemPrice');
    const searchInput       = document.getElementById('priceSearch');

    // OPEN MODAL
    function openModal(isEdit = false) {
        if (isEdit) {
            modalTitle.textContent = 'Edit Item';
            saveBtn.innerHTML = '<i data-lucide="check" style="width:15px;height:15px;"></i> Save Changes';
            if (typeof lucide !== 'undefined') lucide.createIcons();
        } else {
            modalTitle.textContent = 'Add New Material';
            saveBtn.innerHTML = '<i data-lucide="check" style="width:15px;height:15px;"></i> Add Item';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            editRow                 = null;
            materialNameInput.value = '';
            unitSelect.value        = 'per kg';
            priceInput.value        = '';
        }
        modalOverlay.style.display         = 'flex';
        modalOverlay.style.alignItems      = 'center';
        modalOverlay.style.justifyContent  = 'center';
        modalOverlay.setAttribute('aria-hidden', 'false');
        setTimeout(() => materialNameInput.focus(), 50);
    }

    // CLOSE MODAL
    function closeModal() {
        modalOverlay.style.display = 'none';
        modalOverlay.setAttribute('aria-hidden', 'true');
        editRow                 = null;
        materialNameInput.value = '';
        unitSelect.value        = 'per kg';
        priceInput.value        = '';
        clearAllFieldErrors();
    }

    addItemBtn?.addEventListener('click', () => openModal(false));
    cancelBtn?.addEventListener('click', closeModal);

    // Close on backdrop click
    modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.style.display === 'flex') closeModal();
    });

    // INLINE VALIDATION HELPERS
    function showFieldError(input, message) {
        input.style.borderColor = '#d25353';
        input.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.1)';
        let err = input.parentElement.querySelector('.field-error');
        if (!err) {
            err = document.createElement('span');
            err.className = 'field-error';
            input.parentElement.appendChild(err);
        }
        err.style.display = 'block';
        err.textContent = message;
        err.classList.add('show');
    }

    function clearFieldError(input) {
        input.style.borderColor = '';
        input.style.boxShadow = '';
        const err = input.parentElement.querySelector('.field-error');
        if (err) {
            err.classList.remove('show');
            err.textContent = '';
            err.style.display = 'none';
        }
    }

    function clearAllFieldErrors() {
        [materialNameInput, priceInput].forEach(clearFieldError);
    }

    // Clear errors on input
    materialNameInput?.addEventListener('input', () => clearFieldError(materialNameInput));
    priceInput?.addEventListener('input', () => clearFieldError(priceInput));

    // SAVE
    saveBtn?.addEventListener('click', async () => {
        if (currentUserRole !== 'Super Admin') {
            alert('Unauthorized action.');
            return;
        }
        const material = materialNameInput.value.trim();
        const unit     = unitSelect.value;
        const price    = priceInput.value.trim();
    
        clearAllFieldErrors();
        let hasError = false;
    
        if (!material) {
            showFieldError(materialNameInput, 'Material name is required.');
            hasError = true;
        }
        if (!price) {
            showFieldError(priceInput, 'Price is required.');
            hasError = true;
        } else if (parseFloat(price) < 0) {
            showFieldError(priceInput, 'Price must be positive.');
            hasError = true;
        }
    
        if (hasError) return;
    
        let result;
    
        if (editRow) {
            // UPDATE EXISTING ITEM
            const id = editRow.dataset.id;
    
            const { data, error } = await _supabase
                .from('price_list')
                .update({
                    material_name: material,
                    unit: unit,
                    price: parseFloat(price)
                })
                .eq('id', id)
                .select();
    
            if (error) {
                alert('Update failed: ' + error.message);
                return;
            }
             logAction(
                'Updated material',
                `Updated "${material}" (Unit: ${unit}, Price: ₱${parseFloat(price).toFixed(2)})`
            );
            // Update UI row
            editRow.cells[0].textContent = material;
            editRow.cells[1].textContent = unit;
            editRow.cells[2].textContent = `₱${parseFloat(price).toFixed(2)}`;
    
        } else {
            // INSERT NEW ITEM
            const { data, error } = await _supabase
                .from('price_list')
                .insert([
                    {
                        material_name: material,
                        unit: unit,
                        price: parseFloat(price)
                    }
                ])
                .select();
    
            if (error) {
                alert('Insert failed: ' + error.message);
                return;
            }
            logAction(
                'Added material',
                `Added "${material}" (Unit: ${unit}, Price: ₱${parseFloat(price).toFixed(2)})`
            );
            allItems.push(data[0]);
            renderTable(); // Note: ensure renderTable() exists or use loadPriceList()

            // === ADD NATIVE ALERT HERE ===
            alert(`Success! "${material}" has been added to the price list.`);
        }
    
        closeModal();
        checkEmptyState();
    });

    // RENDER ROW
    function renderRow(item) {
        const tableBody = document.getElementById('priceTableBody');
        const row = document.createElement('tr');
    
        row.dataset.id = item.id;
    
        let actionColumn = '';
    
        // ONLY Super Admin sees Edit/Delete
        if (currentUserRole === 'Super Admin') {
            actionColumn = `
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-btn" type="button">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="action-btn delete-btn" type="button">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            `;
        }
    
        row.innerHTML = `
            <td>${item.material_name}</td>
            <td>${item.unit}</td>
            <td>₱${parseFloat(item.price).toFixed(2)}</td>
            ${actionColumn}
        `;
    
        // Only attach events if Super Admin
        if (currentUserRole === 'Super Admin') {
            row.querySelector('.edit-btn')?.addEventListener('click', () => editItem(row));
            row.querySelector('.delete-btn')?.addEventListener('click', () => deleteItem(row));
        }
    
        tableBody.appendChild(row);
    
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // EDIT
    function editItem(row) {
        editRow                 = row;
        materialNameInput.value = row.cells[0].textContent;
        unitSelect.value        = row.cells[1].textContent;
        priceInput.value        = row.cells[2].textContent.replace('₱', '');
        openModal(true);
    }

    // DELETE CONFIRMATION MODAL
    function showDeleteConfirm(name, onConfirm) {
        let overlay = document.getElementById('deleteConfirmOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'deleteConfirmOverlay';
            overlay.className = 'delete-confirm-overlay';
            overlay.innerHTML = `
                <div class="delete-confirm-box">
                    <div class="delete-confirm-icon">
                        <i data-lucide="trash-2" style="color:#ef4444"></i>
                    </div>
                    <h2 class="delete-confirm-title">Delete Item</h2>
                    <p class="delete-confirm-msg" id="deleteConfirmMsg"></p>
                    <div class="delete-confirm-actions">
                        <button class="btn-confirm-cancel" id="deleteConfirmCancel">Cancel</button>
                        <button class="btn-confirm-delete" id="deleteConfirmOk">Delete</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);
        }

        document.getElementById('deleteConfirmMsg').textContent =
            `Are you sure you want to delete "${name}"? This action cannot be undone.`;

        overlay.classList.add('open');
        if (typeof lucide !== 'undefined') lucide.createIcons();

        const cancelBtn = document.getElementById('deleteConfirmCancel');
        const okBtn = document.getElementById('deleteConfirmOk');

        function close() {
            overlay.classList.remove('open');
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
            okBtn.replaceWith(okBtn.cloneNode(true));
        }

        document.getElementById('deleteConfirmCancel').addEventListener('click', close);
        document.getElementById('deleteConfirmOk').addEventListener('click', () => {
            close();
            onConfirm();
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });
    }

    // DELETE
    function deleteItem(row) {
        if (currentUserRole !== 'Super Admin') {
            alert('Unauthorized action.');
            return;
        }
        const id = row.dataset.id;
        const name = row.cells[0].textContent;
    
        showDeleteConfirm(name, async () => {
    
            const { error } = await _supabase
                .from('price_list')
                .delete()
                .eq('id', id);
    
            if (error) {
                alert('Delete failed: ' + error.message);
                return;
            }
            logAction(
                'Deleted material',
                `Deleted "${name}" (ID: ${id})`
            );
            allRows = allRows.filter(r => String(r.id) !== String(id));
            checkEmptyState();
        });
    }

    // ITEM COUNT
    function updateItemCount(count) {
        const countEl = document.getElementById('itemCount');
        if (!countEl) return;
        const total = count !== undefined ? count : allRows.length;
        countEl.textContent = total === 1 ? '1 material' : `${total} materials`;
    }
    
    function checkEmptyState() {
        renderPage();
    }


    async function loadPriceList() {
        const { data, error } = await _supabase
            .from('price_list')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) { console.error('Error loading data:', error); return; }
        
        allRows = data;
        currentPage = 1;
        renderPage();
    }

    // SEARCH
    function applySearch() {
        currentPage = 1;
        renderPage();
    }

    function getFilteredRows() {
        if (!currentSearch) return allRows;
        return allRows.filter(item =>
            item.material_name.toLowerCase().includes(currentSearch)
        );
    }
    
    function renderPage() {
        const tableBody = document.getElementById('priceTableBody');
        tableBody.innerHTML = '';
        
        const filtered = getFilteredRows();
        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const startIdx = (currentPage - 1) * itemsPerPage;
        const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);
        
        pageItems.forEach(item => renderRow(item));
        
        const empty = document.getElementById('emptyState');
        if (empty) empty.style.display = filtered.length === 0 ? 'flex' : 'none';
        
        updateItemCount(filtered.length);
        updatePagination(totalPages);
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
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
        
        let html = `
        <button class="page-btn" onclick="pricelistChangePage('prev')" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''}>
            <i data-lucide="chevron-left"></i>
        </button>
        <button class="page-btn ${currentPage === 1 ? 'active' : ''}" onclick="pricelistGoToPage(1)">1</button>
        `;
        
        if (currentPage > 3) html += `<span class="page-btn" style="cursor:default;border:none;">...</span>`;
        
        for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
            html += `<button class="page-btn ${currentPage === i ? 'active' : ''}" onclick="pricelistGoToPage(${i})">${i}</button>`;
        }
        
        if (currentPage < totalPages - 2) html += `<span class="page-btn" style="cursor:default;border:none;">...</span>`;
        
        if (totalPages > 1) {
            html += `<button class="page-btn ${currentPage === totalPages ? 'active' : ''}" onclick="pricelistGoToPage(${totalPages})">${totalPages}</button>`;
        }
        
        html += `
        <button class="page-btn" onclick="pricelistChangePage('next')" aria-label="Next page" ${currentPage === totalPages ? 'disabled' : ''}>
            <i data-lucide="chevron-right"></i>
        </button>
        `;
        
        pagination.innerHTML = html;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    
    window.pricelistGoToPage = function(page) {
        currentPage = page;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    window.pricelistChangePage = function(direction) {
        const totalPages = Math.ceil(getFilteredRows().length / itemsPerPage);
        if (direction === 'prev' && currentPage > 1) currentPage--;
        if (direction === 'next' && currentPage < totalPages) currentPage++;
        renderPage();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            currentSearch = e.target.value.toLowerCase().trim();
            applySearch();
        });
    }

    (async () => {
        await initRoleControl();
        await loadPriceList();

        if (typeof lucide !== 'undefined') lucide.createIcons();
    })();
});
