import 'dotenv/config';
import { createBot } from '../../src/bot/telegram.js';
import serverless from 'serverless-http';

const bot = createBot();

const handler = async (event, context) => {
    if (!bot) {
        return {
            statusCode: 503,
            body: JSON.stringify({ error: 'Bot not configured' }),
        };
    }

    try {
        // Handle Telegram webhook
        if (event.httpMethod === 'POST') {
            const update = JSON.parse(event.body);

            await bot.handleUpdate(update);

            return {
                statusCode: 200,
                body: JSON.stringify({ ok: true }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Bot webhook endpoint' }),
        };
    } catch (error) {
        console.error('Bot webhook error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};

export { handler };
