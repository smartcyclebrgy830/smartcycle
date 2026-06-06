(function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('isLoggedIn');
    if (!isLoggedIn || isLoggedIn !== 'true') {
        window.location.href = 'index.html';
        return;
    }
})();

const _supabase = window._supabase;

lucide.createIcons();

let currentView = 'archive';
let allLogs = [];
let filteredLogs = [];
const ITEMS_PER_PAGE = 10;
let currentPage = 1;

async function fetchHistory() {
    const { data, error } = await _supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error(error);
        return;
    }

    allLogs = data || [];
    applyFiltersAndRender();
}

// FILTER
function applyFiltersAndRender() {
    currentPage = 1;
    const roleFilter   = document.getElementById('roleFilter')?.value   || '';
    const actionFilter = document.getElementById('actionFilter')?.value || '';
    const dateFilter   = document.getElementById('dateFilter')?.value   || '';

    filteredLogs = allLogs.filter(log => {
        if (currentView === 'archive' && log.is_deleted)  return false;
        if (currentView === 'trash'   && !log.is_deleted) return false;
        if (roleFilter && log.user_role !== roleFilter) return false;
        if (actionFilter && !log.action.startsWith(actionFilter)) return false;
        if (dateFilter) {
            const logDate = log.created_at.slice(0, 10);
            if (logDate !== dateFilter) return false;
        }
        return true;
    });

    renderHistory();
}

// RENDER
function renderHistory() {
    const listEl     = document.getElementById('historyList');
    const emptyEl    = document.getElementById('emptyState');
    listEl.innerHTML = '';

    if (filteredLogs.length === 0) {
        emptyEl.style.display = 'flex';
        renderPagination(0, 0);
        lucide.createIcons();
        return;
    }

    emptyEl.style.display = 'none';

    const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end   = start + ITEMS_PER_PAGE;
    const pageLogs = filteredLogs.slice(start, end);

    const groups = groupByDate(pageLogs);

    Object.entries(groups).forEach(([dateLabel, logs]) => {
        const groupEl = document.createElement('tbody');
        groupEl.className = 'date-group';

        const headerEl = document.createElement('tr');
        headerEl.className = 'date-group-header';
        headerEl.innerHTML = `<td colspan="5">${dateLabel}</td>`;
        groupEl.appendChild(headerEl);

        logs.forEach(log => {
            groupEl.appendChild(buildRow(log));
        });

        listEl.appendChild(groupEl);
    });

    renderPagination(filteredLogs.length, totalPages);
    lucide.createIcons();
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
    prev.addEventListener('click', () => { currentPage--; renderHistory(); });
    nav.appendChild(prev);

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
        btn.textContent = i;
        btn.setAttribute('aria-label', `Page ${i}`);
        btn.addEventListener('click', () => { currentPage = i; renderHistory(); });
        nav.appendChild(btn);
    }

    const next = document.createElement('button');
    next.className = 'page-btn';
    next.innerHTML = '<i data-lucide="chevron-right"></i>';
    next.disabled = currentPage === totalPages;
    next.setAttribute('aria-label', 'Next page');
    next.addEventListener('click', () => { currentPage++; renderHistory(); });
    nav.appendChild(next);

    lucide.createIcons();
}

// ROW BUILDER
function buildRow(log) {
    const row = document.createElement('tr');
    const avatarColor = log.avatar_color || getRandomColor();
    const roleClass   = getRoleClass(log.user_role);
    const formattedTs = formatTimestamp(log.created_at);

    row.innerHTML = `
        <td>
            <div class="user-cell">
                <div class="user-avatar" style="background-color: ${avatarColor};">
                    <i data-lucide="user" style="width: 16px; height: 16px;"></i>
                </div>
                <span class="user-name">${escapeHtml(log.user_name)}</span>
            </div>
        </td>
        <td><span class="role-badge ${roleClass}">${escapeHtml(log.user_role)}</span></td>
        <td><span class="action-desc">${escapeHtml(log.action)}</span></td>
        <td><span class="timestamp">${formattedTs}</span></td>
        <td>
            <div class="action-btns">
                <button class="icon-btn delete" title="Delete log" data-id="${log.id}">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </td>
    `;

    row.querySelector('.delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        showDeleteModal(log);
    });

    return row;
}

