# Alpine linux ffmpeg doesn't support drawtext command
FROM jrottenberg/ffmpeg:4.1-ubuntu
RUN apt-get install -y curl && curl -sL https://deb.nodesource.com/setup_12.x | bash - && apt-get remove -y curl
RUN apt-get install -y nodejs
ADD package.json package-lock.json tsconfig.json ./
ADD src ./src
ADD fonts ./fonts
RUN npm install -g typescript && npm i && tsc && npm uninstall -g typescript && npm prune --production
ENTRYPOINT [ "node", "dist/index.js" ]