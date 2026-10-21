# AI Retail Ledger

AI Retail Ledger is a small-shop ledger built with technologies I am currently learning:

- HTML
- CSS
- JavaScript
- EJS
- Node.js
- Express
- PostgreSQL
- Axios
- Multer
- An external AI API

## What the app does

- Creates user accounts and logs users in.
- Uses PostgreSQL to store users, receipts and stock.
- Uploads a receipt image.
- Sends the image to Grok through an API request.
- Displays the vendor, total and items returned by the AI.
- Saves scanned receipts to the logged-in user's history.
- Lets users add and view stock batches.
- Shows low-stock and expiry alerts.

## Learning level

The code is intentionally written in a straightforward Node/Express style.

The project uses real backend concepts such as PostgreSQL, sessions, file uploads,
API requests and password hashing, but avoids unnecessary architecture and
abstractions. The goal is that the main application flow can be understood while
learning backend development.

React and Go are not used in this project.

## Run locally

1. Create a PostgreSQL database.
2. Copy `.env.example` to `.env`.
3. Add your `DATABASE_URL`.
4. Add your `XAI_API_KEY`.
5. Install dependencies:

```bash
npm install
```

6. Start the server:

```bash
npm start
```

The PostgreSQL tables are created automatically when the server starts.

Never commit `.env`, database credentials or API keys.
