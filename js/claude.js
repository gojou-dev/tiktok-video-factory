/**
 * TM.Claude — Claude API クライアント（任意機能）
 * APIキーがあればClaude生成、無ければテンプレート生成に自動フォールバックする二刀流。
 * キーはlocalStorageにのみ保存され、外部送信はAnthropic APIへのリクエストのみ。
 */
window.TM = window.TM || {};

TM.Claude = (() => {
	const KEY_STORAGE = 'tm_api_key';
	const MODEL = 'claude-sonnet-5';

	function setKey(key) {
		try {
			if (key) localStorage.setItem(KEY_STORAGE, key);
			else localStorage.removeItem(KEY_STORAGE);
		} catch { /* private mode */ }
	}
	function getKey() {
		try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
	}
	function available() { return !!getKey(); }

	async function complete(prompt) {
		const key = getKey();
		if (!key) throw new Error('APIキーが未設定です');
		const res = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-api-key': key,
				'anthropic-version': '2023-06-01',
				'anthropic-dangerous-direct-browser-access': 'true',
			},
			body: JSON.stringify({
				model: MODEL,
				max_tokens: 2048,
				messages: [{ role: 'user', content: prompt }],
			}),
		});
		if (!res.ok) {
			const err = await res.text();
			throw new Error(`Claude API エラー (${res.status}): ${err.slice(0, 200)}`);
		}
		const data = await res.json();
		return data.content.map((c) => c.text || '').join('');
	}

	// Claude生成（失敗時はテンプレート生成にフォールバック）
	async function generate(product, opts = {}) {
		if (!available()) return { script: TM.Gen.generate(product, opts), source: 'template' };
		try {
			const prompt = TM.Prompt.build(product, opts);
			const text = await complete(prompt);
			return { script: TM.Prompt.parseResponse(text, product, opts), source: 'claude' };
		} catch (e) {
			console.warn('Claude生成に失敗。テンプレートにフォールバック:', e);
			return { script: TM.Gen.generate(product, opts), source: 'template', error: e.message };
		}
	}

	return { setKey, getKey, available, complete, generate, MODEL };
})();
