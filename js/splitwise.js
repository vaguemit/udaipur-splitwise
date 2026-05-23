// Udaipur Splitwise - Debt Calculation and Export Logic

class SplitwiseEngine {
  // Compute balances of all users in a group
  // Returns an object: { userId: { name, paid, spent, netBalance } }
  calculateBalances(groupId) {
    const users = window.store.getUsers(groupId);
    const expenses = window.store.getExpenses(groupId);
    const settlements = window.store.getSettlements(groupId);

    // Initial map
    const balances = {};
    users.forEach(u => {
      balances[u.id] = {
        id: u.id,
        name: u.name,
        paid: 0,
        spent: 0,
        receivedSettlements: 0,
        sentSettlements: 0,
        netBalance: 0
      };
    });

    // 1. Process Expenses
    expenses.forEach(exp => {
      const payerId = exp.paidById;
      const amount = exp.amount;

      // Payer gets credit for paid amount
      if (balances[payerId]) {
        balances[payerId].paid += amount;
      }

      // Add spent share to each participant
      Object.entries(exp.splitDetails).forEach(([userId, share]) => {
        if (balances[userId]) {
          balances[userId].spent += parseFloat(share);
        }
      });
    });

    // 2. Process Settlements (Payments between users to settle up)
    settlements.forEach(set => {
      const fromId = set.fromUserId;
      const toId = set.toUserId;
      const amount = set.amount;

      if (balances[fromId]) {
        balances[fromId].sentSettlements += amount;
      }
      if (balances[toId]) {
        balances[toId].receivedSettlements += amount;
      }
    });

    // 3. Compute overall Net Balance
    // Net Balance = (Paid - Spent) + (Sent Settlements - Received Settlements)
    // A positive balance means the group owes them money.
    // A negative balance means they owe the group money.
    Object.keys(balances).forEach(id => {
      const b = balances[id];
      b.netBalance = (b.paid - b.spent) + (b.sentSettlements - b.receivedSettlements);
    });

    return balances;
  }

  // Debt Simplification Algorithm
  // Input: Balances object from calculateBalances
  // Output: Array of simplified transactions: [ { fromUserId, toUserId, amount } ]
  simplifyDebts(groupId) {
    const balances = this.calculateBalances(groupId);
    
    // Create lists of debtors (netBalance < -0.01) and creditors (netBalance > 0.01)
    const debtors = [];
    const creditors = [];

    Object.values(balances).forEach(b => {
      // Fix floating point precision issues
      const val = parseFloat(b.netBalance.toFixed(4));
      if (val < -0.01) {
        debtors.push({ id: b.id, name: b.name, balance: val });
      } else if (val > 0.01) {
        creditors.push({ id: b.id, name: b.name, balance: val });
      }
    });

    // Sort debtors ascending (most negative first)
    debtors.sort((a, b) => a.balance - b.balance);
    // Sort creditors descending (most positive first)
    creditors.sort((a, b) => b.balance - a.balance);

    const transactions = [];
    let dIdx = 0;
    let cIdx = 0;

    // Greedily match debtors and creditors
    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const amountToPay = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      // Save transaction
      if (amountToPay > 0.01) {
        transactions.push({
          fromUserId: debtor.id,
          fromUserName: debtor.name,
          toUserId: creditor.id,
          toUserName: creditor.name,
          amount: parseFloat(amountToPay.toFixed(2))
        });
      }

      // Update balances
      debtor.balance += amountToPay;
      creditor.balance -= amountToPay;

      // Advance pointers if balances are fully settled (near 0)
      if (Math.abs(debtor.balance) < 0.01) {
        dIdx++;
      }
      if (Math.abs(creditor.balance) < 0.01) {
        cIdx++;
      }
    }

