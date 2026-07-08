/**
 * TM.Critic — Critic Agent の自動化
 * PRDのCriticチェックリストを機械実行し、自動修正ループを回す。
 * 「3回連続で重大問題なし」をトラッキングして完成形判定を出す。
 */
window.TM = window.TM || {};

TM.Critic = (() => {
	const PASS_SCORE = 80; // KPI: バズり予測スコア80点以上
	const STREAK_KEY = 'tm_critic_streak';

	// ---- チェックリスト実行 ----
	function run(script) {
		const result = TM.Score.viralScore(script);
		const critical = [];
		const warnings = [];

		// 1. 商品データへの忠実度（最重要）
		if (!result.fidelity.faithful) {
			for (const v of result.fidelity.violations) critical.push(`[忠実度] ${v}`);
		}
		// 2. 3秒フック
		if (script.hook.text.length / TM.Score.READ_SPEED > 3) {
			critical.push(`[フック] ${script.hook.text.length}文字はフックとして長すぎる（24文字以内）`);
		}
		// 3. バイラル構造の使用
		if (result.breakdown.structure.score < 15) warnings.push('[構造] バイラル構造テンプレートから逸脱');
		// 4. UGCらしさ
		if (result.breakdown.ugc.score < 5) warnings.push('[UGC] 広告臭が強い。UGCモードでの再生成を推奨');
		// 5. コメント誘発要素
		if (!script.commentBait?.text) critical.push('[コメント] コメント誘発要素が無い');
		// 6. Hook/CTA一貫性
		for (const i of result.consistency.issues) critical.push(`[一貫性] ${i}`);
		// 7. CTA存在
		if (!script.cta) critical.push('[CTA] CTAが未設定');
		// 8. スコア80点以上
		if (result.total < PASS_SCORE) critical.push(`[スコア] ${result.total}点 < 合格ライン${PASS_SCORE}点`);
		// 9. シリーズ展開可能性
		if (!script.seriesPart) warnings.push('[シリーズ] 単発動画。シリーズ化でリーチ最大化の余地あり');

		const pass = critical.length === 0;
		return { pass, critical, warnings, score: result.total, scoreDetail: result };
	}

	// ---- 自動修正 ----
	function autofix(script, review) {
		let fixed = structuredClone(script);
		for (const issue of review.critical) {
			if (issue.startsWith('[フック]')) {
				fixed.hook.text = fixed.hook.text.slice(0, 22) + (fixed.hook.text.length > 22 ? '…' : '');
				fixed.scenes[0].text = fixed.hook.text;
			}
			if (issue.startsWith('[忠実度]')) {
				// 根拠のない数値・断定を該当シーンから除去する
				const claim = issue.match(/「(.+?)」/);
				if (claim) {
					fixed.scenes = fixed.scenes.map((s) => ({ ...s, text: s.text.split(claim[1]).join('') }));
					fixed.caption = fixed.caption.split(claim[1]).join('');
				}
			}
			if (issue.startsWith('[コメント]')) {
				const bait = TM.LIB.COMMENT_BAITS[0];
				fixed.commentBait = { type: bait.id, text: bait.build(fixed.product) };
			}
			if (issue.startsWith('[一貫性]')) {
				// フックのキーワードをCTAに埋め込んで回収する
				const kw = TM.Score.keywords(fixed.hook.text)[0];
				if (kw && !fixed.cta.includes(kw)) fixed.cta = `${kw}の答えはこれ。${fixed.cta}`;
				const last = fixed.scenes[fixed.scenes.length - 1];
				if (last) last.text = fixed.cta;
			}
			if (issue.startsWith('[UGC]') || issue.startsWith('[スコア]')) {
				fixed = TM.Gen.ugcTransform(fixed);
			}
		}
		return fixed;
	}

	// ---- 自動Criticループ: pass するまで最大 maxIter 回 修正→再審査 ----
	function loop(script, maxIter = 5) {
		const history = [];
		let current = script;
		for (let i = 0; i < maxIter; i++) {
			const review = run(current);
			history.push({ iteration: i + 1, score: review.score, critical: review.critical, warnings: review.warnings });
			if (review.pass) {
				bumpStreak(true);
				return { script: current, review, history, iterations: i + 1 };
			}
			current = autofix(current, review);
		}
		const finalReview = run(current);
		bumpStreak(finalReview.pass);
		history.push({ iteration: maxIter + 1, score: finalReview.score, critical: finalReview.critical, warnings: finalReview.warnings });
		return { script: current, review: finalReview, history, iterations: maxIter + 1 };
	}

	// ---- 「3回連続で重大問題なし」トラッキング ----
	function bumpStreak(pass) {
		const s = pass ? getStreak() + 1 : 0;
		try { localStorage.setItem(STREAK_KEY, String(s)); } catch { /* private mode */ }
		return s;
	}
	function getStreak() {
		try { return parseInt(localStorage.getItem(STREAK_KEY) || '0', 10); } catch { return 0; }
	}
	function isComplete() { return getStreak() >= 3; }

	return { run, autofix, loop, getStreak, isComplete, PASS_SCORE };
})();
