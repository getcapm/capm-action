FROM node:20
WORKDIR /usr/src/app
COPY dist ./dist
CMD [ "node", "/usr/src/app/dist/index.js" ]
