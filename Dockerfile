FROM node:18-alpine
RUN apk update && apk add g++ make py3-pip

# Setup
ENV NODE_ENV production
ENV HEALTHCHECK_PORT 7546

EXPOSE 7546
EXPOSE 8546
EXPOSE 8547

HEALTHCHECK --interval=10s --retries=3 --start-period=25s --timeout=2s CMD wget -q -O- http://localhost:${HEALTHCHECK_PORT}/health/liveness
WORKDIR /home/node/app/
RUN chown -R node:node .
COPY --chown=node:node . ./
USER node

# Build
RUN npm ci --only=production && npm cache clean --force --loglevel=error
RUN npm run setup
RUN npm install pnpm
RUN npm run build

# Run
ENTRYPOINT ["npm", "run"]
CMD ["start"]