function showDeleteModal(log) {
    if (!document.getElementById('historyDeleteModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="historyDeleteModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:3000;justify-content:center;align-items:center;backdrop-filter:blur(4px);">
                <div style="background:white;border-radius:20px;padding:36px 32px 28px;width:360px;max-width:90vw;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.2);">
                    <div style="width:64px;height:64px;background:#fef2f2;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">
                        <i data-lucide="trash-2" style="width:28px;height:28px;color:#ef4444;"></i>
                    </div>
                    <h3 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px;">Delete Log</h3>
                    <p id="historyDeleteText" style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.5;"></p>
                    <div style="display:flex;gap:12px;">
                        <button id="historyDeleteCancel" style="flex:1;padding:12px;border-radius:10px;border:1px solid #e5e7eb;background:white;font-size:14px;font-weight:600;color:#374151;cursor:pointer;font-family:inherit;">Cancel</button>
                        <button id="historyDeleteConfirm" style="flex:1;padding:12px;border-radius:10px;border:none;background:#ef4444;color:white;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Delete</button>
                    </div>
                </div>
            </div>
        `);

        const modal = document.getElementById('historyDeleteModal');
        document.getElementById('historyDeleteCancel').addEventListener('click', () => modal.style.display = 'none');
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    const modal = document.getElementById('historyDeleteModal');
    document.getElementById('historyDeleteText').textContent =
        `Are you sure you want to delete the log entry for "${log.user_name}"? This action cannot be undone.`;

    const confirmBtn = document.getElementById('historyDeleteConfirm');
    const cleanBtn = confirmBtn.cloneNode(true);
    confirmBtn.replaceWith(cleanBtn);

    cleanBtn.addEventListener('click', async () => {
        await deleteLog(log.id);
        allLogs = allLogs.filter(l => l.id !== log.id);
        modal.style.display = 'none';
        applyFiltersAndRender();
    });

    modal.style.display = 'flex';
    lucide.createIcons();
}

async function deleteLog(id) {
    const { error } = await _supabase
        .from('logs')
        .update({ is_deleted: true })
        .eq('id', id);

    if (error) console.error(error);
}

async function restoreLog(id) {
    await _supabase
        .from('logs')
        .update({ is_deleted: false })
        .eq('id', id);
}

// HELPERS
function groupByDate(logs) {
    const groups = {};
    logs.forEach(log => {
        const label = formatDateLabel(log.created_at);
        if (!groups[label]) groups[label] = [];
        groups[label].push(log);
    });
    return groups;
}

function formatDateLabel(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const y  = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d  = String(date.getDate()).padStart(2, '0');
    const h  = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}`;
}

function getRoleClass(role) {
    const map = {
        'Super-Admin': 'super-admin',
        'Admin':       'admin',
        'Moderator':   'moderator'
    };
    return map[role] || 'admin';
}

function getRandomColor() {
    const colors = ['#4CAF50', '#FF9800', '#2196F3', '#9C27B0', '#F44336', '#00BCD4', '#FF5722', '#8BC34A'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {

    fetchHistory();

    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentView = this.getAttribute('data-view');
            applyFiltersAndRender();
        });
    });

    const filterBtn   = document.getElementById('filterBtn');
    const filterPanel = document.getElementById('filterPanel');
    filterBtn.addEventListener('click', () => {
        filterPanel.classList.toggle('open');
        filterBtn.classList.toggle('open');
    });

    ['roleFilter', 'actionFilter', 'dateFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyFiltersAndRender);
    });

    document.getElementById('clearFilter').addEventListener('click', () => {
        document.getElementById('roleFilter').value   = '';
        document.getElementById('actionFilter').value = '';
        document.getElementById('dateFilter').value   = '';
        applyFiltersAndRender();
    });
});
