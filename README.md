# Arkhitect

Validates GP_Order financial calculations against Bubble API data via the **Arkhitect** web app (React + Vite + PostgreSQL). All tests run dynamically via Judge0 using user-editable templates.

## Arkhitect Web App

A minimalist SaaS-style app with:
- **Setup** – Configure Bubble API (required), Cursor API, GitHub repo URL, Judge0
- **Validator** – Shared header: suite selector, Entity ID (Order ID), Add Suite button
- **Test Runner** – Run tests (Judge0), view pass/fail and expected vs received
- **Test Editor** – Monaco editor for calculator logic, Cursor AI (user-provided repo), Judge0 execution
- **Logic** – Markdown preview of LOGIC.md per suite

### Quick start (Arkhitect app)

1. **PostgreSQL** – Create a database and set `DATABASE_URL` in `.env`
2. **Install and migrate**

   ```bash
   npm install
   cd server && npm install && npm run db:migrate && npm run db:seed
   ```

3. **Run**

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173 (Vite)
   - Backend: http://localhost:3000

   Or build and serve:

   ```bash
   npm run build && npm start
   ```

4. **Configure** – Open Setup tab, add Bubble API base URL and token, save
5. **Run tests** – Validator → Test Runner → select “Order Validation”, enter order ID, click Run Test

See `ARCHITECTURE.md` for full design and API details.

---

## Legacy Files

- `orderCalculator.js` – Reference for Order Validation logic (inlined in seed template)
- `bubbleClient.js` – Reference for Bubble API usage (injected helpers use fetch)
- `testConfig.js` – Legacy; config now comes from Setup tab
