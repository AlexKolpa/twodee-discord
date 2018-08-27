FROM node:8.11.4
MAINTAINER alexkolpa

RUN mkdir /opt/twodee-discord
RUN mkdir /opt/twodee-discord/config

COPY node_modules /opt/twodee-discord/node_modules
COPY out /opt/twodee-discord/out
COPY config/default.json5 /opt/twodee-discord/config/

WORKDIR /opt/twodee-discord/

CMD ["node", "out/index.js"]