FROM alpine:latest

RUN apk add --update nodejs
COPY . /src
RUN cd /src; npm install

CMD ["node","/src/ping_rcv.js"]
