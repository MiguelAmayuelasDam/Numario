# Imagen de desarrollo: sirve el frontend con el dev server de Vite (HMR).
FROM node:22-alpine

WORKDIR /app

# Capa de dependencias (se cachea si no cambian package.json / lock).
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173
# --host expone el server fuera del contenedor.
CMD ["npm", "run", "dev", "--", "--host"]
