# Cowboy Cafe (Next.js)

Marketing site with a chat widget that talks to the **Lobo Modal** inference endpoint (`LobotomyInference.generate`).

## Connect the chat to Modal

1. Deploy the backend (repo root):

   ```bash
   modal deploy ./backend/modal_app.py
   ```

2. Copy the **generate** URL (class `LobotomyInference` → `generate`).

3. In `cowboy_cafe`, create `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   Set:

   ```env
   MODAL_URL=https://…--lobotomy-backend-lobotomyinference-generate.modal.run
   ```

4. Run the app:

   ```bash
   pnpm install
   pnpm dev
   ```

The browser never calls Modal directly; `app/api/chat/route.ts` proxies server-side and streams the reply into the AI SDK UI.

**Note:** First request after idle can take ~30–60s (GPU cold start). `maxDuration` on the route is set to 300s.
