# Cannot use Node >12 due to bug affecting sharp library
FROM node:12-alpine
ADD package.json package-lock.json tsconfig.json ./
ADD resources ./resources
ADD src ./src
RUN npm install -g typescript && npm i && tsc && npm uninstall -g typescript && npm prune --production
ENV PORT 8080
ENTRYPOINT [ "node", "dist/index.js" ]