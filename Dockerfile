FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
# Migra, siembra los datos DEMO si la base está vacía y arranca (un solo proceso de aplicación, como en el C4).
CMD ["sh", "-c", "npx tsx db/iniciar.ts && npx next start -p 3000"]
