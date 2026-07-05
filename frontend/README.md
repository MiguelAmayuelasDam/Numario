# Frontend — FinPer

Aplicación **React 19 + TypeScript** con **Vite**, **Tailwind CSS v4** y
**shadcn/ui**. Tests con **Vitest** + Testing Library.

## Estructura

```
src/
├── main.tsx                  # punto de entrada
├── App.tsx                   # landing que consulta el /health del backend
├── index.css                 # Tailwind v4 + tokens de shadcn
├── lib/utils.ts              # helper cn()
└── components/ui/button.tsx  # componente shadcn (prueba del setup)
```

## Desarrollo local (sin Docker)

Requiere Node 22+.

```bash
npm install
cp .env.example .env     # VITE_API_URL apunta al backend
npm run dev              # http://localhost:5173
```

## Scripts

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run test        # Vitest
npm run build       # build de producción
```

## Con Docker

Desde la raíz del repo: `docker compose up --build`.
