// --- 1. CONFIGURATION ---
const SUPABASE_URL = 'https://nlybbvlhhdjjmqkzjnhx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_tb_WPtZc6awrzrQrDvYUxQ_ndUpe-Au';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentTab = 'all';
let contacts = [];
// Initialize Lucide icons
lucide.createIcons();
let nextId = 1;

// 1. FETCH PROFILES AND ENRICH WITH TRANSACTION DATA
async function fetchProfilesFromSupabase() {
    const tableBody = document.getElementById('contactsTableBody');
    tableBody.innerHTML = '';
    
    // Step A: Fetch core profiles, collections, and sales records concurrently
    const [profilesRes, collectionsRes, salesRes] = await Promise.all([
        _supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        _supabase.from('collections').select('customer_name, contact_number, address, type'), 
        _supabase.from('sales').select('partner, contact, address, type') 
    ]);

    if (profilesRes.error) {
        console.error("Error fetching profiles:", profilesRes.error.message);
        checkEmptyState();
        return;
    }

    const profilesData = profilesRes.data || [];
    const collectionsData = collectionsRes.data || [];
    const salesData = salesRes.data || [];

    // Keep track of names we've processed so we don't duplicate them
    const processedNames = new Set();
    const combinedContacts = [];

    // Step B: Process explicitly registered profiles first
    profilesData.forEach(profile => {
        const nameKey = (profile.name || '').trim().toLowerCase();
        if (!nameKey) return;

        processedNames.add(nameKey);

        const collectionMatch = collectionsData.find(c => (c.customer_name || '').trim().toLowerCase() === nameKey);
        const salesMatch = salesData.find(s => (s.partner || '').trim().toLowerCase() === nameKey);

        let derivedAddress = profile.address;
        let derivedContact = profile.contact_num;
        let derivedCategory = profile.category;

        // --- CONTACT BACKFILL ---
        if (!derivedContact || derivedContact === 'N/A') {
            if (collectionMatch && collectionMatch.contact_number) derivedContact = collectionMatch.contact_number;
            else if (salesMatch && salesMatch.contact) derivedContact = salesMatch.contact;
        }

        // --- ADDRESS BACKFILL ---
        if (!derivedAddress || derivedAddress === 'N/A') {
            if (collectionMatch && collectionMatch.address) derivedAddress = collectionMatch.address;
            else if (salesMatch && salesMatch.address) derivedAddress = salesMatch.address;
        }

        // --- CATEGORY BACKFILL ---
        if (!derivedCategory || derivedCategory.trim() === '' || derivedCategory === 'N/A') {
            if (salesMatch && salesMatch.type) derivedCategory = salesMatch.type;
            else if (collectionMatch && collectionMatch.type) derivedCategory = collectionMatch.type;
        }

        const rawCategory = (derivedCategory || 'walk-ins').toLowerCase().trim();

        combinedContacts.push({
            id: profile.id,
            isTemporary: false, // Flag to differentiate DB profiles from auto-generated ones
            name: profile.name,
            address: derivedAddress || 'N/A',
            contactNumber: derivedContact || 'N/A',
            category: rawCategory,
            displayCategory: getCategoryDisplayName(rawCategory),
            avatarColor: getRandomColor()
        });
    });

    // Step C: Discover and append missing partners found ONLY in the Sales table
    salesData.forEach(sale => {
        const nameKey = (sale.partner || '').trim().toLowerCase();
        if (!nameKey || processedNames.has(nameKey)) return; // Skip if empty or already added

        processedNames.add(nameKey);

        const rawCategory = (sale.type || 'junkshop').toLowerCase().trim();

        combinedContacts.push({
            id: 'TXT-S', // Temporary ID indicator for Sales transaction origin
            isTemporary: true,
            name: sale.partner,
            address: sale.address || 'N/A',
            contactNumber: sale.contact || 'N/A',
            category: rawCategory,
            displayCategory: getCategoryDisplayName(rawCategory),
            avatarColor: getRandomColor()
        });
    });

    // Step D: Discover and append missing customers found ONLY in the Collections table
    collectionsData.forEach(collection => {
        const nameKey = (collection.customer_name || '').trim().toLowerCase();
        if (!nameKey || processedNames.has(nameKey)) return; 

        processedNames.add(nameKey);

        const rawCategory = (collection.type || 'walk-ins').toLowerCase().trim();

        combinedContacts.push({
            id: 'TXT-C', // Temporary ID indicator for Collection transaction origin
            isTemporary: true,
            name: collection.customer_name,
            address: collection.address || 'N/A',
            contactNumber: collection.contact_number || 'N/A',
            category: rawCategory,
            displayCategory: getCategoryDisplayName(rawCategory),
            avatarColor: getRandomColor()
        });
    });

    // Save globally to our contacts tracker
    contacts = combinedContacts;

    if (contacts.length === 0) {
        checkEmptyState();
        return;
    }

    // Step E: Render all structured entries directly onto the table
    contacts.forEach(contact => {
        addContactToTable(contact);
    });
}

