FROM docker.io/node:24-alpine3.22

COPY --chown=node:node ./package.json /eevee/package.json
COPY --chown=node:node ./package-lock.json /eevee/package-lock.json

WORKDIR /eevee

RUN --mount=type=secret,id=GITHUB_TOKEN,env=GITHUB_TOKEN \
  set -exu \
  && echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" | tee -a $HOME/.npmrc \
  && echo "@eeveebot:registry=https://npm.pkg.github.com/" | tee -a $HOME/.npmrc \
  && npm install --include=prod \
  && rm $HOME/.npmrc

COPY --chown=node:node ./src/ /eevee/src

ENV NODE_ENV=production

CMD ["node", "src/main.mjs"]
