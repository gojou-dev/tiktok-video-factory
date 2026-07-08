/**
 * TM.Gen — スクリプト生成エンジン
 * 商品データ解析 / テンプレート生成 / UGC変換(#6) / シリーズ生成(#9) /
 * 複数バリエーション生成(#10) / 参考スタイル適用(#15)
 */
window.TM = window.TM || {};

TM.Gen = (() => {
	const { HOOKS, STRUCTURES, CTAS, UGC, COMMENT_BAITS, HASHTAG_BASE } = TM.LIB;

	// ---- 商品ページテキスト → 構造化商品データ ----
	// 商品データ忠実度が最重要のため、入力に無い情報は一切生成しない。
	function parseProduct(raw) {
		const lines = raw.split(/\n+/).map((l) => l.trim()).filter(Boolean);
		const p = { raw, name: '', price: '', features: [], target: '', category: '', url: '' };

		for (const line of lines) {
			const kv = line.match(/^(商品名|名前|name)\s*[:：]\s*(.+)$/i);
			if (kv) { p.name = kv[2]; continue; }
			const pr = line.match(/^(価格|値段|price)\s*[:：]\s*(.+)$/i);
			if (pr) { p.price = pr[2]; continue; }
			const tg = line.match(/^(ターゲット|対象|target)\s*[:：]\s*(.+)$/i);
			if (tg) { p.target = tg[2]; continue; }
			const ca = line.match(/^(カテゴリ|ジャンル|category)\s*[:：]\s*(.+)$/i);
			if (ca) { p.category = ca[2]; continue; }
			const ur = line.match(/^(URL|リンク|url)\s*[:：]\s*(.+)$/i);
			if (ur) { p.url = ur[2]; continue; }
			if (/^[・\-*•]/.test(line)) { p.features.push(line.replace(/^[・\-*•]\s*/, '')); continue; }
		}

		// フォールバック: 明示ラベルが無い場合のヒューリスティック
		if (!p.name && lines.length) p.name = lines[0].slice(0, 40);
		if (!p.price) {
			const m = raw.match(/[¥￥][\d,]+|[\d,]+\s*円/);
			if (m) p.price = m[0];
		}
		if (!p.features.length) {
			p.features = lines.slice(1, 6).filter((l) => l.length >= 6 && l.length <= 60);
		}
		return p;
	}

	// ---- ビート役割ごとの本文生成（商品データのみ使用）----
	function beatText(role, p, hook, opts) {
		const f = (i) => p.features[i % Math.max(p.features.length, 1)] || '';
		switch (role) {
			case 'hook': return hook.text;
			case 'problem': return `${p.target || 'みんな'}が困ってるのって、結局「ちょうどいいのが見つからない」ことだよね`;
			case 'agitate': return 'で、妥協して選ぶと結局買い直しになる';
			case 'solution': return `そこで見つけたのが「${p.name}」${p.price ? `。${p.price}` : ''}`;
			case 'proof': return p.features.length ? `実際、${f(0)}${p.features[1] ? `。しかも${f(1)}` : ''}` : `詳細は商品ページに全部載ってる`;
			case 'point1': return f(0) ? `1つ目、${f(0)}` : '1つ目のポイント';
			case 'point2': return f(1) ? `2つ目、${f(1)}` : '2つ目のポイント';
			case 'point3': return f(2) ? `3つ目、${f(2)}` : `3つ目、${p.price ? `これで${p.price}` : 'このコスパ'}`;
			case 'setup': return `ちょっと前まで${p.category || 'この手のもの'}選びで完全に迷子だった`;
			case 'conflict': return 'レビュー見まくって比較して、それでも決めきれなくて';
			case 'before': return 'ビフォーの状態、正直ひどかった';
			case 'process': return `「${p.name}」を使い始めてから${f(0) ? `。${f(0)}` : ''}`;
			case 'after': return '今はこう。違いは見ての通り';
			case 'scene': return `${p.target || 'あなた'}のいつもの一日。でも今日は違う`;
			case 'turn': return `「${p.name}」がここで登場${f(0) ? `。${f(0)}` : ''}`;
			case 'echo': return opts.cta;
			default: return '';
		}
	}

	const EFFECT_BY_ROLE = {
		hook: 'pop', problem: 'zoom', agitate: 'shake', solution: 'flash',
		proof: 'zoom', echo: 'pop', point1: 'slide', point2: 'slide', point3: 'flash',
		setup: 'zoom', conflict: 'shake', before: 'none', process: 'zoom',
		after: 'flash', scene: 'zoom', turn: 'flash',
	};

	// ---- メイン生成 ----
	// opts: { hookId, structureId, mode: 'normal'|'ugc', styleProfile, seriesPart }
	function generate(p, opts = {}) {
		const hookDef = HOOKS.find((h) => h.id === opts.hookId) || HOOKS[0];
		const structure = STRUCTURES.find((s) => s.id === opts.structureId) || STRUCTURES[0];
		const hook = { type: hookDef.id, text: hookDef.build(p) };
		const cta = (CTAS[hookDef.id] || CTAS.question)(p);
		const bait = COMMENT_BAITS[Math.floor(Math.random() * COMMENT_BAITS.length)];

		let t = 0;
		const scenes = structure.beats.map((b) => {
			const text = beatText(b.role, p, hook, { cta });
			const scene = { t: [t, t + b.dur], role: b.role, text, effect: EFFECT_BY_ROLE[b.role] || 'none' };
			t += b.dur;
			return scene;
		});

		let script = {
			id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
			createdAt: new Date().toISOString(),
			mode: opts.mode || 'normal',
			structure: structure.id,
			hookType: hookDef.id,
			hook,
			scenes,
			cta,
			commentBait: { type: bait.id, text: bait.build(p) },
			caption: buildCaption(p, hook),
			hashtags: buildHashtags(p),
			product: p,
			seriesPart: opts.seriesPart || null,
		};

		if (script.mode === 'ugc') script = ugcTransform(script);
		if (opts.styleProfile) script = applyStyleProfile(script, opts.styleProfile);
		return script;
	}

	function buildCaption(p, hook) {
		return `${hook.text} 答えは動画で🎬 #${(p.category || 'レビュー').replace(/\s/g, '')}`;
	}

	function buildHashtags(p) {
		const tags = [...HASHTAG_BASE];
		if (p.category) tags.unshift(`#${p.category.replace(/\s/g, '')}`);
		if (p.name && p.name.length <= 15) tags.unshift(`#${p.name.replace(/\s/g, '')}`);
		return tags.slice(0, 5);
	}

	// ---- #6: UGC変換 — 広告臭を消し、話し言葉に崩す ----
	function ugcTransform(script) {
		const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
		const scenes = script.scenes.map((s, i) => {
			let text = s.text;
			// 広告的な言い回しを除去
			for (const w of TM.LIB.UGC.adWords) text = text.split(w).join('');
			// 冒頭以外のシーンにランダムでフィラーを注入（全部には入れない=自然さ）
			if (i > 0 && i < script.scenes.length - 1 && Math.random() < 0.5) {
				text = `${pick(UGC.fillers)}${text}`;
			}
			// 1シーンだけ「不完全さ」マーカー
			if (i === Math.floor(script.scenes.length / 2)) {
				text = `${text}${pick(UGC.imperfections)}`;
			}
			return { ...s, text };
		});
		return { ...script, scenes, ugc: true };
	}

	// ---- #9: シリーズ動画生成 (Part 1/2/3) ----
	// Part1: 問題提起+クリフハンガー / Part2: 深掘り / Part3: 結果+完結
	function generateSeries(p, opts = {}) {
		const cliffhangers = [
			'で、ここからが本題なんだけど…続きはPart2で',
			'一番大事なこと、まだ言ってない。Part3で全部話す',
		];
		return [1, 2, 3].map((part) => {
			const s = generate(p, {
				...opts,
				structureId: part === 1 ? 'problem-solution-echo' : part === 2 ? 'listicle' : 'beforeafter',
				seriesPart: { part, total: 3 },
			});
			s.hook.text = part === 1 ? s.hook.text : `【Part${part}】${s.hook.text}`.slice(0, 24);
			s.scenes[0].text = s.hook.text;
			if (part < 3) {
				const last = s.scenes[s.scenes.length - 1];
				last.text = cliffhangers[part - 1];
				s.cliffhanger = cliffhangers[part - 1];
			}
			s.caption = `${s.caption} (Part${part}/3)`;
			return s;
		});
	}

	// ---- #10: 複数バリエーション一括生成 + A/B支援 ----
	function generateVariations(p, opts = {}, count = 4) {
		const weights = TM.Analysis.feedbackWeights();
		// フィードバック実績(#14)で並べたフックタイプ順に生成
		const ranked = [...HOOKS].sort((a, b) => (weights.hooks[b.id] || 1) - (weights.hooks[a.id] || 1));
		return ranked.slice(0, count).map((h) => generate(p, { ...opts, hookId: h.id }));
	}

	// ---- #15: 参考スタイルプロファイル適用 ----
	function applyStyleProfile(script, profile) {
		const scenes = script.scenes.map((s) => {
			let text = s.text;
			if (profile.tone === 'excited' && !/[!！]$/.test(text) && s.role !== 'hook') text += '！';
			if (profile.avgSceneSec) {
				// 参考動画のテンポに寄せてシーン尺を再配分
				const scale = profile.avgSceneSec / ((s.t[1] - s.t[0]) || 1);
				const clamped = Math.min(Math.max(scale, 0.7), 1.3);
				s = { ...s, t: [s.t[0], s.t[0] + (s.t[1] - s.t[0]) * clamped] };
			}
			return { ...s, text };
		});
		// 尺の再配分後にタイムラインを詰め直す
		let t = 0;
		for (const s of scenes) {
			const dur = s.t[1] - s.t[0];
			s.t = [t, t + dur];
			t += dur;
		}
		return { ...script, scenes, styleProfile: profile.name || 'custom' };
	}

	function totalDuration(script) {
		return script.scenes.length ? script.scenes[script.scenes.length - 1].t[1] : 0;
	}

	return { parseProduct, generate, generateSeries, generateVariations, ugcTransform, applyStyleProfile, totalDuration };
})();
