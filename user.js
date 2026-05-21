// Mock Data
var myProfile = {
    name:   'Juan Dela Cruz',
    email:  'juan.delacruz@smartcycle.ph',
    mobile: '+63 917 123 4567',
    role:   'admin'
};

var users = [
    { id: 1, name: 'Maria Santos', email: 'maria.santos@smartcycle.ph',   mobile: '+63 918 234 5678', role: 'moderator' },
    { id: 2, name: 'Carlos Reyes', email: 'carlos.reyes@smartcycle.ph',   mobile: '+63 919 345 6789', role: 'viewer'    },
    { id: 3, name: 'Ana Lim',      email: 'ana.lim@smartcycle.ph',         mobile: '+63 920 456 7890', role: 'admin'     },
    { id: 4, name: 'Rico Mendoza', email: 'rico.mendoza@smartcycle.ph',   mobile: '+63 921 567 8901', role: 'viewer'    },
];

var nextId         = 5;
var editingUserId  = null;
var deletingUserId = null;
var currentPage    = 1;
var usersPerPage   = 10;
var searchQuery    = '';

var avatarColors = [
    '#46B336', '#3b82f6', '#f59e0b', '#ef4444',
    '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
];

function colorFor(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
        hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
    }
    return avatarColors[Math.abs(hash) % avatarColors.length];
}

function roleBadgeClass(role) {
    return { admin: 'role-admin', moderator: 'role-moderator', viewer: 'role-viewer' }[role] || 'role-viewer';
}

function roleLabel(role) {
    return { admin: 'Admin', moderator: 'Moderator', viewer: 'Viewer' }[role] || role;
}

function isValidPHPhone(val) {
    return /^(09\d{9}|\+639\d{9})$/.test(val.replace(/\s+/g, ''));
}

function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
}

function renderProfile() {
    document.getElementById('profileAvatar').style.background = colorFor(myProfile.name);
    document.getElementById('displayName').textContent     = myProfile.name;
    document.getElementById('fieldName').textContent       = myProfile.name;
    document.getElementById('fieldEmail').textContent      = myProfile.email;
    document.getElementById('fieldMobile').textContent     = myProfile.mobile;

    var badge = document.getElementById('displayRole');
    badge.textContent = roleLabel(myProfile.role);
    badge.className   = 'role-badge ' + roleBadgeClass(myProfile.role);
}

function renderUsers() {
    var tbody = document.getElementById('usersTableBody');

    var filtered = searchQuery
        ? users.filter(function(u) {
            return u.name.toLowerCase().indexOf(searchQuery) !== -1;
          })
        : users;

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state-cell"><div class="empty-state"><i data-lucide="users"></i><p>' +
            (searchQuery ? 'No users match your search.' : 'No users added yet.') +
            '</p></div></td></tr>';
        lucide.createIcons();
        updatePagination(0);
        return;
    }

    var totalPages  = Math.ceil(filtered.length / usersPerPage);
    var startIdx    = (currentPage - 1) * usersPerPage;
    var pageUsers   = filtered.slice(startIdx, startIdx + usersPerPage);

    tbody.innerHTML = pageUsers.map(function(u) {
        return '<tr>' +
            '<td>' +
                '<div class="user-cell">' +
                    '<div class="user-avatar" style="background:' + colorFor(u.name) + '">' +
                        '<i data-lucide="user" aria-hidden="true"></i>' +
                    '</div>' +
                    '<div class="user-info">' +
                        '<span class="user-name">' + u.name + '</span>' +
                        '<span class="user-email">' + u.email + '</span>' +
                    '</div>' +
                '</div>' +
            '</td>' +
            '<td><span class="role-badge ' + roleBadgeClass(u.role) + '">' + roleLabel(u.role) + '</span></td>' +
            '<td>' +
                '<div class="action-buttons" role="group" aria-label="Actions for ' + u.name + '">' +
                    '<button class="action-btn edit-btn"   data-id="' + u.id + '" aria-label="Edit ' + u.name + '"   title="Edit">' +
                        '<i data-lucide="edit-2" aria-hidden="true"></i>' +
                    '</button>' +
                    '<button class="action-btn delete-btn" data-id="' + u.id + '" aria-label="Remove ' + u.name + '" title="Remove">' +
                        '<i data-lucide="trash-2" aria-hidden="true"></i>' +
                    '</button>' +
                '</div>' +
            '</td>' +
        '</tr>';
    }).join('');

    lucide.createIcons();

    tbody.querySelectorAll('.edit-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { openEditUser(+btn.dataset.id); });
    });
    tbody.querySelectorAll('.delete-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { openDeleteUser(+btn.dataset.id); });
    });

    updatePagination(totalPages);
}


