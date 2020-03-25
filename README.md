# microMTA (µMTA)

Mail Transfer Agent (MTA) library for node.js.

Only receiving mail is (and will be) supported. This library has only one purpose.

## Example

```js
const mta = new microMTA();
mta.on('message', message => console.log(message));
mta.start();
```
