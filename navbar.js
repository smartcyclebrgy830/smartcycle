document.addEventListener('DOMContentLoaded', function () {
    fetch('navbar.html')
        .then(response => {
            if (!response.ok) throw new Error('Failed to load navbar');
            return response.text();
        })
        .then(html => {
            const navbarContainer = document.getElementById('navbar-container');
            navbarContainer.innerHTML = html;

            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            setActiveNavItem();
            addKeyboardNavigation();
            initializeMobileMenu();
            initializeAdminSection();
            displayLoggedInUser();
        })
        .catch(error => {
            console.error('Error loading navbar:', error);
        });
});


// Set active nav item based on current page
function setActiveNavItem() {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.classList.remove('active');
        item.removeAttribute('aria-current');

        const dataPage = item.getAttribute('data-page');
        const href = item.getAttribute('href');

        if ((dataPage && currentPage.includes(dataPage)) || href === currentPage) {
            item.classList.add('active');
            item.setAttribute('aria-current', 'page');
        }
    });
}


// Keyboard arrow navigation for nav items
function addKeyboardNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach((item, index) => {
        item.addEventListener('keydown', (e) => {
            let targetIndex;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    targetIndex = (index + 1) % navItems.length;
                    navItems[targetIndex].focus();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    targetIndex = (index - 1 + navItems.length) % navItems.length;
                    navItems[targetIndex].focus();
                    break;
                case 'Home':
                    e.preventDefault();
                    navItems[0].focus();
                    break;
                case 'End':
                    e.preventDefault();
                    navItems[navItems.length - 1].focus();
                    break;
            }
        });
    });
}


// Mobile sidebar open/close
function initializeMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const navItems = document.querySelectorAll('.nav-item');

    function openSidebar() {
        sidebar.classList.add('active');
        overlay.classList.add('active');
        document.body.classList.add('sidebar-open');
        hamburgerBtn.setAttribute('aria-expanded', 'true');
        sidebar.setAttribute('aria-hidden', 'false');
    }

    function closeSidebar() {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        sidebar.setAttribute('aria-hidden', 'true');
    }

    if (hamburgerBtn) hamburgerBtn.addEventListener('click', openSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if (overlay) overlay.addEventListener('click', closeSidebar);

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) closeSidebar();
        });
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > 768 && sidebar.classList.contains('active')) {
                closeSidebar();
            }
        }, 250);
    });
}


// Admin section: profile click vs three-dots click
function initializeAdminSection() {
    const adminProfileBtn = document.getElementById('admin-profile-btn');
    const adminMoreBtn = document.getElementById('admin-more-btn');
    const adminDropdown = document.getElementById('admin-dropdown');
    const logoutBtn = document.getElementById('logout-btn');

    if (!adminProfileBtn || !adminMoreBtn || !adminDropdown) return;

    // Three dots — toggle dropdown (stop propagation so it doesn't bubble to profile btn)
    adminMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = adminDropdown.classList.toggle('active');
        adminMoreBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // Profile area click — placeholder for future profile page navigation
    adminProfileBtn.addEventListener('click', (e) => {
        // If the three-dots area was clicked, do nothing here
        if (e.target.closest('#admin-more-btn')) return;

        // TODO: Pa-Delete if not necessary or uncomment kung need
        // window.location.href = 'profile.html';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!adminMoreBtn.contains(e.target) && !adminDropdown.contains(e.target)) {
            adminDropdown.classList.remove('active');
            adminMoreBtn.setAttribute('aria-expanded', 'false');
        }
    });

    // Logout button opens confirmation modal
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            adminDropdown.classList.remove('active');
            openLogoutModal();
        });
    }

    // Close dropdown on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && adminDropdown.classList.contains('active')) {
            adminDropdown.classList.remove('active');
            adminMoreBtn.setAttribute('aria-expanded', 'false');
            adminMoreBtn.focus();
        }
    });

    initializeLogoutModal();
}


// Logout confirmation modal
function initializeLogoutModal() {
    const logoutModal = document.getElementById('logoutModal');
    const logoutCancelBtn = document.getElementById('logoutCancelBtn');
    const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');

    if (!logoutModal) return;

    if (logoutCancelBtn) {
        logoutCancelBtn.addEventListener('click', () => {
            logoutModal.close();
        });
    }

    if (logoutConfirmBtn) {
        logoutConfirmBtn.addEventListener('click', () => {
            handleLogout();
        });
    }
}

function openLogoutModal() {
    const logoutModal = document.getElementById('logoutModal');
    if (logoutModal) {
        lucide.createIcons();
        logoutModal.showModal();
    }
}


// Display logged-in user name from session
function displayLoggedInUser() {
    const adminNameElement = document.getElementById('admin-name');
    if (adminNameElement) {
        adminNameElement.textContent = sessionStorage.getItem('userName') || 'Admin';
    }
}


// Logout: clear session and redirect
function handleLogout() {
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('authToken');

    window.location.href = 'index.html';
}
