const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const amqp = require('amqplib');
const { test } = require('node:test');

const rabbitUrl = process.env.RABBITMQ_URL;

function withTimeout(promise, description, milliseconds = 5000) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timeout aguardando ${description}`)), milliseconds);
        })
    ]).finally(() => clearTimeout(timer));
}

test('coordena consumidores concorrentes, ack e reentrega em uma fila RabbitMQ real', {
    skip: !rabbitUrl && 'Defina RABBITMQ_URL para executar o teste de integração'
}, async (t) => {
    const connection = await amqp.connect(rabbitUrl);
    const queueName = `notifications.message-created.v1.test-${randomUUID()}`;
    const adminChannel = await connection.createChannel();

    t.after(async () => {
        await adminChannel.deleteQueue(queueName);
        await connection.close();
    });

    await adminChannel.assertQueue(queueName, { durable: true });

    const publisher = await connection.createConfirmChannel();
    const firstConsumer = await connection.createChannel();
    const secondConsumer = await connection.createChannel();
    await firstConsumer.prefetch(1);
    await secondConsumer.prefetch(1);

    const deliveries = [];
    let resolveCompetingDeliveries;
    const competingDeliveries = new Promise((resolve) => {
        resolveCompetingDeliveries = resolve;
    });
    const collect = (consumer) => (message) => {
        if (!message) return;
        deliveries.push({ consumer, message });
        if (deliveries.length === 2) resolveCompetingDeliveries();
    };

    await firstConsumer.consume(queueName, collect('first'), { noAck: false });
    await secondConsumer.consume(queueName, collect('second'), { noAck: false });

    for (const id of ['message-1', 'message-2']) {
        publisher.sendToQueue(queueName, Buffer.from(JSON.stringify({ id })), {
            persistent: true,
            contentType: 'application/json'
        });
    }
    await publisher.waitForConfirms();
    await withTimeout(competingDeliveries, 'a entrega aos dois consumidores');

    assert.deepEqual(
        deliveries.map(({ consumer }) => consumer).sort(),
        ['first', 'second'],
        'RabbitMQ deve distribuir as mensagens entre consumidores com prefetch 1'
    );
    const deliveredIds = deliveries.map(({ message }) => {
        assert.equal(message.fields.redelivered, false);
        return JSON.parse(message.content.toString()).id;
    }).sort();
    assert.deepEqual(deliveredIds, ['message-1', 'message-2']);

    deliveries.forEach(({ consumer, message }) => {
        (consumer === 'first' ? firstConsumer : secondConsumer).ack(message);
    });

    await firstConsumer.close();
    await secondConsumer.close();

    const interruptedConsumer = await connection.createChannel();
    let resolveFirstDelivery;
    const firstDelivery = new Promise((resolve) => {
        resolveFirstDelivery = resolve;
    });
    await interruptedConsumer.consume(queueName, resolveFirstDelivery, { noAck: false });
    publisher.sendToQueue(queueName, Buffer.from(JSON.stringify({ id: 'redeliver-me' })), {
        persistent: true,
        contentType: 'application/json'
    });
    await publisher.waitForConfirms();
    const unacknowledged = await withTimeout(firstDelivery, 'a mensagem antes da interrupção');
    assert.equal(unacknowledged.fields.redelivered, false);
    await interruptedConsumer.close();

    const recoveryConsumer = await connection.createChannel();
    let resolveRedelivery;
    const redelivery = new Promise((resolve) => {
        resolveRedelivery = resolve;
    });
    await recoveryConsumer.consume(queueName, resolveRedelivery, { noAck: false });
    const recoveredMessage = await withTimeout(redelivery, 'a reentrega após fechar o canal');

    assert.equal(recoveredMessage.fields.redelivered, true);
    assert.deepEqual(JSON.parse(recoveredMessage.content.toString()), { id: 'redeliver-me' });
    recoveryConsumer.ack(recoveredMessage);

    await publisher.close();
    await recoveryConsumer.close();
});
