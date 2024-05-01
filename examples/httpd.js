#! /usr/bin/env node
/**
 * @file     httpd.js
 *           Sample web server that uses mux-net. My machine has entries in /etc/hosts for localhost
 *           to make it listen on both ipv6 (::1) and ipv4 (127.0.0.1). Trying any URL on this server
 #           causes it to send a web page which reports the underlying Server's network address.
 #
 * @author   Wes Garland, wes@distributive.network
 * @date     May 2024
 */
require('../mux-net').hook();
const http = require('node:http');

const server = http.createServer((req, res) => {
  res.end(`You connected on ${res.socket._server._connectionKey}\n`);
});

server.on('clientError', (err, socket) => {
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
server.listen({host: 'localhost', port: 8000});
