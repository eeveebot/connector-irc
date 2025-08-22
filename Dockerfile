FROM docker.io/node:24-alpine3.22

USER root

COPY --chown=node:node ./src/ /eevee/

USER node

CMD ["/eevee/main.mjs"]
