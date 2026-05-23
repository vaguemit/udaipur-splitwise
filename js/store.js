// Udaipur Splitwise - Data Store Module
const STORAGE_KEY = 'udaipur_splitwise_data';
const ACTIVE_GROUP_KEY = 'udaipur_splitwise_active_group';

class DataStore {
  constructor() {
    this.state = {
      groups: [],
      users: [],
      expenses: [],
      settlements: []
    };
    this.load();
  }

  // Load state from localStorage
  load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        this.state = JSON.parse(data);
        // Ensure all arrays exist
        this.state.groups = this.state.groups || [];
        this.state.users = this.state.users || [];
        this.state.expenses = this.state.expenses || [];
        this.state.settlements = this.state.settlements || [];
      } else {
        this.initializeDefaultData();
      }
    } catch (e) {
      console.error('Error loading data from localStorage, initializing default.', e);
      this.initializeDefaultData();
    }
  }

  // Initialize a default group and users for new installation
  initializeDefaultData() {
    this.state = {
      groups: [
        {
          id: 'g-default',
          name: 'Udaipur Trip ☀️',
          description: 'Default group for Udaipur journey sharing costs',
          created_at: new Date().toISOString()
        }
      ],
      users: [
        { id: 'u-1', groupId: 'g-default', name: 'Mit' },
        { id: 'u-2', groupId: 'g-default', name: 'Aarav' },
        { id: 'u-3', groupId: 'g-default', name: 'Kabir' },
        { id: 'u-4', groupId: 'g-default', name: 'Zara' }
      ],
      expenses: [],
      settlements: []
    };
    this.save();
    this.setActiveGroupId('g-default');
  }

  // Save current state to localStorage
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('Error saving data to localStorage', e);
      alert('Local storage is full or disabled. Changes may not be saved.');
    }
  }

  // Get current active group ID
  getActiveGroupId() {
    let id = localStorage.getItem(ACTIVE_GROUP_KEY);
    if (!id && this.state.groups.length > 0) {
      id = this.state.groups[0].id;
      this.setActiveGroupId(id);
    }
    return id;
  }

  // Set active group ID
  setActiveGroupId(id) {
    localStorage.setItem(ACTIVE_GROUP_KEY, id);
  }

  // Generate unique IDs
  generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // --- GROUPS ---
  getGroups() {
    return this.state.groups;
  }

  addGroup(name, description = '') {
    const group = {
      id: this.generateId('g'),
      name: name.trim(),
      description: description.trim(),
      created_at: new Date().toISOString()
    };
    this.state.groups.push(group);
    this.save();
    return group;
  }

  deleteGroup(groupId) {
    this.state.groups = this.state.groups.filter(g => g.id !== groupId);
    this.state.users = this.state.users.filter(u => u.groupId !== groupId);
    this.state.expenses = this.state.expenses.filter(e => e.groupId !== groupId);
    this.state.settlements = this.state.settlements.filter(s => s.groupId !== groupId);
    this.save();
    
    // Reset active group if needed
    const activeId = this.getActiveGroupId();
    if (activeId === groupId) {
      if (this.state.groups.length > 0) {
        this.setActiveGroupId(this.state.groups[0].id);
      } else {
        localStorage.removeItem(ACTIVE_GROUP_KEY);
      }
    }
  }

  // --- USERS ---
  getUsers(groupId) {
    return this.state.users.filter(u => u.groupId === groupId);
  }

  addUser(groupId, name) {
    const trimmedName = name.trim();
    if (!trimmedName) return null;
    
    // Check for duplicate username in the same group
    const exists = this.state.users.some(u => u.groupId === groupId && u.name.toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      throw new Error('User with this name already exists in the group.');
    }

    const user = {
      id: this.generateId('u'),
      groupId,
      name: trimmedName
    };
    this.state.users.push(user);
    this.save();
    return user;
  }

  deleteUser(groupId, userId) {
    // Check if user is associated with any expense or settlement
    const hasExpenses = this.state.expenses.some(e => 
      e.groupId === groupId && (e.paidById === userId || userId in e.splitDetails)
    );
    const hasSettlements = this.state.settlements.some(s => 
      s.groupId === groupId && (s.fromUserId === userId || s.toUserId === userId)
    );

    if (hasExpenses || hasSettlements) {
      throw new Error('Cannot delete user. They are part of existing expenses or settlements. Please delete or modify those transactions first.');
    }

    this.state.users = this.state.users.filter(u => !(u.groupId === groupId && u.id === userId));
    this.save();
  }

  // --- EXPENSES ---
  getExpenses(groupId) {
    return this.state.expenses.filter(e => e.groupId === groupId);
  }

  addExpense(groupId, { description, amount, paidById, splitDetails, category = 'Other', date = null }) {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Invalid expense amount.');
    }
    if (!description.trim()) {
      throw new Error('Expense description is required.');
    }
    if (!paidById) {
      throw new Error('Payer must be selected.');
    }

    // Verify split details total up to the expense amount (allow tiny margin for floating point precision)
    const splitTotal = Object.values(splitDetails).reduce((sum, val) => sum + parseFloat(val || 0), 0);
    if (Math.abs(splitTotal - numericAmount) > 0.05) {
      throw new Error(`Split amounts (${splitTotal.toFixed(2)}) must equal total amount (${numericAmount.toFixed(2)}).`);
    }

    const expense = {
      id: this.generateId('e'),
      groupId,
      description: description.trim(),
      amount: numericAmount,
      paidById,
      splitDetails,
      category,
      date: date || new Date().toISOString().split('T')[0]
    };
    this.state.expenses.push(expense);
    this.save();
    return expense;
  }

  deleteExpense(groupId, expenseId) {
    this.state.expenses = this.state.expenses.filter(e => !(e.groupId === groupId && e.id === expenseId));
    this.save();
  }

  // --- SETTLEMENTS ---
  getSettlements(groupId) {
    return this.state.settlements.filter(s => s.groupId === groupId);
  }

  addSettlement(groupId, { fromUserId, toUserId, amount, date = null }) {
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      throw new Error('Invalid settlement amount.');
    }
    if (!fromUserId || !toUserId || fromUserId === toUserId) {
      throw new Error('Invalid sender or receiver.');
    }

    const settlement = {
      id: this.generateId('s'),
      groupId,
      fromUserId,
      toUserId,
      amount: numericAmount,
      date: date || new Date().toISOString().split('T')[0]
    };
    this.state.settlements.push(settlement);
    this.save();
    return settlement;
  }

  deleteSettlement(groupId, settlementId) {
    this.state.settlements = this.state.settlements.filter(s => !(s.groupId === groupId && s.id === settlementId));
    this.save();
  }

  // --- BACKUP & RESTORE ---
  exportDataJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  importDataJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        // Validate basic schema structure
        if (Array.isArray(parsed.groups) && Array.isArray(parsed.users) && Array.isArray(parsed.expenses) && Array.isArray(parsed.settlements)) {
          this.state = parsed;
          this.save();
          if (this.state.groups.length > 0) {
            this.setActiveGroupId(this.state.groups[0].id);
          } else {
            localStorage.removeItem(ACTIVE_GROUP_KEY);
          }
          return true;
        }
      }
      throw new Error('Invalid JSON structure. Must contain groups, users, expenses, and settlements arrays.');
    } catch (e) {
      throw new Error(`Failed to import data: ${e.message}`);
    }
  }

  // Clear all data (reset to default)
  resetAll() {
    this.initializeDefaultData();
  }
}

// Export a single global instance
window.store = new DataStore();
