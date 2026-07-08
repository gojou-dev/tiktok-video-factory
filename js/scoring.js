/**
 * TM.Score — バズり予測スコアリング(#5) + Hook/CTA一貫性チェック(#3) + 商品忠実度検査
 * ルーブリック方式で0-100点。フィードバックループ(#14)の実績重みで補正。
 */
window.TM = window.TM || {};

TM.Score = (() => {
	const READ_SPEED = 8; // 日本語の画面テキスト読了速度(文字/秒)
	const STOPWORDS = new Set(['これ', 'それ', 'あれ', 'ため', 'こと', 'もの', 'よう', 'さん', 'たち', 'とき']);

	function keywords(text) {
		// 形態素解析なしの簡易抽出: 2文字以上の連続した漢字/カタカナ/英数字
		const m = text.match(/[一-龠々]{2,}|[ァ-ヴー]{2,}|[A-Za-z0-9]{2,}/g) || [];
		return [...new Set(m.filter((w) => !STOPWORDS.has(w)))];
	}

	// ---- #3: Hook + CTA 一貫性チェック ----
	function consistencyCheck(script) {
		const issues = [];
		const hookKw = keywords(script.hook.text);
		const tail = script.cta + ' ' + (script.scenes[script.scenes.length - 1]?.text || '');
		const overlap = hookKw.filter((k) => tail.includes(k));

		// フックで宣言した「◯つ」が本編で回収されているか
		const numMatch = script.hook.text.match(/([0-9０-９一二三四五])\s*つ/);
		if (numMatch) {
			const n = '０１２３４５'.indexOf(numMatch[1]) > 0
				? '０１２３４５'.indexOf(numMatch[1])
				: '〇一二三四五'.indexOf(numMatch[1]) > 0
					? '〇一二三四五'.indexOf(numMatch[1])
					: parseInt(numMatch[1], 10);
			const points = script.scenes.filter((s) => /^point/.test(s.role)).length;
			if (points && points !== n) {
				issues.push(`フックで「${n}つ」と宣言しているが本編は${points}ポイント`);
			}
		}
		// 疑問形フックは回収表現が必要
		if (/[？?]$/.test(script.hook.text) && !/答え|正解|確かめ|これ/.test(tail)) {
			issues.push('疑問形フックの答えがCTA/最終シーンで回収されていない');
		}
		const consistent = overlap.length > 0 || issues.length === 0;
		return { consistent, overlap, issues };
	}

	// ---- 商品データ忠実度（最重要）----
	// スクリプト中の数値・断定表現が商品データ由来かを検査する。
	function fidelityCheck(script) {
		const src = script.product.raw + script.product.name + script.product.price;
		const violations = [];
		const claimWords = ['No.1', 'ナンバーワン', '日本一', '世界一', '最安', '業界初', '必ず', '100%', '絶対に効く'];
		for (const s of [...script.scenes.map((x) => x.text), script.caption]) {
			for (const w of claimWords) {
				if (s.includes(w) && !src.includes(w)) violations.push(`根拠のない断定表現「${w}」`);
			}
			// 金額・パーセントは商品データに存在する数字のみ許可
			const nums = s.match(/[¥￥]?[\d,]+\s*(円|%|％)/g) || [];
			for (const n of nums) {
				const digits = n.replace(/[^\d]/g, '');
				if (digits && !src.replace(/[^\d]/g, '').includes(digits)) {
					violations.push(`商品データに無い数値「${n}」`);
				}
			}
		}
		return { faithful: violations.length === 0, violations: [...new Set(violations)] };
	}

	// ---- #5: バズり予測スコア ----
	function viralScore(script) {
		const b = {}; // breakdown
		const dur = TM.Gen.totalDuration(script);
		const weights = TM.Analysis.feedbackWeights();

		// フック強度 (20点): 3秒読了 + パワーパターン + 実績補正
		const hookLen = script.hook.text.length;
		const hookSec = hookLen / READ_SPEED;
		let hookScore = hookSec <= 3 ? 14 : hookSec <= 4 ? 8 : 2;
		if (/[？?]|POV|絶対|まだ|実は|本当は|前に/.test(script.hook.text)) hookScore += 4;
		hookScore = Math.min(20, Math.round(hookScore * (weights.hooks[script.hookType] || 1)));
		b.hook = { score: Math.min(hookScore, 20), max: 20, note: `フック${hookLen}文字 ≈ ${hookSec.toFixed(1)}秒` };

		// 構造準拠 (15点)
		const structure = TM.LIB.STRUCTURES.find((s) => s.id === script.structure);
		const rolesOk = structure ? structure.beats.every((bt, i) => script.scenes[i] && script.scenes[i].role === bt.role) : false;
		b.structure = { score: rolesOk ? 15 : 6, max: 15, note: rolesOk ? `${structure.label}準拠` : '構造が崩れている' };

		// ペーシング (10点): 平均シーン尺と総尺
		const avg = dur / script.scenes.length;
		let pace = 0;
		if (avg <= 6.5) pace += 5;
		if (dur >= 15 && dur <= 45) pace += 5;
		b.pacing = { score: pace, max: 10, note: `総尺${dur.toFixed(0)}秒 / 平均${avg.toFixed(1)}秒` };

		// UGCらしさ (10点)
		const allText = script.scenes.map((s) => s.text).join('');
		const casual = TM.LIB.UGC.fillers.concat(TM.LIB.UGC.casualEndings).filter((w) => allText.includes(w)).length;
		const hasAdWord = TM.LIB.UGC.adWords.some((w) => allText.includes(w));
		b.ugc = { score: Math.min(10, casual * 3 + (hasAdWord ? 0 : 4)), max: 10, note: hasAdWord ? '広告的な表現あり' : `話し言葉マーカー${casual}件` };

		// コメント誘発 (10点)
		b.commentBait = { score: script.commentBait?.text ? 10 : 0, max: 10, note: script.commentBait?.type || 'なし' };

		// Hook/CTA一貫性 (15点)
		const cons = consistencyCheck(script);
		b.consistency = { score: cons.consistent && !cons.issues.length ? 15 : cons.consistent ? 10 : 3, max: 15, note: cons.issues[0] || `共通キーワード: ${cons.overlap.join('、') || 'フック回収済み'}` };

		// 商品忠実度 (15点) — 違反は重罪
		const fid = fidelityCheck(script);
		b.fidelity = { score: fid.faithful ? 15 : 0, max: 15, note: fid.violations[0] || '商品データに忠実' };

		// シリーズ/トレンドボーナス (5点)
		let bonus = 0;
		if (script.seriesPart) bonus += 3;
		if (script.trendFormat) bonus += 2;
		b.bonus = { score: bonus, max: 5, note: script.seriesPart ? `シリーズPart${script.seriesPart.part}` : '単発' };

		const total = Object.values(b).reduce((sum, x) => sum + x.score, 0);
		return { total, breakdown: b, consistency: cons, fidelity: fid };
	}

	return { viralScore, consistencyCheck, fidelityCheck, keywords, READ_SPEED };
})();
