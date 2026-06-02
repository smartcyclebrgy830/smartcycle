// --- 1. CONFIGURATION ---
const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserRole = null;
let currentTab = 'all';
const ITEMS_PER_PAGE = 10;
let currentPage = 1; 

// Initialize Lucide icons
lucide.createIcons();

async function fetchCurrentUserRole() {
    const { data: { user }, error: userError } = await _supabase.auth.getUser();

    if (userError || !user) {
        console.error("No logged in user");
        return;
    }

    const { data, error } = await _supabase
        .from('profiles')
        .select('type')
        .eq('auth_id', user.id)
        .single();

    if (error) {
        console.error("Error fetching role:", error.message);
        return;
    }

    currentUserRole = data.type;
}

async function fetchProfilesFromSupabase() {
    const tableBody = document.getElementById('contactsTableBody');
    tableBody.innerHTML = '';

    const { data: profiles, error } = await _supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching profiles:", error.message);
        checkEmptyState();
        return;
    }

    if (!profiles || profiles.length === 0) {
        checkEmptyState();
        return;
    }
    
    profiles.forEach(profile => {
        const rawCategory = profile.category ? String(profile.category).trim() : 'N/A';
        const normalizedCategory = rawCategory.toLowerCase();
        
        // Fallback: If display_id is missing/null, use a clean slice of the database UUID string
        const targetId = profile.display_id || profile.id.replace(/\D/g, '').slice(-7);
        
        const formattedId = formatProfileId(targetId, normalizedCategory);
        
        addContactToTable({
            id: formattedId,                                      
            dbId: profile.id,                                     
            name: profile.display_name || profile.name || 'Unknown Name',
            address: profile.address || 'N/A',
            contactNumber: profile.contact_num || 'N/A',
            category: normalizedCategory,
            displayCategory: getCategoryDisplayName(rawCategory), 
            avatarColor: getRandomColor(),
            isTemporary: false
        });
    });
    applyPagination();
}

// Helper function with the corrected business rules mapping
function formatProfileId(displayId, normalizedCategory) {
    if (!displayId) return 'N/A';

    let prefix = 'C'; 
    const salesPartners = ['junkshop', 'organization'];
    
    if (salesPartners.includes(normalizedCategory)) {
        prefix = 'S';
    }

    // Safely extract numeric digits
    const numericPart = displayId.replace(/\D/g, '');
    
    // Ensure we have a number string to slice, default to fallback random if empty
    const cleanNumbers = numericPart || Math.floor(1000000 + Math.random() * 9000000).toString();

    const sevenDigits = cleanNumbers.slice(-7).padStart(7, '0');

    return `${prefix}-${sevenDigits}`;
}
// Get category display name safely regardless of DB casing
function getCategoryDisplayName(category) {
    if (!category || category === 'N/A') return 'N/A';
    
    const categoryMap = {
        'walk-ins': 'Walk-ins',
        'school': 'School',
        'junkshop': 'Junkshop',
        'organization': 'Organization',
        'barangay': 'Barangay'
    };
    
    // Normalize key to lowercase to guarantee a match
    const normalizedKey = category.toLowerCase().trim();
    
    // Return map match, or capitalize the raw database string if it's a new group type
    return categoryMap[normalizedKey] || (category.charAt(0).toUpperCase() + category.slice(1));
}

