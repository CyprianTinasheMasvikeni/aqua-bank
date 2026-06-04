// ================================================================
// AQUA BANK — Personal Savings Vault
// ================================================================

const MONTHLY_SAVINGS = 519;
const TARGET_AMOUNT   = 10330;

const MILESTONES = [
    { label: 'Jul 2026', target: 2019 },
    { label: 'Aug 2026', target: 2538 },
    { label: 'Sep 2026', target: 3057 },
    { label: 'Oct 2026', target: 3576 },
    { label: 'Nov 2026', target: 4095 },
    { label: 'Dec 2026', target: 4614 },
    { label: 'Jan 2027', target: 5133 },
    { label: 'Feb 2027', target: 5652 },
    { label: 'Mar 2027', target: 6171 },
    { label: 'Apr 2027', target: 6690 },
    { label: 'May 2027', target: 7209 },
    { label: 'Jun 2027', target: 7728 },
    { label: 'Jul 2027', target: 8247 },
    { label: 'Aug 2027', target: 8766 },
    { label: 'Sep 2027', target: 9285 },
    { label: 'Oct 2027', target: 9804 },
    { label: 'Nov 2027', target: 10330 },
];

// ---- STATE ----

let state = {
    pin: null,
    balance: 0,
    target: TARGET_AMOUNT,
    transactions: [],
    streakStart: null,
    lastWithdrawal: null,
    failedPins: 0,
    lockedUntil: null,
    setupDone: false
};

function loadState() {
    try {
        const s = localStorage.getItem('aquabank_state');
        if (s) { state = { ...state, ...JSON.parse(s) }; return true; }
    } catch(e) {}
    return false;
}

function save() {
    localStorage.setItem('aquabank_state', JSON.stringify(state));
}

// ---- UTILITIES ----

function fmt(n) {
    const num = Math.abs(n);
    const str = num >= 1000
        ? '$' + num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
        : '$' + num.toFixed(0);
    return str;
}

