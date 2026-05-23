// Udaipur Splitwise - Main UI Controller

class AppController {
  constructor() {
    this.activeTab = 'dashboard';
    this.currentSplitMethod = 'equal'; // 'equal' or 'custom'
    this.selectedCategory = 'Food';
    
    // Bind event listeners on page load
    window.addEventListener('DOMContentLoaded', () => {
      this.init();
    });
  }

  init() {
    // Set default date for expense form to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('exp-date').value = today;
    document.getElementById('settle-date').value = today;

    // Listen for network status changes
    window.addEventListener('online', () => this.updateOnlineStatus());
    window.addEventListener('offline', () => this.updateOnlineStatus());
    this.updateOnlineStatus();

    // Initial render
    this.renderAll();
  }

  updateOnlineStatus() {
    const status = document.getElementById('connection-status');
    if (status) {
      status.style.display = navigator.onLine ? 'none' : 'inline-block';
    }
  }

  // --- TAB NAVIGATION ---
  switchToTab(tabId) {
    this.activeTab = tabId;
    
    // Update view panel classes
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const activePanel = document.getElementById(`view-${tabId}`);
    if (activePanel) {
      activePanel.classList.add('active');
    }

    // Update bottom nav active classes
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const activeNavItem = document.getElementById(`nav-${tabId}`);
    if (activeNavItem) {
      activeNavItem.classList.add('active');
    }

    // Re-render the specific view
    this.renderAll();

    // Scroll to top of viewport
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- MODAL CONTROLS ---
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      
      // Hook up dynamic fields for forms when modal opens
      if (modalId === 'modal-add-expense') {
        this.resetAddExpenseForm();
        this.populatePayerDropdown();
        this.generateSplitMemberFields();
      } else if (modalId === 'modal-settle-up') {
        this.populateSettleDropdowns();
      }
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  }

  openAddUserModal() {
    this.openModal('modal-add-user');
  }

  openAddExpenseModal() {
    this.openModal('modal-add-expense');
  }

  // --- RENDER ROUTER ---
  renderAll() {
    const groupId = window.store.getActiveGroupId();
    const group = window.store.getGroups().find(g => g.id === groupId);
    
    // Render Header Group Badge
    const badge = document.getElementById('active-group-badge');
    if (group) {
      badge.textContent = group.name;
      badge.style.display = 'flex';
      
      // Update delete button visibility (don't allow deleting if only 1 group left)
      const deleteBtn = document.getElementById('delete-current-group-btn');
      if (deleteBtn) {
        deleteBtn.disabled = window.store.getGroups().length <= 1;
      }
    } else {
      badge.style.display = 'none';
    }

    // Render respective active view
    switch (this.activeTab) {
      case 'dashboard':
        this.renderDashboard(groupId);
        break;
      case 'expenses':
        this.renderExpenses(groupId);
        break;
      case 'balances':
        this.renderBalances(groupId);
        break;
      case 'groups':
        this.renderGroups(groupId);
        break;
      case 'settings':
        // Settings render is static mostly, but we can verify consistency
        break;
    }
  }

  // --- VIEW RENDERING LOGIC ---

  // 1. Dashboard View
  renderDashboard(groupId) {
    const users = window.store.getUsers(groupId);
    const expenses = window.store.getExpenses(groupId);
    
    // Update Subtitle Member Count
    document.getElementById('member-count-subtitle').textContent = `${users.length} member${users.length === 1 ? '' : 's'} in group`;

    // Compute Total expenses in group
    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
    document.getElementById('dashboard-hero-amount').textContent = `₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Render group members list with individual balances
    const listContainer = document.getElementById('members-balance-list');
    listContainer.innerHTML = '';

    if (users.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--color-grey-dark); padding: var(--spacing-lg) 0;">
          <p>No members added yet.</p>
          <button class="btn btn-secondary btn-hero" style="margin-top: var(--spacing-sm);" onclick="appController.openAddUserModal()">
            Add First Member
          </button>
        </div>
      `;
      return;
    }

    const balances = window.splitwiseEngine.calculateBalances(groupId);

