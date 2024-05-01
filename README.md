# Mux-net

Mux-net is a net module multiplexer for Node.js, making it transparent and easy to listen for inbound
TCP connections on multiple network interfaces.

## Usage
- Before loading any other modules, call `require('mux-net').hook()`
- Listen on a hostname (like `localhost` on some platforms) which can resolve to more than one address
- Make sure your code doesn't get mad if the listen callback fires more than once

### Theory of Operation
Modules building services on top of TCP should be using the Node.js `net` module to create servers. When
mux-net's hook() method is invoked, it replaces the Server export from that module with its own. When
other modules are loaded, they use these methods to create services, frequently inheriting from Server.

The Server class in mux-net has a listen method which invokes `listen()` one or more net::Server
instances, and the listen callback is invoked on each of these as they become ready. Similarly, other
events on the net::Server instances which fire are re-fired from the mux-net::Server instance.

The number of net::Server instances used by mux-net::Server is related to the number of IP addresses
that the host (or hosts) property of the options object resolves to. For example, if you system resolver
returns both `::1` and `127.0.0.1` when you lookup `localhost` and you ask your server to listen on
`localhost`, then the mux-net::Server will create two instances of net::Server, one for each address.

#### Http server example
```javascript
require('./mux-net').hook();
const http = require('node:http');

const server = http.createServer((req, res) => {
  res.end(`You connected on ${res.socket._server._connectionKey}\n`);
});

server.listen({host: 'localhost', port: 8000});
```

## Net Extensions

### hosts option
The Server constructor accepts an Array, `hosts`, which can specify multiple hostnames upon which to listen

### INADDR_ANY
The hosts option recognizes the following aliases for INADDR_ANY, all of which mean "listen on all addresses":
- any/0
- inaddr_any
- INADDR_ANY
- ::

Specifying the address `0.0.0.0` explicitly binds to all IPv4 interfaces but not to IPv6 interfaces.

## Release Notes
The initial release was April 30 2024.

## Author
Wes Garland, wes@distributive.network