// Get category display name
function getCategoryDisplayName(category) {
    const categoryMap = {
        'walk-ins': 'Walk-ins',
        'school': 'School',
        'junkshop': 'Junkshop',
        'organization': 'Organization',
        'barangay': 'Barangay'
    };
    return categoryMap[category] || category;
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

    // Disable action buttons or handle them carefully for dynamic transaction items
    const deleteButtonHtml = contact.isTemporary 
        ? `<button class="action-btn delete-btn" title="Cannot delete transaction record" disabled style="opacity: 0.4; cursor: not-allowed;">
                <i data-lucide="trash-2"></i>
           </button>`
        : `<button class="action-btn delete-btn" title="Delete Profile">
                <i data-lucide="trash-2"></i>
           </button>`;

    row.innerHTML = `
        <td>
            <div class="customer-cell">
                <div class="customer-avatar" style="background-color: ${contact.avatarColor};">
                    <i data-lucide="user" style="width: 16px; height: 16px;"></i>
                </div>
                <span>${contact.name}</span>
            </div>
        </td>
        <td>${contact.displayCategory}</td>
        <td>${contact.id}</td>
        <td>${contact.address}</td>
        <td>${contact.contactNumber}</td>
        <td>
            <div class="action-buttons">
                <button class="action-btn edit-btn" title="Edit" ${contact.isTemporary ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''}>
                    <i data-lucide="edit-2"></i>
                </button>
                ${deleteButtonHtml}
            </div>
        </td>
    `;

    // Only hook up live database deletion if the item actually has a profile database record
    if (!contact.isTemporary) {
        row.querySelector('.delete-btn').addEventListener('click', async function() {
            if (confirm(`Are you sure you want to delete ${contact.name}?`)) {
                const { error } = await _supabase.from('profiles').delete().eq('id', contact.id);
                if (!error) {
                    row.remove();
                    checkEmptyState();
                } else {
                    alert("Error deleting: " + error.message);
                }
            }
        });
    }

    tableBody.appendChild(row);
    lucide.createIcons();
    filterContacts(currentTab);
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

function filterContacts(tab) {
    const rows = document.querySelectorAll('#contactsTableBody tr:not(.empty-state-row)');
    rows.forEach(row => {
        const category = row.getAttribute('data-category');
        if (tab === 'all') {
            row.style.display = '';
        } else if (tab === 'collections') {
            row.style.display = ['walk-ins', 'school', 'organization', 'partner', 'barangay'].includes(category) ? '' : 'none';
        } else if (tab === 'sales') {
            row.style.display = ['junkshop', 'customer'].includes(category) ? '' : 'none';
        }
    });
    checkEmptyState();
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
            row.style.display = matches ? '' : 'none';
        });
        checkEmptyState();
    });
}

// 3. INITIALIZE ON LOAD
document.addEventListener('DOMContentLoaded', () => {
    fetchProfilesFromSupabase(); 
    initializeTabSwitching();
    initializeSearch();
});
