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