    users.forEach(user => {
      const b = balances[user.id] || { paid: 0, spent: 0, netBalance: 0 };
      const netVal = b.netBalance;
      
      let balanceClass = 'neutral';
      let balanceLabel = 'settled up';
      let formattedVal = `₹0.00`;

      if (netVal > 0.01) {
        balanceClass = 'positive';
        balanceLabel = 'gets back';
        formattedVal = `+₹${netVal.toFixed(2)}`;
      } else if (netVal < -0.01) {
        balanceClass = 'negative';
        balanceLabel = 'owes';
        formattedVal = `-₹${Math.abs(netVal).toFixed(2)}`;
      }

      const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

      const memberRow = document.createElement('div');
      memberRow.className = 'list-item member-row';
      memberRow.innerHTML = `
        <div class="member-info">
          <div class="avatar-circle">${initials}</div>
          <div>
            <div class="member-name">${user.name}</div>
            <div class="subtitle" style="font-size: 0.72rem;">Paid ₹${b.paid.toFixed(0)} • Spent ₹${b.spent.toFixed(0)}</div>
          </div>
        </div>
        <div class="member-balance-val">
          <div class="balance-amount ${balanceClass}">${formattedVal}</div>
          <div class="balance-label">${balanceLabel}</div>
        </div>
      `;
      
      // Tap member row to edit or delete user (with safety checks)
      memberRow.addEventListener('click', () => {
        if (confirm(`Remove "${user.name}" from the group?`)) {
          try {
            window.store.deleteUser(groupId, user.id);
            this.renderAll();
          } catch (e) {
            alert(e.message);
          }
        }
      });

      listContainer.appendChild(memberRow);
    });
  }

  // 2. Expenses Log View
  renderExpenses(groupId) {
    const expenses = window.store.getExpenses(groupId);
    const settlements = window.store.getSettlements(groupId);
    const users = window.store.getUsers(groupId);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name; });

    const searchInput = document.getElementById('expense-search-input').value.toLowerCase().trim();
    const listContainer = document.getElementById('expenses-log-list');
    listContainer.innerHTML = '';

    // Merge transactions and sort by date descending
    const listItems = [];
    
    expenses.forEach(e => {
      listItems.push({
        id: e.id,
        type: 'expense',
        category: e.category,
        description: e.description,
        amount: e.amount,
        date: e.date,
        paidById: e.paidById,
        paidByName: userMap[e.paidById] || 'Deleted User',
        splitDetails: e.splitDetails
      });
    });

    settlements.forEach(s => {
      listItems.push({
        id: s.id,
        type: 'settlement',
        category: 'Settle',
        description: `Settle up payment`,
        amount: s.amount,
        date: s.date,
        fromUserId: s.fromUserId,
        fromUserName: userMap[s.fromUserId] || 'Deleted User',
        toUserId: s.toUserId,
        toUserName: userMap[s.toUserId] || 'Deleted User'
      });
    });

    // Sort transactions: Newest date first, then newest creation order (via ID timestamp prefix)
    listItems.sort((a, b) => {
      const dateCompare = new Date(b.date) - new Date(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });

    // Filter list
    const filteredItems = listItems.filter(item => {
      if (!searchInput) return true;
      return item.description.toLowerCase().includes(searchInput) || 
             item.category.toLowerCase().includes(searchInput) ||
             (item.paidByName && item.paidByName.toLowerCase().includes(searchInput)) ||
             (item.fromUserName && item.fromUserName.toLowerCase().includes(searchInput)) ||
             (item.toUserName && item.toUserName.toLowerCase().includes(searchInput));
    });

    if (filteredItems.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--color-grey-dark); padding: var(--spacing-lg) 0;">
          <p>${listItems.length === 0 ? 'No transactions logged yet.' : 'No matching transactions found.'}</p>
        </div>
      `;
      return;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    filteredItems.forEach(item => {
      const dateObj = new Date(item.date);
      const day = dateObj.getDate() || '1';
      const month = months[dateObj.getMonth()] || 'Jan';

      const txnRow = document.createElement('div');
      txnRow.className = 'list-item txn-item';
      
      let categoryEmoji = '📦';
      if (item.type === 'expense') {
        const catMap = { Food: '🍔', Stay: '🏨', Transport: '🚕', Tickets: '🎟️', Shopping: '🛍️', Other: '📦' };
        categoryEmoji = catMap[item.category] || '📦';
      } else {
        categoryEmoji = '🤝';
      }

      if (item.type === 'expense') {
        txnRow.innerHTML = `
          <div class="txn-date-badge">
            <span class="txn-date-day">${day}</span>
            <span class="txn-date-month">${month}</span>
          </div>
          <div class="txn-details">
            <span class="txn-description">${item.description}</span>
            <span class="txn-payer">${categoryEmoji} Paid by ${item.paidByName}</span>
          </div>
          <div class="txn-amount-col">
            <span class="txn-value">₹${item.amount.toFixed(2)}</span>
            <span class="txn-type-label expense">Expense</span>
          </div>
        `;
      } else {
        txnRow.innerHTML = `
          <div class="txn-date-badge">
            <span class="txn-date-day">${day}</span>
            <span class="txn-date-month">${month}</span>
          </div>
          <div class="txn-details">
            <span class="txn-description">${item.fromUserName} Paid ${item.toUserName}</span>
            <span class="txn-payer">${categoryEmoji} Settled up</span>
          </div>
          <div class="txn-amount-col">
            <span class="txn-value">₹${item.amount.toFixed(2)}</span>
            <span class="txn-type-label settlement">Settled</span>
          </div>
        `;
      }

      // Add delete option on click
      txnRow.addEventListener('click', () => {
        const typeText = item.type === 'expense' ? `Expense: "${item.description}"` : 'Settlement record';
        if (confirm(`Are you sure you want to delete this ${typeText}?`)) {
          if (item.type === 'expense') {
            window.store.deleteExpense(groupId, item.id);
          } else {
            window.store.deleteSettlement(groupId, item.id);
          }
          this.renderAll();
        }
      });

      listContainer.appendChild(txnRow);
    });
  }

  // 3. Balances and Settlements View
  renderBalances(groupId) {
    const simplifiedDebts = window.splitwiseEngine.simplifyDebts(groupId);
    const debtsContainer = document.getElementById('debts-simplified-list');
    debtsContainer.innerHTML = '';

    if (simplifiedDebts.length === 0) {
      debtsContainer.innerHTML = `
        <div style="text-align: center; color: var(--color-grey-dark); padding: var(--spacing-lg) 0;">
          <p>Everyone is settled up! All clear. 🎉</p>
        </div>
      `;
    } else {
      simplifiedDebts.forEach(debt => {
        const debtRow = document.createElement('div');
        debtRow.className = 'list-item';
        debtRow.style.padding = 'var(--spacing-md)';
        debtRow.innerHTML = `
          <div class="debt-direction">
            <div class="debt-person sender">
              <span style="font-weight: 700;">${debt.fromUserName}</span>
              <span class="subtitle" style="font-size: 0.72rem;">owes</span>
            </div>
            <div class="debt-arrow">
              <span class="debt-action-amount">₹${debt.amount.toFixed(2)}</span>
              <svg viewBox="0 0 24 16"><path d="M 0 8 L 22 8 M 16 2 L 22 8 L 16 14" stroke-linecap="round"/></svg>
            </div>
            <div class="debt-person">
              <span style="font-weight: 700;">${debt.toUserName}</span>
              <span class="subtitle" style="font-size: 0.72rem;">gets back</span>
            </div>
          </div>
          <button class="btn btn-primary btn-hero" style="margin-left: var(--spacing-md);" onclick="appController.openQuickSettleUp('${debt.fromUserId}', '${debt.toUserId}', ${debt.amount})">
            Settle
          </button>
        `;
        debtsContainer.appendChild(debtRow);
      });
    }

    // Render historical settlements
    const settlements = window.store.getSettlements(groupId);
    const users = window.store.getUsers(groupId);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name; });

    const settlementsContainer = document.getElementById('settlements-log-list');
    settlementsContainer.innerHTML = '';

    if (settlements.length === 0) {
      settlementsContainer.innerHTML = `
        <div style="text-align: center; color: var(--color-grey-dark); padding: var(--spacing-md) 0; font-size: 0.85rem;">
          <p>No settlement payments recorded yet.</p>
        </div>
      `;
    } else {
      settlements.forEach(s => {
        const sRow = document.createElement('div');
        sRow.className = 'list-item';
        sRow.style.padding = 'var(--spacing-sm) var(--spacing-md)';
        sRow.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; font-size: 0.88rem;">
            <span>
              <strong>${userMap[s.fromUserId] || 'Deleted User'}</strong> paid 
              <strong>${userMap[s.toUserId] || 'Deleted User'}</strong>: 
              <span style="font-weight: 700; color: var(--color-positive);">₹${s.amount.toFixed(2)}</span>
            </span>
            <button class="btn-close" style="padding: var(--spacing-xs);" onclick="appController.handleDeleteSettlementDirect('${s.id}')">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        `;
        settlementsContainer.appendChild(sRow);
      });
    }
  }

  // 4. Groups Manager View
  renderGroups(activeGroupId) {
    const groups = window.store.getGroups();
    const listContainer = document.getElementById('groups-list');
    listContainer.innerHTML = '';

    groups.forEach(g => {
      const gRow = document.createElement('div');
      gRow.className = `list-item ${g.id === activeGroupId ? 'active-group' : ''}`;
      if (g.id === activeGroupId) {
        gRow.style.borderColor = 'var(--color-black)';
        gRow.style.backgroundColor = 'var(--color-ivory-dark)';
      }
      
      const userCount = window.store.getUsers(g.id).length;
      const expenseCount = window.store.getExpenses(g.id).length;

      gRow.innerHTML = `
        <div style="flex: 1; cursor: pointer;">
          <div style="font-weight: 700; display: flex; align-items: center; gap: var(--spacing-sm);">
            ${g.name} ${g.id === activeGroupId ? '⭐' : ''}
          </div>
          <div class="subtitle" style="font-size: 0.75rem;">
            ${g.description || 'No description'} • ${userCount} members • ${expenseCount} expenses
          </div>
        </div>
      `;

      gRow.querySelector('div').addEventListener('click', () => {
        window.store.setActiveGroupId(g.id);
        this.renderAll();
      });

      listContainer.appendChild(gRow);
    });
  }

  // --- ACTIONS & SUBMISSIONS ---

  // User Actions
  handleAddUser(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new-user-name');
    const name = nameInput.value;
    const groupId = window.store.getActiveGroupId();

    try {
      window.store.addUser(groupId, name);
      nameInput.value = '';
      this.closeModal('modal-add-user');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  }

  // Quick Settle up from Balances Panel
  openQuickSettleUp(fromId, toId, amount) {
    this.openModal('modal-settle-up');
    
    // Set values in selector
    document.getElementById('settle-from').value = fromId;
    this.populateSettleRecipientDropdown(fromId);
    document.getElementById('settle-to').value = toId;
    document.getElementById('settle-amount').value = parseFloat(amount.toFixed(2));
  }

  // Dynamic dropdown triggers inside settlements
  populateSettleDropdowns() {
    const groupId = window.store.getActiveGroupId();
    const users = window.store.getUsers(groupId);
    
    const fromSelect = document.getElementById('settle-from');
    fromSelect.innerHTML = '<option value="">Select Payer...</option>';
    
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      fromSelect.appendChild(opt);
    });

    // Recipient selection (empty initially until payer selected)
    document.getElementById('settle-to').innerHTML = '<option value="">Select Recipient...</option>';
    document.getElementById('settle-amount').value = '';
  }

  handleSettlePayerChange() {
    const fromId = document.getElementById('settle-from').value;
    this.populateSettleRecipientDropdown(fromId);
  }

  populateSettleRecipientDropdown(fromId) {
    const groupId = window.store.getActiveGroupId();
    const users = window.store.getUsers(groupId);
    const toSelect = document.getElementById('settle-to');
    
    toSelect.innerHTML = '<option value="">Select Recipient...</option>';
    
    users.forEach(u => {
      if (u.id !== fromId) {
        const opt = document.createElement('option');
        opt.value = u.id;
        opt.textContent = u.name;
        toSelect.appendChild(opt);
      }
    });
  }

  handleRecordSettlement(e) {
    e.preventDefault();
    const groupId = window.store.getActiveGroupId();
    const fromUserId = document.getElementById('settle-from').value;
    const toUserId = document.getElementById('settle-to').value;
    const amount = document.getElementById('settle-amount').value;
    const date = document.getElementById('settle-date').value;

    try {
      window.store.addSettlement(groupId, { fromUserId, toUserId, amount, date });
      this.closeModal('modal-settle-up');
      this.renderAll();
      this.switchToTab('balances');
    } catch (err) {
      alert(err.message);
    }
  }

  handleDeleteSettlementDirect(settlementId) {
    if (confirm('Delete this settlement payment?')) {
      const groupId = window.store.getActiveGroupId();
      window.store.deleteSettlement(groupId, settlementId);
      this.renderAll();
    }
  }

  // Dynamic dropdown and checkbox listings inside Expense modal
  populatePayerDropdown() {
    const groupId = window.store.getActiveGroupId();
    const users = window.store.getUsers(groupId);
    const select = document.getElementById('exp-paid-by');
    
    select.innerHTML = '<option value="">Who paid...</option>';
    users.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = u.name;
      select.appendChild(opt);
    });
  }

  setSplitMethod(method) {
    this.currentSplitMethod = method;
    document.getElementById('split-tab-equal').className = `split-tab ${method === 'equal' ? 'active' : ''}`;
    document.getElementById('split-tab-custom').className = `split-tab ${method === 'custom' ? 'active' : ''}`;
    
    this.generateSplitMemberFields();
  }

  setCategory(element) {
    document.querySelectorAll('.category-option').forEach(el => el.classList.remove('active'));
    element.classList.add('active');
    this.selectedCategory = element.getAttribute('data-category');
    document.getElementById('exp-category').value = this.selectedCategory;
  }

  generateSplitMemberFields() {
    const groupId = window.store.getActiveGroupId();
    const users = window.store.getUsers(groupId);
    const container = document.getElementById('expense-split-members');
    
    container.innerHTML = '';
    
    if (users.length === 0) {
      container.innerHTML = '<div class="subtitle" style="padding: 10px; text-align: center;">No members in group yet.</div>';
      return;
    }

    users.forEach(user => {
      const div = document.createElement('div');
      div.className = 'split-member-item';

      if (this.currentSplitMethod === 'equal') {
        div.innerHTML = `
          <div class="split-member-left">
            <input type="checkbox" id="split-equal-chk-${user.id}" value="${user.id}" checked style="width: 18px; height: 18px;" onchange="appController.calculateLiveEqualSplits()">
            <label for="split-equal-chk-${user.id}" style="margin: 0; font-size: 0.9rem; text-transform: none; font-weight: 500;">${user.name}</label>
          </div>
          <span style="font-weight: 600; font-size: 0.88rem; color: var(--color-grey-dark);" id="split-equal-val-${user.id}">₹0.00</span>
        `;
      } else {
        div.innerHTML = `
          <div class="split-member-left">
            <span style="font-weight: 500;">${user.name}</span>
          </div>
          <div class="input-prefix">
            <span class="input-prefix-symbol" style="font-size: 0.8rem; left: 8px;">₹</span>
            <input type="number" step="0.01" class="split-member-input exp-custom-split-val" data-userid="${user.id}" placeholder="0.00" oninput="appController.verifyCustomSplitSum()">
          </div>
        `;
      }
      container.appendChild(div);
    });

    if (this.currentSplitMethod === 'equal') {
      this.calculateLiveEqualSplits();
    }
  }

  handleExpenseAmountInput() {
    if (this.currentSplitMethod === 'equal') {
      this.calculateLiveEqualSplits();
    } else {
      this.verifyCustomSplitSum();
    }
  }

  calculateLiveEqualSplits() {
    const totalAmount = parseFloat(document.getElementById('exp-amount').value) || 0;
    const checkedBoxes = document.querySelectorAll('#expense-split-members input[type="checkbox"]:checked');
    const divisor = checkedBoxes.length;
    
    // Reset all amounts to 0 initially
    document.querySelectorAll('[id^="split-equal-val-"]').forEach(el => {
      el.textContent = '₹0.00';
    });

    if (totalAmount > 0 && divisor > 0) {
      const share = totalAmount / divisor;
      checkedBoxes.forEach(chk => {
        const valSpan = document.getElementById(`split-equal-val-${chk.value}`);
        if (valSpan) {
          valSpan.textContent = `₹${share.toFixed(2)}`;
        }
      });
    }
  }

  verifyCustomSplitSum() {
    const totalAmount = parseFloat(document.getElementById('exp-amount').value) || 0;
    let currentSum = 0;
    
    document.querySelectorAll('.exp-custom-split-val').forEach(input => {
      currentSum += parseFloat(input.value) || 0;
    });

    // Visual feedback for sum matching
    const amountField = document.getElementById('exp-amount');
    if (totalAmount > 0 && Math.abs(currentSum - totalAmount) > 0.02) {
      amountField.style.borderColor = 'var(--color-negative)';
    } else {
      amountField.style.borderColor = 'var(--color-black)';
    }
  }

  resetAddExpenseForm() {
    const form = document.getElementById('add-expense-form');
    form.reset();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('exp-date').value = today;
    document.getElementById('exp-amount').style.borderColor = 'var(--color-grey-mid)';
    
    // Set default category
    this.selectedCategory = 'Food';
    document.getElementById('exp-category').value = 'Food';
    document.querySelectorAll('.category-option').forEach(el => {
      el.classList.remove('active');
      if (el.getAttribute('data-category') === 'Food') {
        el.classList.add('active');
      }
    });

    this.currentSplitMethod = 'equal';
    document.getElementById('split-tab-equal').className = 'split-tab active';
    document.getElementById('split-tab-custom').className = 'split-tab';
  }

  handleAddExpense(e) {
    e.preventDefault();
    const groupId = window.store.getActiveGroupId();
    const description = document.getElementById('exp-desc').value;
    const amount = parseFloat(document.getElementById('exp-amount').value);
    const paidById = document.getElementById('exp-paid-by').value;
    const category = document.getElementById('exp-category').value;
    const date = document.getElementById('exp-date').value;

    const splitDetails = {};

    if (this.currentSplitMethod === 'equal') {
      const checkedBoxes = document.querySelectorAll('#expense-split-members input[type="checkbox"]:checked');
      if (checkedBoxes.length === 0) {
        alert('Please check at least one group member to split the cost with.');
        return;
      }
      
      const share = amount / checkedBoxes.length;
      checkedBoxes.forEach(chk => {
        splitDetails[chk.value] = parseFloat(share.toFixed(4));
      });
      
      // Fine-tune floating point rounding so details match total sum exactly
      const detailsSum = Object.values(splitDetails).reduce((s, v) => s + v, 0);
      const diff = amount - detailsSum;
      if (Math.abs(diff) > 0.001) {
        const primaryUserId = checkedBoxes[0].value;
        splitDetails[primaryUserId] = parseFloat((splitDetails[primaryUserId] + diff).toFixed(4));
      }

    } else {
      let customSum = 0;
      const inputs = document.querySelectorAll('.exp-custom-split-val');
      
      inputs.forEach(input => {
        const shareVal = parseFloat(input.value) || 0;
        if (shareVal > 0) {
          splitDetails[input.getAttribute('data-userid')] = shareVal;
          customSum += shareVal;
        }
      });

      if (Math.abs(customSum - amount) > 0.05) {
        alert(`Split sum (₹${customSum.toFixed(2)}) must equal total expense amount (₹${amount.toFixed(2)})!`);
        return;
      }
    }

    try {
      window.store.addExpense(groupId, { description, amount, paidById, splitDetails, category, date });
      this.closeModal('modal-add-expense');
      this.renderAll();
    } catch (err) {
      alert(err.message);
    }
  }

  // Group Switcher Dialog
  openGroupSwitcher() {
    this.openModal('modal-group-switcher');
    const container = document.getElementById('group-switcher-list');
    container.innerHTML = '';

    const groups = window.store.getGroups();
    const activeId = window.store.getActiveGroupId();

    groups.forEach(g => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.style.padding = 'var(--spacing-md)';
      item.style.cursor = 'pointer';
      if (g.id === activeId) {
        item.style.backgroundColor = 'var(--color-ivory-dark)';
        item.style.fontWeight = '700';
      }

      item.innerHTML = `
        <div style="flex: 1;">
          <span>${g.name}</span>
          ${g.id === activeId ? '<span style="font-size: 0.8rem; color: var(--color-grey-dark); margin-left: 5px;">(Active)</span>' : ''}
        </div>
      `;

      item.addEventListener('click', () => {
        window.store.setActiveGroupId(g.id);
        this.closeModal('modal-group-switcher');
        this.renderAll();
      });

      container.appendChild(item);
    });
  }

  handleCreateGroup(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new-group-name');
    const descInput = document.getElementById('new-group-desc');
    
    const name = nameInput.value;
    const desc = descInput.value;

    const group = window.store.addGroup(name, desc);
    
    // Reset forms
    nameInput.value = '';
    descInput.value = '';
    
    // Switch active group to the new one and route to dashboard
    window.store.setActiveGroupId(group.id);
    this.switchToTab('dashboard');
  }

  handleDeleteCurrentGroup() {
    const groupId = window.store.getActiveGroupId();
    const group = window.store.getGroups().find(g => g.id === groupId);
    if (!group) return;

    if (confirm(`⚠️ DANGER: Are you sure you want to delete the group "${group.name}"?\nThis will delete all its members, expenses, and settlements permanently!`)) {
      window.store.deleteGroup(groupId);
      this.renderAll();
      this.switchToTab('dashboard');
    }
  }

  handleResetApp() {
    if (confirm('⚠️ WARNING: This will permanently delete ALL groups, members, and transactions from your browser memory. Are you absolutely sure?')) {
      window.store.resetAll();
      this.renderAll();
      this.switchToTab('dashboard');
      alert('Data reset successfully.');
    }
  }

  // --- PORTABILITY EXPORTS ---

  // Export to text (WhatsApp format)
  exportToWhatsApp() {
    const groupId = window.store.getActiveGroupId();
    const text = window.splitwiseEngine.exportToWhatsAppText(groupId);
    
    navigator.clipboard.writeText(text).then(() => {
      alert('📋 Summary report copied to clipboard gracefully! You can now paste it directly into WhatsApp.');
    }).catch(err => {
      console.error('Failed to copy text', err);
      // Fallback display if clipboard permissions block
      alert('Could not auto-copy. You can copy the raw text from settings log instead.');
    });
  }

  // Download CSV log file
  downloadCSV() {
    const groupId = window.store.getActiveGroupId();
    const csvData = window.splitwiseEngine.exportToCSV(groupId);
    
    const blob = new Blob([csvData.content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) { // IE 10+
      navigator.msSaveBlob(blob, csvData.filename);
    } else {
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', csvData.filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Download JSON state backup
  downloadBackupJSON() {
    const dataStr = window.store.exportDataJSON();
    const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    
    const today = new Date().toISOString().split('T')[0];
    const filename = `splitwise_backup_${today}.json`;

    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Import JSON state backup
  importBackupJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const success = window.store.importDataJSON(event.target.result);
        if (success) {
          alert('✅ Data restored successfully! Group details loaded.');
          this.renderAll();
          this.switchToTab('dashboard');
        }
      } catch (err) {
        alert(`❌ Import Failed: ${err.message}`);
      }
      // Reset input element
      e.target.value = '';
    };
    reader.readAsText(file);
  }
}

// Instantiate global app controller
window.appController = new AppController();
