/**
 * @file        mux-net.js - a plug-in replacement for Node's net module, that can create Servers that
 *              listens on multiple addresses at once, including potentially both IPv4 and IPv6 
 *              addresses corresponding to the same name at once.
 *
 *              This works by firing the listening event handlers (aka the createServer callback) more
 *              often than standard Server class - once per listen address. API code that creates a
 *              server and registers connection callbacks in the listen callback should require no
 *              changes to get the enhanced functionality.
 *
 *              Events on the Server class are also virtualized, so that an event firing on any instance
 *              of net::Server also fires on this Server.
 *
 * @author      Wes Garland, wes@distributive.network
 * @date        April 2024
 */
'use strict';

const nodeNet = require('node:net');
const { EventEmitter } = require('node:events');

const $asyncDispose = Symbol.asyncDispose || new Symbol('asyncDispose' /* dummy for old node */);
Object.assign(exports, nodeNet);

/* API */
exports.Server = class Server extends EventEmitter
{
  #maxConnections;
  
  constructor()
  {
    this._servers = [];
  }

  listen()
  {
    var handle, options, callback;

    if (this.listening)
      throwError('Server is already listening', 'ERR_SERVER_ALREADY_LISTEN');

    if (typeof arguments[0] === 'object') /* form 1 or 2 */
    {
      if (arguments[0].fd >= 0 || arguments[0]._handle) /* form 1 */
      {
        handle = arguments[0];
        options = {};
        
        if (typeof arguments[1] !== 'number')
          callback = arguments[1];
        {
          options.backlog  = arguments[1];
          if (arguments[2])
            callback = arguments[2];
        }
      }
      else /* form 2 */
      {
        options = arguments[0];
        callback = arguments[1];
      }
    }
    else /* form 3 or 4 */
    {
      options = {};
      
      if (typeof arguments[0] === 'string') /* form 3 */
      {
        options.path = arguments[0];
        if (typeof arguments[1] === 'number')
          options.backlog = arguments[1];
        if ((typeof arguments[1] !== 'number') || arguments.length > 2)
          callback = arguments[arguments.length - 1 ];
      }
      else /* form 4 */
      {
        const props = ['port', 'host', 'backlog'];
        const argv = Array.from(arguments);
        while (props.length && argv.length)
        {
          if (typeof argv[0] === 'function')
            break;
          options[props.shift()] = argv.shift();
        }
        callback = argv[0];
      }
    }

    /* have handle, callback, options decoded from arguments */
    if (!options.host && !options.hosts)
      options.hosts = ['::']; /** @todo - use 0.0.0.0 when ipv6 not available */
    else
    {
      options.hosts = options.hosts || [];
      if (options.host)
        options.hosts.push(options.host);
    }

    if (!handle)
      this.#finishListen(options, callback);
    
    return this;
  }

  async #finishListen(options, callback)
  {
    console.log('finish listen CB is', callback);
    const ips = [];
    const timer = setInterval(()=>'dont care', 123456); /* ref*/
    
    for (let i = 0; i < options.hosts.length; i++)
    {
      const hostname = options.hosts[i];

      if (!hostname)
        throw new Error('missing hostname in hosts array');
      
      if (hostname.indexOf('::') !== -1 || hostname.match(/\.[0-9]+$/)) /* this is an IP number */
      {
        ips.push(hostname);
        continue;
      }

      /** @todo: handle /etc/hosts along with dns */
      const hostEnts = await require('dns' /* actually resolv */).promises.lookup(hostname, { all: true });
      ips.push(...hostEnts.map(hostEnt => hostEnt.address));
    }

    for (let i = 0; i < ips.length; i++)
    {
      const server = new nodeNet.Server(options);
      this._servers.push(server);
      server.on('listening', () => {
        this.listening = true;
      });
      for (let eventName of [ 'close', 'connection', 'error', 'listening', 'drop' ])
      {
        console.log('capture', eventName);
        server.on(eventName, (...argv) => {
          console.log('re-emit', eventName, argv[0]?.constructor.name, this);
          if (eventName === 'connection')
            debugger;
        });
        server.on(eventName, (...argv) => this.emit(eventName, ...argv));
      }
      server.listen(options, callback);
    }

    clearInterval(timer);
  }

  address()
  {
    return this.addresses()[0];
  }

  addresses()
  {
    return this._server.map(server => server.address());
  }

  close(callback)
  {
    var count = 0;
    function cbCount()
    {
      if (++count === this._servers.length)
        callback.apply(this);
    }
    
    this._servers.forEach(server => {
      server.close(cbCount);
    });
  }

  [$asyncDispose]()
  {
    return Promise.all(this._servers.map(server => server[$asyncDispose]()));
  }

  getConnections()
  {
    return [].concat(...this._servers.map(server => server.getConnections()));
  }

  /* Very crude - sets max connections per sub-server; most useful when setting to 0 */
  set maxConnections(value)
  {
    this._servers[0].forEach(server => server.maxConnections = value);
    this.#maxConnections = value;
  }
  get maxConnections()
  {
    return this.#maxConnections;
  }

  ref()
  {
    return this._servers[0].ref();
  }

  unref()
  {
    return this._servers[0].unref();
  }

  on(eventName, callback)
  {
    this._servers.forEach(server => server.on(eventName, callback));
  }
  get addListener()
  {
    return this.on;
  }
  
  off(eventName, callback)
  {
    this._servers.forEach(server => server.off(eventName, callback));
  }
  get removeListener()
  {
    return this.off;
  }
  
  /* API */
  createServer(options, connectionListener)
  {
    console.log('createServer', options);
    if (arguments.length === 0 || (arguments.length === 1 && typeof options === 'function'))
    {
      connectionListener = options;
      options = {};
    }
    /* have finished handling polymorphism; options object and connectionListener are now authoritative */

    const server = new Server(options);
    if (connectionListener)
      server.on('connection', connectionListener);

    return server;
  }
}

function throwError(message, code)
{
  const error = new Error(message);
  error.code = code;
  error.stack = error.stack.split('\n').slice(1).join('\n');

  throw error;
}
