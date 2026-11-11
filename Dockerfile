FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Migra la base y arranca (un solo proceso de aplicación, como en el C4). La primera organización se crea en /instalacion.
CMD ["sh", "-c", "npx tsx db/iniciar.ts && npx next start -p 3000"]
