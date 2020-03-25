import { microMTA } from './';

const mta = new microMTA();
mta.on('message', message => console.log(message));
mta.start();
