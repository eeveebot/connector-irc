FROM docker.io/node:24-alpine3.22

COPY --chown=node:node ./package.json /eevee/package.json
COPY --chown=node:node ./package-lock.json /eevee/package-lock.json

WORKDIR /eevee

RUN set -exu \
  && npm install --include=prod

COPY --chown=node:node ./src/ /eevee/src

ENV NODE_ENV=production

CMD ["node", "src/main.mjs"]
