# https://github.com/firebase/firebase-tools/issues/5614#issuecomment-1508515106

# Trying to replicate the exact cloud functions execution environment
# See https://cloud.google.com/functions/docs/concepts/execution-environment
ARG UBUNTU_VERSION=22.04
# Node 18.16 has an issue that errors on emulator start up
ARG NODE_VERSION=18.15.0
ARG JAVA_VERSION=18

FROM ubuntu:$UBUNTU_VERSION as emulators
ARG NODE_VERSION
ARG JAVA_VERSION

RUN apt-get update

ENV HOME=/home/node
ENV NVM_DIR=/usr/local/nvm
ENV NODE_PATH=$NVM_DIR/versions/node/v$NODE_VERSION/bin
ENV PATH=$NODE_PATH:$PATH

# We can install system packages that are available on cloud functions VMs
# Full list of pre-installed packages: https://cloud.google.com/functions/docs/reference/system-packages
RUN apt-get install -y \
    curl \
    openjdk-${JAVA_VERSION}-jre-headless # java is not preinstalled on cloud functions, but is needed to run emulators

# Install nvm, Node
RUN mkdir $NVM_DIR && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash && \
    bash $NVM_DIR/nvm.sh ${NODE_VERSION}

# Install firebase-tools and emulators \
RUN npm i -g firebase-tools && \
    firebase setup:emulators:database && \
    firebase setup:emulators:firestore && \
    firebase setup:emulators:pubsub && \
    firebase setup:emulators:storage && \
    firebase setup:emulators:ui

# Preserve firebase emulators cache
VOLUME $HOME/.cache

# Create a user 'node' make him an owner of $HOME
RUN groupadd --gid 1000 node && \
    useradd --uid 1000 --gid node --shell /bin/bash --create-home node && \
    chown -R node:node $HOME

WORKDIR $HOME
USER node
EXPOSE 4000
EXPOSE 5002
EXPOSE 5001
EXPOSE 8080
EXPOSE 8085
EXPOSE 9000
EXPOSE 9005
EXPOSE 9099
EXPOSE 9199
EXPOSE 9299

# CheckMate specific code 

USER root

WORKDIR /app/functions

COPY ./functions/package.json ./package.json

RUN npm install

WORKDIR /app

COPY . .

WORKDIR /app/functions

COPY functions/.env.local.test .env.local
COPY functions/.secret.local.test .secret.local

RUN npm run test

RUN npm run build

CMD npm run serve