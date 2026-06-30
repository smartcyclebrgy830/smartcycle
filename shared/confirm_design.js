function showSuccessConfirm(message) {
    let overlay = document.getElementById('successConfirmOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'successConfirmOverlay';
        overlay.className = 'delete-confirm-overlay';
        overlay.innerHTML = `
            <div class="delete-confirm-box">
                <div class="success-confirm-icon">
                    <i data-lucide="badge-check"></i>
                </div>
                <h2 class="delete-confirm-title">Success</h2>
                <p class="delete-confirm-msg" id="successConfirmMsg"></p>
                <div class="success-confirm-actions">
                    <button class="btn-confirm-ok" id="successConfirmOk">OK</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
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
