document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('expense-form');
    const expenseList = document.getElementById('expense-list');
    const totalAmount = document.getElementById('total-amount');

    let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    let editIndex = null;

    function saveExpenses() {
        localStorage.setItem('expenses', JSON.stringify(expenses));
    }

    function renderDailyTotals() {
        const dailyTotalsDiv = document.getElementById('daily-totals');
        const totals = {};
        expenses.forEach(exp => {
            if (!totals[exp.date]) totals[exp.date] = { income: 0, expense: 0 };
            if (exp.type === 'income') {
                totals[exp.date].income += parseFloat(exp.amount);
            } else {
                totals[exp.date].expense += parseFloat(exp.amount);
            }
        });
        const dates = Object.keys(totals).sort((a, b) => b.localeCompare(a)); // newest first
        dailyTotalsDiv.innerHTML = '<h3>Daily Totals</h3>' +
            dates.map(date =>
                `<div class="daily-total-row"><span class="daily-total-date">${date}</span><span class="daily-total-income">Income: Rs.${totals[date].income.toFixed(2)}</span> <span class="daily-total-expense">Expense: Rs.${totals[date].expense.toFixed(2)}</span></div>`
            ).join('');
    }

    function updateDatalists() {
        const descriptionList = document.getElementById('description-list');
        const amountList = document.getElementById('amount-list');
        // Unique descriptions
        const descriptions = [...new Set(expenses.map(e => e.description).filter(Boolean))];
        // Unique amounts (as string, sorted descending)
        const amounts = [...new Set(expenses.map(e => parseFloat(e.amount).toFixed(2)).filter(Boolean))].sort((a, b) => b - a);
        descriptionList.innerHTML = descriptions.map(d => `<option value="${d}"></option>`).join('');
        amountList.innerHTML = amounts.map(a => `<option value="${a}"></option>`).join('');
    }

    function renderExpenses() {
        expenseList.innerHTML = '';
        let totalIncome = 0;
        let totalExpense = 0;
        // Group entries by date
        const grouped = {};
        const dailyTotals = {};
        expenses.forEach((expense, idx) => {
            if (!grouped[expense.date]) grouped[expense.date] = [];
            grouped[expense.date].push({ ...expense, idx });
            if (!dailyTotals[expense.date]) dailyTotals[expense.date] = { income: 0, expense: 0 };
            if (expense.type === 'income') {
                totalIncome += parseFloat(expense.amount);
                dailyTotals[expense.date].income += parseFloat(expense.amount);
            } else {
                totalExpense += parseFloat(expense.amount);
                dailyTotals[expense.date].expense += parseFloat(expense.amount);
            }
        });
        // Sort dates descending
        const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
        dates.forEach(date => {
            const dateHeader = document.createElement('li');
            dateHeader.className = 'date-header';
            dateHeader.innerHTML = `
                <span class="date-header-date">${date}</span>
                <span class="date-header-totals">
                    <span class="daily-total-income">Income: Rs.${dailyTotals[date].income.toFixed(2)}</span>
                    <span class="daily-total-expense" style="margin-left:12px;">Expense: Rs.${dailyTotals[date].expense.toFixed(2)}</span>
                </span>
            `;
            expenseList.appendChild(dateHeader);
            grouped[date].forEach(entry => {
                const li = document.createElement('li');
                const isIncome = entry.type === 'income';
                li.innerHTML = `
                    <span class="entry-text ${isIncome ? 'income-entry' : 'expense-entry'}">${entry.description}: Rs.${parseFloat(entry.amount).toFixed(2)} (${isIncome ? 'Income' : 'Expense'})</span>
                    <div class="entry-actions">
                        <button class="edit-btn" data-idx="${entry.idx}">Edit</button>
                        <button class="delete-btn" data-idx="${entry.idx}">Delete</button>
                    </div>
                `;
                expenseList.appendChild(li);
            });
        });
        document.getElementById('total-income').textContent = totalIncome.toFixed(2);
        document.getElementById('total-expense').textContent = totalExpense.toFixed(2);
        document.getElementById('net-balance').textContent = (totalIncome - totalExpense).toFixed(2);
        renderDailyTotals();
        updateDatalists();
        // Update form button
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.textContent = editIndex === null ? 'Add' : 'Update';
    }

    // --- AUTO-SAVE DRAFT LOGIC START ---
    const FORM_DRAFT_KEY = 'expense-form-draft';

    function saveFormDraft() {
        const draft = {
            type: document.getElementById('type').value,
            date: document.getElementById('date').value,
            description: document.getElementById('description').value,
            amount: document.getElementById('amount').value
        };
        localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(draft));
    }

    function loadFormDraft() {
        const draftStr = localStorage.getItem(FORM_DRAFT_KEY);
        if (!draftStr) return;
        try {
            const draft = JSON.parse(draftStr);
            if (draft.type) document.getElementById('type').value = draft.type;
            if (draft.date) document.getElementById('date').value = draft.date;
            if (draft.description) document.getElementById('description').value = draft.description;
            if (draft.amount) document.getElementById('amount').value = draft.amount;
        } catch {}
    }

    function clearFormDraft() {
        localStorage.removeItem(FORM_DRAFT_KEY);
    }

    // Listen for changes on all form fields
    ['type', 'date', 'description', 'amount'].forEach(id => {
        document.getElementById(id).addEventListener('input', saveFormDraft);
    });

    // Load draft on page load
    loadFormDraft();
    // --- AUTO-SAVE DRAFT LOGIC END ---

    // --- FIREBASE AUTH & SYNC LOGIC START ---
    const auth = firebase.auth();
    const db = firebase.firestore();
    let user = null;
    let isSyncing = false;

    // UI elements
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authStatus = document.getElementById('auth-status');
    const authSection = document.getElementById('auth-section');

    function setAuthStatus(msg) {
        authStatus.textContent = msg;
    }

    function setAuthUI(loggedIn) {
        if (loggedIn) {
            emailInput.style.display = 'none';
            passwordInput.style.display = 'none';
            loginBtn.style.display = 'none';
            signupBtn.style.display = 'none';
            logoutBtn.style.display = '';
        } else {
            emailInput.style.display = '';
            passwordInput.style.display = '';
            loginBtn.style.display = '';
            signupBtn.style.display = '';
            logoutBtn.style.display = 'none';
        }
    }

    // Auth event listeners
    loginBtn.addEventListener('click', async () => {
        setAuthStatus('Logging in...');
        try {
            await auth.signInWithEmailAndPassword(emailInput.value, passwordInput.value);
            setAuthStatus('Logged in!');
        } catch (err) {
            setAuthStatus('Login failed: ' + err.message);
        }
    });
    signupBtn.addEventListener('click', async () => {
        setAuthStatus('Signing up...');
        try {
            await auth.createUserWithEmailAndPassword(emailInput.value, passwordInput.value);
            setAuthStatus('Account created!');
        } catch (err) {
            setAuthStatus('Signup failed: ' + err.message);
        }
    });
    logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        setAuthStatus('Logged out.');
    });

    // Sync helpers
    function getUserDoc() {
        return db.collection('users').doc(user.uid);
    }

    async function loadExpensesFromCloud() {
        isSyncing = true;
        setAuthStatus('Syncing from cloud...');
        try {
            const doc = await getUserDoc().get();
            if (doc.exists && Array.isArray(doc.data().expenses)) {
                expenses = doc.data().expenses;
                saveExpenses(); // Save to localStorage for offline
                renderExpenses();
                setAuthStatus('Synced from cloud!');
            } else {
                expenses = [];
                saveExpenses();
                renderExpenses();
                setAuthStatus('No cloud data found.');
            }
        } catch (err) {
            setAuthStatus('Cloud sync failed: ' + err.message);
        }
        isSyncing = false;
    }

    async function saveExpensesToCloud() {
        if (!user || isSyncing) return;
        try {
            await getUserDoc().set({ expenses }, { merge: true });
            setAuthStatus('Synced to cloud!');
        } catch (err) {
            setAuthStatus('Cloud save failed: ' + err.message);
        }
    }

    // Listen for auth state changes
    auth.onAuthStateChanged(async (u) => {
        user = u;
        setAuthUI(!!user);
        if (user) {
            await loadExpensesFromCloud();
        } else {
            setAuthStatus('Not logged in.');
        }
    });

    // Save to cloud on every change
    const originalSaveExpenses = saveExpenses;
    saveExpenses = function() {
        originalSaveExpenses();
        saveExpensesToCloud();
    };
    // --- FIREBASE AUTH & SYNC LOGIC END ---

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const type = document.getElementById('type').value;
        const date = document.getElementById('date').value;
        const description = document.getElementById('description').value.trim();
        const amount = document.getElementById('amount').value;
        if (!date || !description || !amount) return;
        if (editIndex === null) {
            expenses.push({ date, description, amount, type });
        } else {
            expenses[editIndex] = { date, description, amount, type };
        }
        saveExpenses();
        renderExpenses();
        form.reset();
        editIndex = null;
        clearFormDraft(); // Clear draft on submit
    });

    expenseList.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-btn')) {
            const idx = e.target.getAttribute('data-idx');
            if (confirm('Are you sure you want to delete this expense?')) {
                expenses.splice(idx, 1);
                saveExpenses();
                renderExpenses();
                if (editIndex === Number(idx)) {
                    form.reset();
                    editIndex = null;
                    clearFormDraft(); // Clear draft on reset after edit
                }
            }
        }
        if (e.target.classList.contains('edit-btn')) {
            const idx = e.target.getAttribute('data-idx');
            const entry = expenses[idx];
            document.getElementById('type').value = entry.type;
            document.getElementById('date').value = entry.date;
            document.getElementById('description').value = entry.description;
            document.getElementById('amount').value = entry.amount;
            editIndex = Number(idx);
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Update';
        }
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        const dataStr = JSON.stringify(expenses, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'expenses_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const imported = JSON.parse(event.target.result);
                if (!Array.isArray(imported)) throw new Error('Invalid format');
                // Basic validation: check for required fields
                for (const entry of imported) {
                    if (!entry.date || !entry.description || !entry.amount || !entry.type) {
                        throw new Error('Missing fields in some entries');
                    }
                }
                expenses = imported;
                saveExpenses();
                renderExpenses();
                alert('Data imported successfully!');
            } catch (err) {
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    renderExpenses();
}); 