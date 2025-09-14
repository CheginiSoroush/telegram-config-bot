// ===== FILE: src/index.ts =====

/**
 * Interface for environment variables.
 */
export interface Env {
	BOT_TOKEN: string;
	ADMIN_ID: string;
	REQUIRED_CHANNEL_ID: string;
}

// Telegram API helper functions
// We've moved them into a separate object for better organization.
const TelegramAPI = {
	/**
	 * Sends a message to a specific chat.
	 */
	async sendMessage(token: string, chatId: number, text: string, keyboard?: any): Promise<Response> {
		const url = `https://api.telegram.org/bot${token}/sendMessage`;
		const payload = {
			chat_id: chatId,
			text: text,
			parse_mode: 'Markdown',
			reply_markup: keyboard,
		};
		return fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
	},

	/**
	 * Checks if a user is a member of a specific channel.
	 */
	async getChatMember(token: string, channelId: string, userId: number): Promise<any> {
		const url = `https://api.telegram.org/bot${token}/getChatMember`;
		const payload = {
			chat_id: channelId,
			user_id: userId,
		};
		const response = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		return response.json();
	},
};

/**
 * The main fetch handler for the Cloudflare Worker.
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === 'POST') {
			const update: any = await request.json();

			if (update.message) {
				const message = update.message;
				const chatId = message.chat.id;
				const userId = message.from.id;

				// Check user's membership status in the required channel
				try {
					const memberStatus = await TelegramAPI.getChatMember(env.BOT_TOKEN, env.REQUIRED_CHANNEL_ID, userId);
					const isMember = ['member', 'administrator', 'creator'].includes(memberStatus.result.status);

					if (!isMember) {
						// User is not a member, send the join request message.
						const channelUsername = env.REQUIRED_CHANNEL_ID.startsWith('@') ? env.REQUIRED_CHANNEL_ID.substring(1) : '';
						const joinMessage = `👋 برای استفاده از امکانات ربات، لطفاً ابتدا در کانال ما عضو شوید و سپس دکمه "بررسی مجدد" را بزنید.`;
						const joinKeyboard = {
							inline_keyboard: [
								[{ text: '✅ عضویت در کانال', url: `https://t.me/${channelUsername}` }],
								[{ text: '🔄 بررسی مجدد عضویت', callback_data: 'check_join' }],
							],
						};
						await TelegramAPI.sendMessage(env.BOT_TOKEN, chatId, joinMessage, joinKeyboard);
					} else {
						// User is a member, show the main menu.
						// TODO: Implement the main menu logic here.
						await TelegramAPI.sendMessage(env.BOT_TOKEN, chatId, '🎉 خوش آمدید! شما عضو کانال هستید.\n\nبزودی منوی اصلی در اینجا نمایش داده خواهد شد.');
					}
				} catch (error: any) {
					console.error('Error checking membership:', error);
					await TelegramAPI.sendMessage(env.BOT_TOKEN, chatId, 'خطایی در بررسی عضویت رخ داد. لطفاً لحظاتی دیگر دوباره تلاش کنید.');
				}

			} else if (update.callback_query) {
				// Handle the "Check Join" button click
				const callbackQuery = update.callback_query;
				if (callbackQuery.data === 'check_join') {
					// Re-run the logic from the start command by simulating a message
					const fakeMessage = {
						...callbackQuery.message,
						from: callbackQuery.from,
					};
					const fakeUpdate = { message: fakeMessage };
					// By calling the handler again with a constructed update, we avoid duplicating code.
					return this.fetch(new Request(request.url, { method: 'POST', body: JSON.stringify(fakeUpdate) }), env, ctx);
				}
			}
		}
		return new Response('OK'); // Always respond with OK to Telegram
	},
};
