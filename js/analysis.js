/**
 * TM.Analysis — 分析・予測・学習モジュール
 * コメント予測(#7) / トレンド推奨(#8) / ニッチ分析(#11) /
 * コメントインサイト抽出(#12) / パフォーマンスフィードバックループ(#14) /
 * 参考スタイル分析(#15)
 */
window.TM = window.TM || {};

TM.Analysis = (() => {
	const FEEDBACK_KEY = 'tm_feedback';

	// ---- #7: コメント予測エンジン ----
	// スクリプトから「付きやすいコメントの型」を予測し、固定コメント案まで出す。
	function predictComments(script) {
		const predictions = [];
		const text = script.scenes.map((s) => s.text).join(' ');

		if (script.hookType === 'contrarian' || /賛否|正直/.test(text)) {
			predictions.push({ type: '反論・議論', example: '「いや普通に◯◯の方が良くない？」', volume: '高', action: '反論には比較Part動画で返信（シリーズ化の起点）' });
		}
		if (/[？?]/.test(script.hook.text + (script.commentBait?.text || ''))) {
			predictions.push({ type: '質問・回答', example: '「答え何？」「◯◯ってこと？」', volume: '高', action: '固定コメントで半分だけ答えて本編誘導' });
		}
		if (script.mode === 'ugc' || /体験|使って|買った/.test(text)) {
			predictions.push({ type: '体験談共有', example: '「私も使ってるけど本当これ」', volume: '中', action: '体験談にはいいね+返信で信頼の輪を可視化' });
		}
		if (script.commentBait?.type === 'tag') {
			predictions.push({ type: 'タグ付け', example: '「@friend これじゃん」', volume: '中', action: 'タグ付けコメントは放置でOK（自走する）' });
		}
		if (script.product.price) {
			predictions.push({ type: '価格反応', example: `「${script.product.price}なら買うわ」`, volume: '中', action: '価格質問には即返信（購買直結）' });
		}

		const pinned = script.commentBait
			? `固定コメント案: 「${script.commentBait.text}」→ 最初の10件に必ず返信して初速を作る`
			: '固定コメント未設定';
		return { predictions, pinned };
	}

	// ---- #8: トレンドフォーマット推奨 ----
	// 内蔵フォーマット + ユーザーが追記した「今週のトレンド」から商品に合うものを推奨。
	function recommendTrends(product) {
		const custom = loadCustomTrends();
		const all = [...custom, ...TM.LIB.TREND_FORMATS];
		const hay = `${product.category} ${product.raw}`.toLowerCase();
		return all
			.map((t) => {
				const hits = (t.fit || []).filter((f) => hay.includes(f.toLowerCase())).length;
				return { ...t, match: hits + (t.custom ? 1 : 0) }; // 手動追記トレンドは鮮度加点
			})
			.sort((a, b) => b.match - a.match)
			.slice(0, 4);
	}
	function addCustomTrend(label, note) {
		const list = loadCustomTrends();
		list.unshift({ id: `custom_${Date.now()}`, label, note, fit: [], custom: true, addedAt: new Date().toISOString() });
		try { localStorage.setItem('tm_trends', JSON.stringify(list.slice(0, 20))); } catch { /* ignore */ }
		return list;
	}
	function loadCustomTrends() {
		try { return JSON.parse(localStorage.getItem('tm_trends') || '[]'); } catch { return []; }
	}

	// ---- #11: ニッチ分析エージェント ----
	// ニッチキーワードから攻め方の分析ブリーフを構造化して出す。
	function analyzeNiche(keyword, product) {
		const angles = [
			{ angle: '初心者の失敗回避', hook: 'warning', why: '検索意図が強く保存されやすい' },
			{ angle: '比較・ランキング', hook: 'contrarian', why: '議論コメントが伸びる' },
			{ angle: 'ビフォーアフター実証', hook: 'beforeafter', why: '信頼と完走率を両取り' },
			{ angle: '当事者あるある', hook: 'empathy', why: 'シェア・タグ付けが起きる' },
		];
		return {
			niche: keyword,
			positioning: `「${keyword}」ニッチで${product?.name || 'この商品'}は「${angles[0].angle}」から参入し、シリーズで${angles[1].angle}へ展開するのが定石`,
			angles,
			postingPlan: ['週3本 × 3週間で同一ニッチに集中投下', '1本バズったら48時間以内にPart2', 'コメント上位の疑問を次動画のフックに昇格'],
			checklist: ['同ニッチ上位10動画のフック型を記録したか', '競合が拾っていない不満コメントを見つけたか', 'ハッシュタグは大中小を混ぜたか'],
		};
	}

	// ---- #12: コメントインサイト自動抽出 ----
	// 投稿後のコメント欄を貼り付けると、頻出テーマ・質問・感情を抽出して次の動画案を出す。
	function extractInsights(commentsRaw) {
		const comments = commentsRaw.split(/\n+/).map((c) => c.trim()).filter(Boolean);
		const freq = {};
		for (const c of comments) {
			for (const w of TM.Score.keywords(c)) freq[w] = (freq[w] || 0) + 1;
		}
		const themes = Object.entries(freq).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
		const questions = comments.filter((c) => /[？?]|教えて|どこで|いくら|どうやって/.test(c)).slice(0, 10);
		const positive = comments.filter((c) => /良い|いい|欲しい|買|好き|神|すご/.test(c)).length;
		const negative = comments.filter((c) => /微妙|高い|嘘|怪しい|いらな|うーん/.test(c)).length;
		const nextIdeas = questions.slice(0, 3).map((q, i) => `Part${i + 2}案: コメント返信動画「${q.slice(0, 30)}」に答える`);
		if (themes[0]) nextIdeas.push(`頻出テーマ「${themes[0][0]}」を深掘りする単発動画`);
		return {
			total: comments.length,
			themes: themes.map(([word, count]) => ({ word, count })),
			questions,
			sentiment: { positive, negative, neutral: comments.length - positive - negative },
			nextIdeas,
		};
	}

	// ---- #14: パフォーマンスフィードバックループ ----
	// 実投稿の結果を記録 → フック型/構造ごとの実績重みを算出 → 生成とスコアに反映。
	function recordPerformance(entry) {
		const list = loadPerformance();
		list.unshift({ ...entry, recordedAt: new Date().toISOString() });
		try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(list.slice(0, 200))); } catch { /* ignore */ }
		return list;
	}
	function loadPerformance() {
		try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]'); } catch { return []; }
	}
	function feedbackWeights() {
		const list = loadPerformance();
		const agg = { hooks: {}, structures: {} };
		if (!list.length) return { hooks: {}, structures: {}, samples: 0 };
		const engagement = (e) => (Number(e.views) || 0) * 0.001 + (Number(e.likes) || 0) * 0.05 + (Number(e.comments) || 0) * 0.5;
		const byKey = (key) => {
			const groups = {};
			for (const e of list) {
				if (!e[key]) continue;
				(groups[e[key]] = groups[e[key]] || []).push(engagement(e));
			}
			const means = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));
			const overall = Object.values(means).reduce((a, b) => a + b, 0) / Math.max(Object.keys(means).length, 1) || 1;
			// 平均比 0.8〜1.2 に正規化（1件の外れ値で暴れないように）
			return Object.fromEntries(Object.entries(means).map(([k, v]) => [k, Math.min(Math.max(v / overall, 0.8), 1.2)]));
		};
		agg.hooks = byKey('hookType');
		agg.structures = byKey('structure');
		agg.samples = list.length;
		return agg;
	}

	// ---- #15: 参考スタイルの自動高度分析 ----
	// 参考動画のスクリプト/説明文を貼ると、トーン・テンポ・フック型をプロファイル化。
	function analyzeStyle(referenceText, name = '参考スタイル') {
		const lines = referenceText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
		const totalChars = lines.join('').length;
		const exclam = (referenceText.match(/[!！]/g) || []).length;
		const questions = (referenceText.match(/[?？]/g) || []).length;
		const casual = TM.LIB.UGC.fillers.filter((f) => referenceText.includes(f)).length;
		const estSec = totalChars / TM.Score.READ_SPEED;
		const profile = {
			name,
			tone: exclam >= 3 ? 'excited' : casual >= 2 ? 'casual' : 'calm',
			avgSceneSec: lines.length ? Math.min(Math.max(estSec / lines.length, 2), 8) : 4,
			hookStyle: questions > 0 ? 'question' : /POV/i.test(referenceText) ? 'pov' : /実は|本当/.test(referenceText) ? 'secret' : 'shock',
			estimatedDuration: Math.round(estSec),
			markers: { exclam, questions, casual, lines: lines.length },
		};
		return profile;
	}

	return {
		predictComments, recommendTrends, addCustomTrend, analyzeNiche, extractInsights,
		recordPerformance, loadPerformance, feedbackWeights, analyzeStyle,
	};
})();
