FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    dumb-init \
    g++ \
    gcc \
    python3 \
    default-jdk \
    && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 8000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

CMD ["npm", "start"]