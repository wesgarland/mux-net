*Usage:*
- In your code, replace `require('net')` with `require('mux-net')`
- Listen on a hostname (like localhost) which can resolve to more than one address
- Make sure your code doesn't get mad if the listen callback fires more than once
