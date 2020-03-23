# microMTA (µMTA)

Mail Transfer Agent (MTA) library for node.js.

## Example

```js
const mta = new microMTA();
mta.on('message', message => console.log(message));
mta.start();
```