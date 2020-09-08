FROM node:alpine
ADD package.json package-lock.json tsconfig.json ./
ADD src ./src
RUN npm install -g typescript && npm i && tsc && npm uninstall -g typescript && npm prune --production
ENTRYPOINT [ "node", "dist/index.js" ]