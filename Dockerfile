FROM docker.io/node:24-alpine3.22

USER root

COPY --chown=node:node ./package.json /eevee/package.json
COPY --chown=node:node ./package-lock.json /eevee/package-lock.json
COPY --chown=node:node ./src/ /eevee/src

USER node

WORKDIR /eevee

RUN set -exu \
  && npm install --include=prod

ENV NODE_ENV=production

CMD ["node", "src/main.mjs"]