// Generate random color for avatar
function getRandomColor() {
    const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#00BCD4', '#FF5722', '#8BC34A'];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Add contact to table
function addContactToTable(contact) {
    const tableBody = document.getElementById('contactsTableBody');

    const emptyRow = tableBody.querySelector('.empty-state-row');
    if (emptyRow) emptyRow.remove();

    const row = document.createElement('tr');
    row.setAttribute('data-category', contact.category);
    row.setAttribute('data-id', String(contact.id));

    const deleteButtonHtml = contact.isTemporary 
        ? `<button class="action-btn delete-btn" title="Cannot delete direct transactional entries" disabled style="opacity: 0.4; cursor: not-allowed;">
                <i data-lucide="trash-2"></i>
           </button>`
        : `<button class="action-btn delete-btn" title="Delete Profile">
                <i data-lucide="trash-2"></i>
           </button>`;

    let actionButtonsHTML = '';

    if (currentUserRole === 'Admin' || currentUserRole === 'Super Admin') {
        actionButtonsHTML = `
            <div class="action-buttons" style="justify-content: center;">
                <button class="action-btn edit-btn" title="Edit" ${contact.isTemporary ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
                    <i data-lucide="edit-2"></i>
                </button>
                ${deleteButtonHtml}
            </div>
        `;
    } else {
        // Moderator → no buttons
        actionButtonsHTML = `<div class="action-buttons"></div>`;
    }
    // --- REORDERED DATA CELLS WITH FIXED LAYOUT WIDTHS ---
    row.innerHTML = `
        <td style="width: 250px; min-width: 250px;">
            <div class="customer-cell">
                <div class="customer-avatar" style="background-color: ${contact.avatarColor};">
                    <i data-lucide="user" style="width: 16px; height: 16px;"></i>
                </div>
                <span>${contact.name}</span>
            </div>
        </td>
        <td style="width: 100px; min-width: 130px;">${contact.id}</td>
        <td style="width: 130px; min-width: 150px;">${contact.displayCategory}</td>
        <td style="width: 250px; min-width: 250px;">${contact.address}</td>
        <td style="width: 140px; min-width: 160px;">${contact.contactNumber}</td>
        <td style="width: 100px; min-width: 100px;">
            ${actionButtonsHTML}
        </td>
    `;

    row.style.cursor = 'pointer';
    row.addEventListener('click', function(e) {
        if(e.target.closest('.action-buttons')) return;
        window.location.href = `profile_transaction.html?id=${contact.dbId}`;
    });
    const deleteBtn = row.querySelector('.delete-btn');
    
    if (!contact.isTemporary && deleteBtn) {
        deleteBtn.addEventListener('click', async function() {
            if (confirm(`Are you sure you want to delete ${contact.name}?`)) {
    
                const { error } = await _supabase
                    .from('profiles')
                    .delete()
                    .eq('id', contact.dbId);
    
                if (!error) {
                    row.remove();
                    checkEmptyState();
                    applyPagination();
                } else {
                    alert("Error deleting: " + error.message);
                }
            }
        });
    }

    tableBody.appendChild(row);
    lucide.createIcons();
}

// Check if table is empty and show message
function checkEmptyState() {
    const tableBody = document.getElementById('contactsTableBody');
    const visibleRows = Array.from(tableBody.querySelectorAll('tr')).filter(
        row => row.style.display !== 'none' && !row.classList.contains('empty-state-row')
    );

    if (visibleRows.length === 0 && !tableBody.querySelector('.empty-state-row')) {
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'empty-state-row';
        emptyRow.innerHTML = `
            <td colspan="6" class="empty-state">
                <i data-lucide="inbox"></i>
                <p>No profiles found</p>
            </td>
        `;
        tableBody.appendChild(emptyRow);
        lucide.createIcons();
    } else if (visibleRows.length > 0) {
        const emptyRow = tableBody.querySelector('.empty-state-row');
        if (emptyRow) emptyRow.remove();
    }
}

// Initialize tab switching
function initializeTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentTab = this.getAttribute('data-tab');
            filterContacts(currentTab);
        });
    });
}

// Filter contacts
function filterContacts(tab) {
    currentPage = 1;
    applyPagination();
}

function getFilteredRows() {
    const rows = Array.from(document.querySelectorAll('#contactsTableBody tr:not(.empty-state-row)'));
    return rows.filter(row => {
        if (row.getAttribute('data-search-hidden') === 'true') return false;
        const category = row.getAttribute('data-category');
        if (currentTab === 'all') return true;
        if (currentTab === 'collections') return ['walk-ins', 'school', 'barangay', 'customer'].includes(category);
        if (currentTab === 'sales') return ['junkshop', 'organization', 'partner' ].includes(category);
        return true;
    });
}

function applyPagination() {
    const allRows = Array.from(document.querySelectorAll('#contactsTableBody tr:not(.empty-state-row)'));

    allRows.forEach(row => row.style.display = 'none');

    const filteredRows = getFilteredRows();
    const totalPages = Math.ceil(filteredRows.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;

    filteredRows.forEach((row, index) => {
        row.style.display = (index >= start && index < end) ? '' : 'none';
    });

    checkEmptyState();
    renderPagination(filteredRows.length, totalPages);
}

function renderPagination(totalItems, totalPages) {
    const nav = document.querySelector('.pagination');
    if (!nav) return;

    if (totalItems <= ITEMS_PER_PAGE) {
        nav.innerHTML = '';
        nav.style.display = 'none';
        return;
    }

    nav.style.display = 'flex';
    nav.innerHTML = '';

    const prev = document.createElement('button');
    prev.className = 'page-btn';
    prev.innerHTML = '<i data-lucide="chevron-left"></i>';
    prev.disabled = currentPage === 1;
    prev.setAttribute('aria-label', 'Previous page');
    prev.addEventListener('click', () => { currentPage--; applyPagination(); });
    nav.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.setAttribute('aria-label', `Page ${i}`);
        btn.addEventListener('click', () => { currentPage = i; applyPagination(); });
        nav.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.innerHTML = '<i data-lucide="chevron-right"></i>';
    next.disabled = currentPage === totalPages;
    next.setAttribute('aria-label', 'Next page');
    next.addEventListener('click', () => { currentPage++; applyPagination(); });
    nav.appendChild(next);

    lucide.createIcons();
}

// Initialize search functionality
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        const rows = document.querySelectorAll('#contactsTableBody tr:not(.empty-state-row)');

        rows.forEach(row => {
            const name = row.querySelector('.customer-cell span')?.textContent.toLowerCase() || '';
            const id = row.getAttribute('data-id').toLowerCase();
            const matches = name.includes(searchTerm) || id.includes(searchTerm);
            row.setAttribute('data-search-hidden', matches ? 'false' : 'true');
        });
        currentPage = 1;
        applyPagination();
    });
}

// 3. INITIALIZE ON LOAD
document.addEventListener('DOMContentLoaded', async() => {
    await fetchCurrentUserRole()
    await fetchProfilesFromSupabase(); 
    initializeTabSwitching();
    initializeSearch();
});
