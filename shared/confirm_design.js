function showSuccessConfirm(message, type) {
    type = type || 'success';
    let overlay = document.getElementById('successConfirmOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'successConfirmOverlay';
        overlay.className = 'delete-confirm-overlay';
        overlay.innerHTML = `
            <div class="delete-confirm-box">
                <div class="success-confirm-icon" id="successConfirmIcon">
                    <i data-lucide="badge-check"></i>
                </div>
                <h2 class="delete-confirm-title" id="successConfirmTitle">Success</h2>
                <p class="delete-confirm-msg" id="successConfirmMsg"></p>
                <div class="success-confirm-actions">
                    <button class="btn-confirm-ok" id="successConfirmOk">Ok</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    const iconWrap = document.getElementById('successConfirmIcon');
    const titleEl = document.getElementById('successConfirmTitle');

    if (type === 'delete') {
        iconWrap.className = 'success-confirm-icon delete';
        iconWrap.innerHTML = '<i data-lucide="trash-2"></i>';
        titleEl.textContent = 'Deleted';
    } else {
        iconWrap.className = 'success-confirm-icon';
        iconWrap.innerHTML = '<i data-lucide="badge-check"></i>';
        titleEl.textContent = 'Success';
    }

    document.getElementById('successConfirmMsg').textContent = message;

    const okBtn = document.getElementById('successConfirmOk');
    const close = () => overlay.classList.remove('open');

    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    newOkBtn.addEventListener('click', close);

    overlay.classList.add('open');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