function fmtDate(iso) {
    const d = new Date(iso);
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${M[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function fmtMonth(d) {
    const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${M[d.getMonth()]} ${d.getFullYear()}`;
}

function calcStreak() {
    if (!state.streakStart) return 0;
    return Math.floor((Date.now() - new Date(state.streakStart)) / 86400000);
}

function calcMonthsLeft() {
    const rem = Math.max(state.target - state.balance, 0);
    return Math.ceil(rem / MONTHLY_SAVINGS);
}

function impactOfWithdrawal(amount) {
    const days  = Math.round(amount / (MONTHLY_SAVINGS / 30));
    const newBal = state.balance - amount;
    const rem    = Math.max(state.target - newBal, 0);
    const months = Math.ceil(rem / MONTHLY_SAVINGS);
    const newDate = new Date();
    newDate.setMonth(newDate.getMonth() + months);
    return { days, newDate };
}

function shake(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
}

// ---- SCREENS ----

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.remove('hidden');
    if (name === 'dashboard') renderDashboard();
    if (name === 'deposit')   renderDeposit();
    if (name === 'withdraw')  renderWithdraw();
    if (name === 'history')   renderHistory();
    if (name === 'stats')     renderStats();
}

// ---- PIN KEYPAD BUILDER ----

function buildKeypad(containerId, onDigit, onDelete) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    ['1','2','3','4','5','6','7','8','9','','0','⌫'].forEach(k => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'key' + (k === '' ? ' empty' : k === '⌫' ? ' delete' : '');
        btn.textContent = k;
        if (k === '⌫') btn.onclick = onDelete;
        else if (k)     btn.onclick = () => onDigit(k);
        el.appendChild(btn);
    });
}

function setPinDots(displayId, count) {
    document.querySelectorAll(`#${displayId} .pin-dot`).forEach((d,i) => {
        d.classList.toggle('filled', i < count);
    });
}

// ---- SETUP FLOW ----

let setupPin1 = '', setupPin2 = '';

function initSetup() {
    showScreen('setup');
    document.getElementById('setup-step-1').classList.remove('hidden');
    document.getElementById('setup-step-2').classList.add('hidden');
    document.getElementById('setup-step-3').classList.add('hidden');
    setupPin1 = ''; setupPin2 = '';
    setPinDots('setup-pin-display', 0);

    buildKeypad('setup-keypad-1',
        (k) => {
            if (setupPin1.length >= 4) return;
            setupPin1 += k;
            setPinDots('setup-pin-display', setupPin1.length);
            if (setupPin1.length === 4) {
                setTimeout(() => {
                    document.getElementById('setup-step-1').classList.add('hidden');
                    document.getElementById('setup-step-2').classList.remove('hidden');
                    setPinDots('setup-confirm-display', 0);
                }, 250);
            }
        },
        () => { setupPin1 = setupPin1.slice(0,-1); setPinDots('setup-pin-display', setupPin1.length); }
    );

    buildKeypad('setup-keypad-2',
        (k) => {
            if (setupPin2.length >= 4) return;
            setupPin2 += k;
            setPinDots('setup-confirm-display', setupPin2.length);
            if (setupPin2.length === 4) {
                setTimeout(() => {
                    if (setupPin2 === setupPin1) {
                        state.pin = setupPin1;
                        document.getElementById('setup-step-2').classList.add('hidden');
                        document.getElementById('setup-step-3').classList.remove('hidden');
                    } else {
                        setupPin2 = '';
                        setPinDots('setup-confirm-display', 0);
                        shake('setup-confirm-display');
                        document.getElementById('setup-mismatch').classList.remove('hidden');
                        setTimeout(() => document.getElementById('setup-mismatch').classList.add('hidden'), 2000);
                    }
                }, 200);
            }
        },
        () => { setupPin2 = setupPin2.slice(0,-1); setPinDots('setup-confirm-display', setupPin2.length); }
    );
}

function completeSetup() {
    const raw = document.getElementById('starting-balance').value;
    const bal = parseFloat(raw) || 0;
    state.balance    = bal;
    state.streakStart = new Date().toISOString();
    state.setupDone  = true;
    if (bal > 0) {
        state.transactions.push({
            id: Date.now(), type: 'deposit',
            amount: bal, date: new Date().toISOString(),
            note: 'Starting balance', balance: bal
        });
    }
    save();
    showOverlay('🚗 Let\'s Go!', `Aqua Bank is set up. Goal: ${fmt(state.target)} for the Toyota Aqua. Save ${fmt(MONTHLY_SAVINGS)}/month and you'll be driving by Nov 2027.`);
}

// ---- PIN UNLOCK ----

let pinEntry = '';

function initPin() {
    pinEntry = '';
    setPinDots('pin-display', 0);
    const errEl  = document.getElementById('pin-error');
    const subEl  = document.getElementById('pin-subtitle');
    errEl.textContent = '';

    if (state.lockedUntil && Date.now() < new Date(state.lockedUntil).getTime()) {
        const mins = Math.ceil((new Date(state.lockedUntil) - Date.now()) / 60000);
        subEl.textContent = `Locked — try again in ${mins}m`;
        return;
    }
    subEl.textContent = 'Enter your PIN';

    buildKeypad('pin-keypad',
        (k) => {
            if (state.lockedUntil && Date.now() < new Date(state.lockedUntil).getTime()) return;
            if (pinEntry.length >= 4) return;
            pinEntry += k;
            setPinDots('pin-display', pinEntry.length);
            if (pinEntry.length === 4) {
                setTimeout(() => checkPin(pinEntry), 150);
            }
        },
        () => { pinEntry = pinEntry.slice(0,-1); setPinDots('pin-display', pinEntry.length); }
    );
}

function checkPin(entered) {
    if (entered === state.pin) {
        state.failedPins = 0;
        state.lockedUntil = null;
        save();
        showScreen('dashboard');
    } else {
        state.failedPins = (state.failedPins || 0) + 1;
        pinEntry = '';
        setPinDots('pin-display', 0);
        shake('pin-display');
        const errEl = document.getElementById('pin-error');
        if (state.failedPins >= 3) {
            state.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            errEl.textContent = 'Too many attempts. Locked 30 min.';
            document.getElementById('pin-subtitle').textContent = 'Locked for 30 minutes';
        } else {
            errEl.textContent = `Wrong PIN — ${3 - state.failedPins} attempt${3 - state.failedPins !== 1 ? 's' : ''} left`;
        }
        save();
    }
}

function lockApp() {
    pinEntry = '';
    showScreen('pin');
    initPin();
}

// ---- DASHBOARD ----

function renderDashboard() {
    const bal    = state.balance;
    const tgt    = state.target;
    const pct    = Math.min((bal / tgt) * 100, 100);
    const rem    = Math.max(tgt - bal, 0);
    const streak = calcStreak();
    const months = calcMonthsLeft();

    document.getElementById('dashboard-balance').textContent  = fmt(bal);
    document.getElementById('dashboard-target').textContent   = fmt(tgt);
    document.getElementById('dashboard-percent').textContent  = pct.toFixed(1) + '%';
    document.getElementById('dashboard-remaining').textContent = fmt(rem) + ' to go';
    document.getElementById('dashboard-progress').style.width = Math.max(pct, 1) + '%';
    document.getElementById('stat-streak').textContent  = streak;
    document.getElementById('stat-months').textContent  = months;
    document.getElementById('stat-monthly').textContent = fmt(MONTHLY_SAVINGS);

    renderRecentTxns();
}

function renderRecentTxns() {
    const el   = document.getElementById('recent-transactions');
    const list = [...state.transactions].reverse().slice(0, 4);
    el.innerHTML = list.length
        ? list.map(txnHTML).join('')
        : '<div class="empty-state">No transactions yet.<br>Make your first deposit! 💰</div>';
}

function txnHTML(t) {
    const dep   = t.type === 'deposit';
    const icon  = dep ? '💰' : '📤';
    const sign  = dep ? '+' : '-';
    const cls   = dep ? 'deposit' : 'withdrawal';
    const label = dep ? (t.note || 'Deposit') : (t.reason || 'Withdrawal');
    const sub   = !dep && t.note ? ' · ' + t.note : '';
    return `
        <div class="transaction-item">
            <div class="transaction-icon">${icon}</div>
            <div class="transaction-details">
                <div class="transaction-type">${label}</div>
                <div class="transaction-date">${fmtDate(t.date)}${sub}</div>
            </div>
            <div class="transaction-amount ${cls}">${sign}${fmt(t.amount)}</div>
        </div>`;
}

// ---- DEPOSIT ----

function renderDeposit() {
    document.getElementById('deposit-current-balance').textContent = fmt(state.balance);
    document.getElementById('deposit-amount').value = '';
    document.getElementById('deposit-note').value   = '';
    document.getElementById('deposit-new-balance').textContent = fmt(state.balance);
}

function onDepositAmountChange() {
    const amt = parseFloat(document.getElementById('deposit-amount').value) || 0;
    document.getElementById('deposit-new-balance').textContent = fmt(state.balance + amt);
}

function confirmDeposit() {
    const amt  = parseFloat(document.getElementById('deposit-amount').value);
    const note = document.getElementById('deposit-note').value.trim();
    if (!amt || amt <= 0) { alert('Enter a valid amount.'); return; }

    const prev = state.balance;
    state.balance += amt;
    state.transactions.push({
        id: Date.now(), type: 'deposit',
        amount: amt, date: new Date().toISOString(),
        note: note || 'Deposit', balance: state.balance
    });
    save();

    const hit = MILESTONES.find(m => prev < m.target && state.balance >= m.target);
    if (hit) {
        showOverlay('🎉 Milestone Reached!', `You hit ${fmt(hit.target)}! You're ${((state.balance / state.target) * 100).toFixed(0)}% of the way to your Toyota Aqua. Keep going broo!`);
    } else {
        showOverlay('✅ Deposit Added', `${fmt(amt)} added to your Aqua Fund.\n\nNew balance: ${fmt(state.balance)}`);
    }
}

// ---- WITHDRAWAL ----

function renderWithdraw() {
    document.getElementById('withdraw-current-balance').textContent = fmt(state.balance);
    document.getElementById('withdraw-amount').value  = '';
    document.getElementById('withdraw-reason').value  = '';
    document.getElementById('withdraw-note').value    = '';
    document.getElementById('withdraw-impact').classList.add('hidden');
    document.getElementById('withdraw-submit-btn').disabled = true;
}

function onWithdrawAmountChange() {
    const amt    = parseFloat(document.getElementById('withdraw-amount').value) || 0;
    const impact = document.getElementById('withdraw-impact');
    if (amt > 0 && amt <= state.balance) {
        impact.classList.remove('hidden');
        const { days, newDate } = impactOfWithdrawal(amt);
        document.getElementById('impact-text').textContent   = `Delays your Aqua by ~${days} days`;
        document.getElementById('impact-detail').textContent = `New target: ${fmtMonth(newDate)} instead of Nov 2027`;
    } else {
        impact.classList.add('hidden');
    }
    validateWithdrawForm();
}

function validateWithdrawForm() {
    const amt    = parseFloat(document.getElementById('withdraw-amount').value) || 0;
    const reason = document.getElementById('withdraw-reason').value;
    const valid  = amt > 0 && amt <= state.balance && reason !== '';
    document.getElementById('withdraw-submit-btn').disabled = !valid;
}

function submitWithdrawal() {
    const amt    = parseFloat(document.getElementById('withdraw-amount').value);
    const reason = document.getElementById('withdraw-reason').value;
    const note   = document.getElementById('withdraw-note').value.trim();
    if (!amt || amt > state.balance || !reason) return;

    const { days, newDate } = impactOfWithdrawal(amt);
    state.balance -= amt;
    state.lastWithdrawal = new Date().toISOString();
    state.streakStart    = new Date().toISOString();
    state.transactions.push({
        id: Date.now(), type: 'withdrawal',
        amount: amt, date: new Date().toISOString(),
        reason, note, balance: state.balance
    });
    save();

    const msg = `${fmt(amt)} withdrawn for ${reason}${note ? ' — ' + note : ''}.\n\nBalance: ${fmt(state.balance)}\nGoal pushed back ~${days} days → ${fmtMonth(newDate)}`;
    showOverlay('📤 Withdrawn', msg);
}

// ---- HISTORY ----

function renderHistory() {
    const el   = document.getElementById('history-list');
    const list = [...state.transactions].reverse();
    el.innerHTML = list.length
        ? list.map(txnHTML).join('')
        : '<div class="empty-state">No transactions yet.</div>';
}

// ---- STATS (milestones + spending) ----

function renderStats() {
    // Milestones
    const milestoneEl = document.getElementById('milestone-list');
    milestoneEl.innerHTML = MILESTONES.map(m => {
        const done    = state.balance >= m.target;
        const current = !done && state.balance >= (m.target - MONTHLY_SAVINGS);
        const cls     = done ? 'completed' : current ? 'current' : '';
        const tick    = done ? '✓' : current ? '→' : '';
        const desc    = current ? 'You are here' : done ? 'Reached!' : '';
        return `
            <div class="milestone-item ${cls}">
                <div class="milestone-check">${tick}</div>
                <div class="milestone-info">
                    <div class="milestone-month">${m.label}</div>
                    ${desc ? `<div class="milestone-desc">${desc}</div>` : ''}
                </div>
                <div class="milestone-target">${fmt(m.target)}</div>
            </div>`;
    }).join('');

    // Spending breakdown
    const withdrawals    = state.transactions.filter(t => t.type === 'withdrawal');
    const spendStatsEl   = document.getElementById('spending-stats');
    const spendCatsEl    = document.getElementById('spending-categories');

    if (!withdrawals.length) {
        spendStatsEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1;padding:20px 0">No withdrawals yet — keep it that way! 💪</div>';
        spendCatsEl.innerHTML  = '';
        return;
    }

    const totalWithdrawn = withdrawals.reduce((s, t) => s + t.amount, 0);
    const totalDaysLost  = withdrawals.reduce((s, t) => {
        return s + Math.round(t.amount / (MONTHLY_SAVINGS / 30));
    }, 0);

    spendStatsEl.innerHTML = `
        <div class="stat-card">
            <div class="stat-value" style="color:var(--danger)">${fmt(totalWithdrawn)}</div>
            <div class="stat-label">withdrawn</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${withdrawals.length}</div>
            <div class="stat-label">withdrawals</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color:var(--warn)">${totalDaysLost}</div>
            <div class="stat-label">days delayed</div>
        </div>`;

    // Category bars
    const cats = {};
    withdrawals.forEach(t => {
        const r = t.reason || 'Other';
        if (!cats[r]) cats[r] = { total: 0, count: 0 };
        cats[r].total += t.amount;
        cats[r].count += 1;
    });

    const sorted = Object.entries(cats).sort((a, b) => b[1].total - a[1].total);
    const maxVal = sorted[0][1].total;

    spendCatsEl.innerHTML = sorted.map(([cat, data]) => {
        const pct  = Math.round((data.total / maxVal) * 100);
        const days = Math.round(data.total / (MONTHLY_SAVINGS / 30));
        return `
            <div class="spend-item">
                <div class="spend-header">
                    <span class="spend-cat">${cat}</span>
                    <span class="spend-amount">${fmt(data.total)} <span class="spend-count">${data.count}x · ${days}d delay</span></span>
                </div>
                <div class="spend-bar-bg">
                    <div class="spend-bar" style="width:${pct}%"></div>
                </div>
            </div>`;
    }).join('');
}

// ---- OVERLAY ----

function showOverlay(title, msg) {
    document.getElementById('success-title').textContent = title;
    document.getElementById('success-msg').textContent   = msg;
    document.getElementById('success-overlay').classList.remove('hidden');
}

function hideOverlay() {
    document.getElementById('success-overlay').classList.add('hidden');
    showScreen('dashboard');
}

// ---- INIT ----

function init() {
    loadState();
    if (!state.setupDone) {
        initSetup();
    } else {
        showScreen('pin');
        initPin();
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
}

document.addEventListener('DOMContentLoaded', init);
