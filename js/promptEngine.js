/**
 * TM.Prompt — buildPrompt v2（テンプレートエンジン化）
 * 全15改善案のルールを1つのClaude用プロンプトに集約する。
 * テンプレート生成とClaude生成の「二刀流」のClaude側を担う。
 */
window.TM = window.TM || {};

TM.Prompt = (() => {
	function build(product, opts = {}) {
		const structure = TM.LIB.STRUCTURES.find((s) => s.id === opts.structureId) || TM.LIB.STRUCTURES[0];
		const hookDef = TM.LIB.HOOKS.find((h) => h.id === opts.hookId) || TM.LIB.HOOKS[0];
		const weights = TM.Analysis.feedbackWeights();
		const trends = TM.Analysis.recommendTrends(product);

		const beatsSpec = structure.beats
			.map((b, i) => `  ${i + 1}. role="${b.role}" 約${b.dur}秒 — ${b.guide}`)
			.join('\n');

		const perfNote = weights.samples
			? `過去${weights.samples}本の実績データでは、フック型ごとの相対パフォーマンスは ${JSON.stringify(weights.hooks)} です。数値が高い型に寄せてください。`
			: '実績データはまだありません。';

		const seriesNote = opts.seriesPart
			? `これはシリーズのPart ${opts.seriesPart.part}/${opts.seriesPart.total} です。${opts.seriesPart.part < opts.seriesPart.total ? '最後のシーンは次Partへのクリフハンガーで終えてください。' : '前Partの伏線をすべて回収して完結させてください。'}`
			: 'シリーズ化（Part1/2/3）できる余白をフックか最終シーンに1つ仕込んでください。';

		const ugcNote = opts.mode === 'ugc'
			? `## UGCモード（最重要トーン指示）
- 台本ではなく「友達に送るボイスメッセージ」のテンションで書く
- フィラー（てか、まじで、正直）を2〜3箇所に自然に入れる
- 広告的な定型句（購入はこちら/今すぐ購入 等）は禁止
- 言い淀みや「(伝われ)」のような不完全さを1箇所だけ入れる`
			: '';

		const styleNote = opts.styleProfile
			? `## 参考スタイル
分析済みプロファイル: トーン=${opts.styleProfile.tone}, 平均シーン尺=${opts.styleProfile.avgSceneSec}秒, フック型=${opts.styleProfile.hookStyle}。このテンポ感とトーンに寄せてください。`
			: '';

		return `あなたはTikTokで大バズを量産するショート動画の放送作家です。以下の商品のTikTok動画スクリプトをJSONで出力してください。

## 商品データ（忠実度が最重要 — ここに無い情報・数値・効能は絶対に創作しない）
${product.raw}

## 構造テンプレート: ${structure.label}
${beatsSpec}

## フック要件（3秒ルール）
- フック型: ${hookDef.label}（${hookDef.desc}）
- 24文字以内（画面テキストとして3秒で読み切れること）
- 例のトーン: 「${hookDef.build(product)}」

## Hook + CTA 一貫性（必須）
- フックで立てた問い・宣言・数字は、最終シーンとCTAで必ず回収する
- フックの中心キーワードをCTAに含める

## コメント誘発（必須）
- コメントしたくなる要素（二択・体験募集・賛否・クイズ・タグ付け誘発のいずれか）を1つ、キャプションか最終シーンに入れる

## ペーシング
- 総尺20〜45秒、1シーン平均3.5秒目安（最長でも8秒）
- 各シーンにエフェクト指定: pop / zoom / shake / flash / slide / none

## トレンドフォーマット候補（合うものがあれば visual 指示に反映）
${trends.map((t) => `- ${t.label}: ${t.note}`).join('\n')}

## パフォーマンス実績
${perfNote}

## シリーズ展開
${seriesNote}
${ugcNote}
${styleNote}

## 出力形式（このJSONのみを出力。前後の説明文は不要）
{
  "hook": {"type": "${hookDef.id}", "text": "..."},
  "scenes": [{"t": [開始秒, 終了秒], "role": "...", "text": "...", "effect": "...", "visual": "撮影/素材指示"}],
  "cta": "...",
  "commentBait": {"type": "poll|experience|quiz|debate|tag", "text": "..."},
  "caption": "...",
  "hashtags": ["#...", "#..."]
}

## セルフチェック（出力前に必ず検証）
1. 商品データに無い数値・断定表現を使っていないか
2. フックは24文字以内か
3. フックのキーワードがCTAで回収されているか
4. コメント誘発要素があるか
5. 総尺は20〜45秒か`;
	}

	// Claude応答のJSONを既存スクリプト構造にマージ
	function parseResponse(text, product, opts = {}) {
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (!jsonMatch) throw new Error('Claude応答にJSONが見つかりません');
		const data = JSON.parse(jsonMatch[0]);
		return {
			id: `s_${Date.now()}_claude`,
			createdAt: new Date().toISOString(),
			source: 'claude',
			mode: opts.mode || 'normal',
			structure: opts.structureId || TM.LIB.STRUCTURES[0].id,
			hookType: data.hook?.type || opts.hookId || 'question',
			hook: data.hook,
			scenes: data.scenes,
			cta: data.cta,
			commentBait: data.commentBait,
			caption: data.caption,
			hashtags: data.hashtags || [],
			product,
			seriesPart: opts.seriesPart || null,
		};
	}

	return { build, parseResponse };
})();