// Pagination
function updatePagination(totalPages) {
    var pagination = document.querySelector('.pagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';

    var html = '<button class="page-btn" onclick="changePage(\'prev\')" ' + (currentPage === 1 ? 'disabled' : '') + '>' +
        '<i data-lucide="chevron-left"></i></button>' +
        '<button class="page-btn ' + (currentPage === 1 ? 'active' : '') + '" onclick="goToPage(1)">1</button>';

    if (currentPage > 3) {
        html += '<span class="page-btn" style="cursor:default;border:none;">...</span>';
    }

    for (var i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        html += '<button class="page-btn ' + (currentPage === i ? 'active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
    }

    if (currentPage < totalPages - 2) {
        html += '<span class="page-btn" style="cursor:default;border:none;">...</span>';
    }

    html += '<button class="page-btn ' + (currentPage === totalPages ? 'active' : '') + '" onclick="goToPage(' + totalPages + ')">' + totalPages + '</button>' +
        '<button class="page-btn" onclick="changePage(\'next\')" ' + (currentPage === totalPages ? 'disabled' : '') + '>' +
        '<i data-lucide="chevron-right"></i></button>';

    pagination.innerHTML = html;
    lucide.createIcons();
}

function goToPage(page) {
    currentPage = page;
    renderUsers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function changePage(direction) {
    var filtered = searchQuery
        ? users.filter(function(u) { return u.name.toLowerCase().indexOf(searchQuery) !== -1; })
        : users;
    var totalPages = Math.ceil(filtered.length / usersPerPage);
    if (direction === 'prev' && currentPage > 1) {
        currentPage--;
        renderUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (direction === 'next' && currentPage < totalPages) {
        currentPage++;
        renderUsers();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


// Edit profile modal
var editProfileModal = document.getElementById('editProfileModal');

document.getElementById('editProfileBtn').addEventListener('click', function() {
    document.getElementById('editName').value   = myProfile.name;
    document.getElementById('editEmail').value  = myProfile.email;
    document.getElementById('editMobile').value = myProfile.mobile;
    clearProfileErrors();
    editProfileModal.classList.add('show');
    lucide.createIcons();
});

document.getElementById('cancelEditBtn').addEventListener('click', function() {
    editProfileModal.classList.remove('show');
    clearProfileErrors();
});

document.getElementById('editProfileForm').addEventListener('submit', function(e) {
    e.preventDefault();

    var name   = document.getElementById('editName').value.trim();
    var email  = document.getElementById('editEmail').value.trim();
    var mobile = document.getElementById('editMobile').value.trim();
    var valid  = true;

    clearProfileErrors();

    if (!name) {
        showError('editNameError', 'editName', 'Full name is required.');
        valid = false;
    }
    if (!email) {
        showError('editEmailError', 'editEmail', 'Email address is required.');
        valid = false;
    } else if (!isValidEmail(email)) {
        showError('editEmailError', 'editEmail', 'Enter a valid email address.');
        valid = false;
    }
    if (mobile && !isValidPHPhone(mobile)) {
        showError('editMobileError', 'editMobile', 'Enter a valid PH number (09XX XXX XXXX).');
        valid = false;
    }

    if (!valid) return;

    myProfile.name   = name;
    myProfile.email  = email;
    myProfile.mobile = mobile;
    renderProfile();
    editProfileModal.classList.remove('show');
    clearProfileErrors();
});

editProfileModal.addEventListener('click', function(e) {
    if (e.target === editProfileModal) editProfileModal.classList.remove('show');
});

function clearProfileErrors() {
    ['editName', 'editEmail', 'editMobile'].forEach(function(id) {
        clearError(id + 'Error', id);
    });
}


// Add & Edit user modal
var userModal = document.getElementById('userModal');

document.getElementById('addUserBtn').addEventListener('click', function() {
    editingUserId = null;
    document.getElementById('userModalTitle').textContent       = 'Add New User';
    document.getElementById('saveUserBtn').innerHTML            = '<i data-lucide="check" aria-hidden="true"></i> Add User';
    lucide.createIcons();
    document.getElementById('modalName').value                  = '';
    document.getElementById('modalEmail').value                 = '';
    document.getElementById('modalMobile').value                = '';
    document.getElementById('modalPassword').value              = '';
    document.getElementById('modalConfirmPassword').value       = '';
    document.getElementById('passwordFields').hidden            = false;
    document.getElementById('modalRole').value                  = '';
    resetPasswordStrength();
    clearModalErrors();
    userModal.classList.add('show');
    lucide.createIcons();
});

function openEditUser(id) {
    var u = users.find(function(u) { return u.id === id; });
    if (!u) return;
    editingUserId = id;
    document.getElementById('userModalTitle').textContent = 'Edit User';
    document.getElementById('saveUserBtn').innerHTML      = '<i data-lucide="check" aria-hidden="true"></i> Save Changes';
    lucide.createIcons();
    document.getElementById('modalName').value   = u.name;
    document.getElementById('modalEmail').value  = u.email;
    document.getElementById('modalMobile').value = u.mobile;
    document.getElementById('passwordFields').hidden = true;
    document.getElementById('modalRole').value   = u.role;
    clearModalErrors();
    userModal.classList.add('show');
    lucide.createIcons();
}

document.getElementById('cancelUserModal').addEventListener('click', function() {
    userModal.classList.remove('show');
});

document.getElementById('userForm').addEventListener('submit', function(e) {
    e.preventDefault();

    var name   = document.getElementById('modalName').value.trim();
    var email  = document.getElementById('modalEmail').value.trim();
    var mobile = document.getElementById('modalMobile').value.trim();
    var role   = document.getElementById('modalRole').value;
    var valid  = true;

    clearModalErrors();

    if (!name) {
        showError('modalNameError', 'modalName', 'Full name is required.');
        valid = false;
    }
    if (!email) {
        showError('modalEmailError', 'modalEmail', 'Email address is required.');
        valid = false;
    } else if (!isValidEmail(email)) {
        showError('modalEmailError', 'modalEmail', 'Enter a valid email address.');
        valid = false;
    }
    if (mobile && !isValidPHPhone(mobile)) {
        showError('modalMobileError', 'modalMobile', 'Enter a valid PH number (09XX XXX XXXX).');
        valid = false;
    }

    if (editingUserId === null) {
        var pw  = document.getElementById('modalPassword').value;
        var cpw = document.getElementById('modalConfirmPassword').value;

        if (!pw) {
            showError('modalPasswordError', 'modalPassword', 'Password is required.');
            valid = false;
        } else if (pw.length < 8) {
            showError('modalPasswordError', 'modalPassword', 'Password must be at least 8 characters.');
            valid = false;
        }
        if (!cpw) {
            showError('modalConfirmPasswordError', 'modalConfirmPassword', 'Please confirm your password.');
            valid = false;
        } else if (pw && pw !== cpw) {
            showError('modalConfirmPasswordError', 'modalConfirmPassword', 'Passwords do not match.');
            valid = false;
        }
    }

    if (!role) {
        showError('modalRoleError', null, 'Please select a role.');
        valid = false;
    }

    if (!valid) return;

    if (editingUserId !== null) {
        var u = users.find(function(u) { return u.id === editingUserId; });
        if (u) { u.name = name; u.email = email; u.mobile = mobile; u.role = role; }
    } else {
        users.push({ id: nextId++, name: name, email: email, mobile: mobile, role: role });
    }

    renderUsers();
    userModal.classList.remove('show');
});


// Password strength
document.getElementById('modalPassword').addEventListener('input', function() {
    var pw = this.value;
    var strengthWrap = document.getElementById('passwordStrength');

    if (!pw) {
        resetPasswordStrength();
        return;
    }

    strengthWrap.hidden = false;
    var fill  = document.getElementById('strengthFill');
    var label = document.getElementById('strengthLabel');
    var score = getPasswordStrength(pw);

    strengthWrap.className = 'password-strength';
    if (score <= 1) {
        strengthWrap.classList.add('strength-weak');
        fill.style.width = '33%';
        fill.style.background = '#ef4444';
        label.style.color = '#ef4444';
        label.textContent = 'Weak';
    } else if (score === 2) {
        strengthWrap.classList.add('strength-fair');
        fill.style.width = '66%';
        fill.style.background = '#f59e0b';
        label.style.color = '#f59e0b';
        label.textContent = 'Fair';
    } else {
        strengthWrap.classList.add('strength-strong');
        fill.style.width = '100%';
        fill.style.background = '#46B336';
        label.style.color = '#46B336';
        label.textContent = 'Strong';
    }
});

function getPasswordStrength(pw) {
    var score = 0;
    if (pw.length >= 8)          score++;
    if (/[A-Z]/.test(pw))        score++;
    if (/[0-9]/.test(pw))        score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
}

function resetPasswordStrength() {
    var strengthWrap = document.getElementById('passwordStrength');
    strengthWrap.hidden = true;
    document.getElementById('strengthFill').style.width = '0%';
    document.getElementById('strengthLabel').textContent = '';
}


// Toggle password visibility
function togglePasswordField(inputId, iconId, buttonId) {
    var input      = document.getElementById(inputId);
    var toggleIcon = document.getElementById(iconId);
    var toggleBtn  = document.getElementById(buttonId);

    if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.setAttribute('aria-pressed', 'true');
        toggleBtn.setAttribute('aria-label', 'Hide password');
        toggleIcon.innerHTML =
            '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>' +
            '<circle cx="12" cy="12" r="3"></circle>';
    } else {
        input.type = 'password';
        toggleBtn.setAttribute('aria-pressed', 'false');
        toggleBtn.setAttribute('aria-label', 'Show password');
        toggleIcon.innerHTML =
            '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>' +
            '<line x1="1" y1="1" x2="23" y2="23"></line>';
    }
}


// Delete modal
function openDeleteUser(id) {
    var u = users.find(function(u) { return u.id === id; });
    if (!u) return;
    deletingUserId = id;

    if (!document.getElementById('deleteModal')) {
        var modalHTML =
            '<div id="deleteModal" style="' +
                'display:none; position:fixed; inset:0; background:rgba(0,0,0,0.45);' +
                'z-index:3000; justify-content:center; align-items:center;' +
                'backdrop-filter:blur(4px);' +
            '">' +
                '<div style="' +
                    'background:white; border-radius:20px; padding:36px 32px 28px;' +
                    'width:360px; max-width:90vw; text-align:center;' +
                    'box-shadow:0 20px 60px rgba(0,0,0,0.2);' +
                    'animation:deleteModalIn 0.25s ease-out;' +
                '">' +
                    '<div style="' +
                        'width:64px; height:64px; background:#fef2f2; border-radius:50%;' +
                        'display:flex; align-items:center; justify-content:center;' +
                        'margin:0 auto 18px;' +
                    '">' +
                        '<i data-lucide="trash-2" style="width:28px;height:28px;color:#ef4444;"></i>' +
                    '</div>' +
                    '<h3 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px;">Remove User</h3>' +
                    '<p id="deleteConfirmText" style="font-size:14px;color:#6b7280;margin:0 0 28px;line-height:1.5;"></p>' +
                    '<div style="display:flex;gap:12px;">' +
                        '<button id="deleteCancelBtn" style="' +
                            'flex:1; padding:12px; border-radius:10px; border:1px solid #e5e7eb;' +
                            'background:white; font-size:14px; font-weight:600; color:#374151;' +
                            'cursor:pointer; font-family:inherit; transition:background 0.2s;' +
                        '" onmouseover="this.style.background=\'#f9fafb\'" onmouseout="this.style.background=\'white\'">Cancel</button>' +
                        '<button id="deleteConfirmBtn" style="' +
                            'flex:1; padding:12px; border-radius:10px; border:none;' +
                            'background:#ef4444; color:white; font-size:14px; font-weight:600;' +
                            'cursor:pointer; font-family:inherit; transition:background 0.2s;' +
                        '" onmouseover="this.style.background=\'#dc2626\'" onmouseout="this.style.background=\'#ef4444\'">Remove</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<style>' +
                '@keyframes deleteModalIn {' +
                    'from { opacity:0; transform:scale(0.93) translateY(16px); }' +
                    'to   { opacity:1; transform:scale(1) translateY(0); }' +
                '}' +
            '</style>';
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        lucide.createIcons();
    }

    var deleteModal  = document.getElementById('deleteModal');
    var confirmBtn   = document.getElementById('deleteConfirmBtn');
    var cancelBtn    = document.getElementById('deleteCancelBtn');

    document.getElementById('deleteConfirmText').textContent =
        'Are you sure you want to remove ' + u.name + '? This action cannot be undone.';
    deleteModal.style.display = 'flex';

    var newConfirm = confirmBtn.cloneNode(true);
    var newCancel  = cancelBtn.cloneNode(true);
    confirmBtn.replaceWith(newConfirm);
    cancelBtn.replaceWith(newCancel);

    newConfirm.addEventListener('click', function() {
        users = users.filter(function(u) { return u.id !== deletingUserId; });
        renderUsers();
        deleteModal.style.display = 'none';
    });

    newCancel.addEventListener('click', function() {
        deleteModal.style.display = 'none';
    });

    deleteModal.onclick = function(e) {
        if (e.target === deleteModal) deleteModal.style.display = 'none';
    };
}

userModal.addEventListener('click', function(e) {
    if (e.target === userModal) userModal.classList.remove('show');
});


// Error helpers
function showError(errorId, inputId, message) {
    var errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.textContent = message;
    if (inputId) {
        var input = document.getElementById(inputId);
        if (input) input.classList.add('input-error');
    }
}

function clearError(errorId, inputId) {
    var errorEl = document.getElementById(errorId);
    if (errorEl) errorEl.textContent = '';
    if (inputId) {
        var input = document.getElementById(inputId);
        if (input) input.classList.remove('input-error');
    }
}

function clearModalErrors() {
    var pairs = [
        ['modalNameError',            'modalName'],
        ['modalEmailError',           'modalEmail'],
        ['modalMobileError',          'modalMobile'],
        ['modalPasswordError',        'modalPassword'],
        ['modalConfirmPasswordError', 'modalConfirmPassword'],
        ['modalRoleError',            null],
    ];
    pairs.forEach(function(pair) { clearError(pair[0], pair[1]); });
}

['modalName', 'modalEmail', 'modalMobile', 'modalPassword', 'modalConfirmPassword'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() { clearError(id + 'Error', id); });
});

['editName', 'editEmail', 'editMobile'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() { clearError(id + 'Error', id); });
});

['modalMobile', 'editMobile'].forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
        var digits = this.value.replace(/\D/g, '').slice(0, 11);
        if (digits.length > 7) {
            this.value = digits.slice(0, 4) + '-' + digits.slice(4, 7) + '-' + digits.slice(7);
        } else if (digits.length > 4) {
            this.value = digits.slice(0, 4) + '-' + digits.slice(4);
        } else {
            this.value = digits;
        }
    });
});


document.addEventListener('DOMContentLoaded', function() {
    renderProfile();
    renderUsers();
    lucide.createIcons();

    var searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            searchQuery = this.value.trim().toLowerCase();
            currentPage = 1;
            renderUsers();
        });
    }
});
