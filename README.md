# PLEBLAUNCH

# PLEBLAUNCH Backend

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   - Copy `.env.sample` to `.env` and fill in the required values.

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Check environment variables:**
   ```bash
   npm run check-env
   ```

## Project Structure

- `plebs-frontend/src/` — Main backend source code (Express, TypeScript)
- `plebs-frontend/src/routes/` — API route definitions
- `plebs-frontend/src/services/` — Service classes (e.g., WalletService, TelegramBotService)
- `plebs-frontend/src/config/` — Configuration and environment setup
- `plebs-frontend/src/middleware/` — Express middleware (auth, validation, error handling)

## Scripts
- `npm run dev` — Start the backend in development mode with auto-reload
- `npm run check-env` — Check for missing or empty environment variables

## Notes
- All backend code should be in TypeScript (`.ts` files)
- Use `.env.sample` as a template for your environment variables
- Remove or ignore deprecated folders like `/plebs/backend/` if not needed

---

For more details, see the code comments and each folder's README (if present).