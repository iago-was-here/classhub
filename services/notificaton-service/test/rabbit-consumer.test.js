const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { QUEUE_NAME, startRabbitConsumer } = require('../src/rabbit-consumer');

function createFakeBroker() {
    let deliver;
    let markReady;
    const ready = new Promise((resolve) => {
        markReady = resolve;
    });
    const acknowledgements = [];
    const requeues = [];
    const channel = new EventEmitter();
    channel.assertQueue = async (name, options) => {
        assert.equal(name, QUEUE_NAME);
        assert.deepEqual(options, { durable: true });
    };
    channel.prefetch = async (count) => assert.equal(count, 100);
    channel.consume = async (name, handler, options) => {
        assert.equal(name, QUEUE_NAME);
        assert.deepEqual(options, { noAck: false });
        deliver = handler;
        markReady();
    };
    channel.ack = (message) => acknowledgements.push(message);
    channel.nack = (message, allUpTo, requeue) => requeues.push({ message, allUpTo, requeue });
    channel.close = async () => channel.emit('close');

    const connection = new EventEmitter();
    connection.createChannel = async () => channel;
    connection.close = async () => connection.emit('close');

    return {
        ready,
        acknowledgements,
        requeues,
        deliver: (...args) => deliver(...args),
        connect: async () => connection
    };
}

function message(content) {
    return { content: Buffer.from(JSON.stringify(content)) };
}

test('acks a valid message event after delivery succeeds', async () => {
    const broker = createFakeBroker();
    const received = [];
    const stop = startRabbitConsumer({
        url: 'amqp://test',
        connect: broker.connect,
        onEvent: async (event) => received.push(event),
        onConnectionChange: () => {}
    });
    await broker.ready;

    const event = {
        eventId: 'event-1',
        type: 'message.created',
        data: { id: 'message-1', authorId: 'user-1', text: 'Olá' }
    };
    const incoming = message(event);
    await broker.deliver(incoming);

    assert.deepEqual(received, [event]);
    assert.deepEqual(broker.acknowledgements, [incoming]);
    await stop();
});

test('discards malformed events and requeues delivery failures', async () => {
    const broker = createFakeBroker();
    const stop = startRabbitConsumer({
        url: 'amqp://test',
        connect: broker.connect,
        onEvent: async () => { throw new Error('temporary failure'); }
    });
    await broker.ready;

    const invalid = { content: Buffer.from('{invalid') };
    await broker.deliver(invalid);
    assert.deepEqual(broker.acknowledgements, [invalid]);

    const valid = message({
        eventId: 'event-2',
        type: 'message.created',
        data: { id: 'message-2', authorId: 'user-1', text: 'Olá' }
    });
    await broker.deliver(valid);
    assert.deepEqual(broker.requeues, [{ message: valid, allUpTo: false, requeue: true }]);
    await stop();
});