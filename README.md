# Udaipur Splitwise

A premium, minimalist expense splitting application designed for single-phone group cost tracking. It is built entirely using HTML5, Vanilla CSS, and modern JavaScript, with zero build steps or heavy dependencies. 

It runs fully offline as a Progressive Web App (PWA) and stores all data locally in your browser's storage, making it perfect for tracking expenses on the go without requiring individual account logins.

## ✨ Features

- **Single-Phone Management**: One person can manage groups, add users, and input all expenses. Ideal for trips and group activities.
- **Minimalist Premium Aesthetic**: Styled with a curated ivory, warm grey, charcoal, and black/white color palette.
- **Smart Debt Simplification**: Built-in algorithm to minimize the number of transactions needed to settle debts between users.
- **Flexible Splits**: Split expenses equally or assign custom exact amounts.
- **Persistent Storage**: Automatic saving to local browser storage so you never lose your data.
- **Graceful Exporting**:
  - Export the complete transaction log as a clean CSV file.
  - Export a neat text report suitable for sharing via WhatsApp or SMS.
  - Full JSON backup and restore functionality.
- **Progressive Web App (PWA)**: Installable on Android and iOS devices for full offline functionality.

## 🚀 How to Run Locally

You can open the `index.html` file directly in any modern browser, or run a simple local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (npx)
npx serve .
```

Then visit `http://localhost:8000` (or the port specified by the server).

## 🌐 Deploy to GitHub Pages

Since this is a client-side static application, it can be hosted for free on GitHub Pages:

1. Push this repository to your GitHub account (`https://github.com/vaguemit/udaipur-splitwise`).
2. Go to the repository settings page on GitHub.
3. Select **Pages** in the left sidebar.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Set the branch to `main` (or `master`) and folder to `/ (root)`.
6. Click **Save**. Your app will be live within a few minutes!
