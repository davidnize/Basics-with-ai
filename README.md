# Snowhite: AI Retail Ledger 🛒

A simple web app that helps small shops and local vendors record sales, scan receipts with AI, and manage stock.

🌐 **Live Site:** [snowhite-ledger.tech](https://snowhite-ledger.tech/)

## ✨ Features

- **Accounts:** Secure sign-up and login.
- **AI Receipt Scanning:** Extract vendor, items, total, and tax using Google Gemini.
- **Sales & History:** Review, edit, and save receipts in multiple currencies.
- **Inventory Management:** Track stock batches, suppliers, prices, and expiry dates.
- **FIFO Alerts:** Prioritize older stock and flag low or expiring items.
- **Mobile-Friendly:** Designed for everyday shop use.

## 🧰 Tech Stack

- **Backend:** Node.js, Express
- **Frontend:** EJS, HTML, CSS, JavaScript
- **Database:** PostgreSQL
- **AI:** Google Gemini API
- **Hosting:** Render

## 🚀 Getting Started

**Requirements:** Node.js, PostgreSQL, and a Gemini API key.

```bash
git clone https://github.com/davidnize/Basics-with-ai.git
cd Basics-with-ai
npm install
npm start
```

Configure your `.env` file with `DATABASE_URL`, `GEMINI_API_KEY`, and optionally `PORT=3000`.

Open `http://localhost:3000` in your browser.

**Note:** Never commit your `.env` file or API keys.

---

Built with ❤️ by the **Snowhite team**.
