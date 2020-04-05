<h1 align="center">
  <img src="https://raw.githubusercontent.com/mat-sz/micromta/master/logo.png" alt="microMTA" width="500">
</h1>

<h2 align="center">
microMTA / µMTA
</h2>

microMTA is a [Mail Transfer Agent (MTA)](https://en.wikipedia.org/wiki/Message_transfer_agent) library for node.js that focuses on receiving messages. The only feature of microMTA is message receiving. No sending or relaying will be possible since the library itself is not designed to handle that.

microMTA was created for testing e-mail sending in an application, by mocking a SMTP server. By default it runs on port 25 (which requires superuser privileges or an authbind/setcap setup).

The library is available in [npm](https://npmjs.org/package/micromta), use `yarn add micromta` or `npm install micromta` to install.

## Example

```js
const mta = new microMTA();
mta.on('message', message => console.log(message));
```

`message` will be of type _microMTAMessage_:

```ts
export interface microMTAMessage {
  recipients: string[];
  sender: string;
  message: string;
}
```

The `message` is a raw RFC 822 (and any related RFCs) message that needs to be parsed. [letterparser](https://github.com/mat-sz/letterparser) can be used to parse and extract data from the raw messages.

## Options

The constructor for `microMTA` accepts an options object.

| Property   | Default value | Description                                                               |
| ---------- | ------------- | ------------------------------------------------------------------------- |
| `ip`       | `0.0.0.0`     | IP address to bind to.                                                    |
| `port`     | `25`          | Port to bind to. (Ports under 1024 usually require superuser privileges.) |
| `hostname` | `localhost`   | Hostname advertised by the SMTP server.                                   |
| `size`     | `1000000`     | Maximum message size (in bytes).                                          |