    return transactions;
  }

  // Format the complete log (expenses + settlements) as CSV
  exportToCSV(groupId) {
    const group = window.store.getGroups().find(g => g.id === groupId);
    const users = window.store.getUsers(groupId);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name; });

    const expenses = window.store.getExpenses(groupId);
    const settlements = window.store.getSettlements(groupId);

    // Combine and sort by date
    const allTransactions = [];
    expenses.forEach(e => {
      allTransactions.push({
        date: e.date,
        type: 'Expense',
        description: e.description,
        amount: e.amount,
        paidBy: userMap[e.paidById] || 'Unknown User',
        details: Object.entries(e.splitDetails)
          .map(([uid, share]) => `${userMap[uid] || 'Unknown'}: ₹${parseFloat(share).toFixed(2)}`)
          .join('; ')
      });
    });

    settlements.forEach(s => {
      allTransactions.push({
        date: s.date,
        type: 'Settlement',
        description: 'Settle Up Payment',
        amount: s.amount,
        paidBy: userMap[s.fromUserId] || 'Unknown User',
        details: `Paid to ${userMap[s.toUserId] || 'Unknown User'}`
      });
    });

    // Sort by date (oldest first)
    allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Create CSV content
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Paid By/From', 'Split Details/To'];
    const rows = [
      headers.join(','),
      ...allTransactions.map(t => [
        t.date,
        `"${t.type}"`,
        `"${t.description.replace(/"/g, '""')}"`,
        t.amount,
        `"${t.paidBy}"`,
        `"${t.details}"`
      ].join(','))
    ];

    return {
      filename: `${group ? group.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'group'}_transactions.csv`,
      content: rows.join('\n')
    };
  }

  // Format status + debts + transactions list as a beautiful WhatsApp text summary
  exportToWhatsAppText(groupId) {
    const group = window.store.getGroups().find(g => g.id === groupId);
    if (!group) return 'Group not found.';

    const users = window.store.getUsers(groupId);
    const userMap = {};
    users.forEach(u => { userMap[u.id] = u.name; });

    const balances = this.calculateBalances(groupId);
    const simplifiedDebts = this.simplifyDebts(groupId);
    const expenses = window.store.getExpenses(groupId);
    const settlements = window.store.getSettlements(groupId);

    let text = `*☀️ UDAIPUR SPLITWISE SUMMARY ☀️*\n`;
    text += `*Group:* ${group.name}\n`;
    text += `*Date:* ${new Date().toLocaleDateString()}\n`;
    text += `------------------------------------\n\n`;

    // 1. Group Balances
    text += `*👥 MEMBERS & NET BALANCES:*\n`;
    Object.values(balances).forEach(b => {
      const status = b.netBalance >= 0 ? `gets back ₹${b.netBalance.toFixed(2)}` : `owes ₹${Math.abs(b.netBalance).toFixed(2)}`;
      text += `• ${b.name}: ${status}\n`;
    });
    text += `\n`;

    // 2. Simplified Debts
    text += `*💡 SUGGESTED SETTLEMENTS (Simplified):*\n`;
    if (simplifiedDebts.length === 0) {
      text += `All settled up! No transactions needed. 🎉\n`;
    } else {
      simplifiedDebts.forEach(d => {
        text += `• ${d.fromUserName} ➡️ Pay *₹${d.amount.toFixed(2)}* to ${d.toUserName}\n`;
      });
    }
    text += `\n`;

    // 3. Transactions Log Summary
    text += `*📜 RECENT TRANSACTIONS LOG:*\n`;
    const combinedLog = [];
    expenses.forEach(e => {
      combinedLog.push({
        date: e.date,
        text: `[Expense] ${e.description} - ₹${e.amount.toFixed(2)} (Paid by ${userMap[e.paidById] || 'Unknown'})`
      });
    });
    settlements.forEach(s => {
      combinedLog.push({
        date: s.date,
        text: `[Settlement] ${userMap[s.fromUserId] || 'Unknown'} paid ₹${s.amount.toFixed(2)} to ${userMap[s.toUserId] || 'Unknown'}`
      });
    });

    // Sort by date (newest first for summary review)
    combinedLog.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (combinedLog.length === 0) {
      text += `No transactions logged yet.\n`;
    } else {
      // Show up to 15 recent items
      combinedLog.slice(0, 15).forEach(item => {
        text += `• ${item.date}: ${item.text}\n`;
      });
      if (combinedLog.length > 15) {
        text += `• ... and ${combinedLog.length - 15} more transactions.\n`;
      }
    }

    text += `\n_Generated gracefully by Udaipur Splitwise._`;
    return text;
  }
}

// Export a single global instance
window.splitwiseEngine = new SplitwiseEngine();
