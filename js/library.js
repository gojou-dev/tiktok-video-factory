/**
 * TM.LIB — フック・バイラル構造・トレンド・CTAの静的ライブラリ
 * PRD改善案 #1(フックシステム) #2(バイラル構造) #8(トレンドフォーマット) の基盤データ
 */
window.TM = window.TM || {};

TM.LIB = (() => {
	// ---- #1: 3秒以内の超強力フックライブラリ ----
	// build(p) は商品データ p を受け取りフック文字列を返す。
	// 3秒ルール: 日本語の画面テキスト読了速度 ≈ 8文字/秒 → 24文字以内を強制。
	const HOOKS = [
		{
			id: 'question',
			label: '質問型',
			desc: '視聴者に即座に自分ごと化させる質問',
			build: (p) => `まだ${p.category || 'これ'}で損してるの？`,
			commentAffinity: 0.8,
		},
		{
			id: 'shock',
			label: '衝撃事実型',
			desc: '数字や事実で殴るフック',
			build: (p) => (p.price ? `${p.price}でこれは正直バグ` : 'この価格は正直バグってる'),
			commentAffinity: 0.7,
		},
		{
			id: 'empathy',
			label: '共感型',
			desc: '「わかる」を先に取りに行く',
			build: (p) => `${p.target || 'みんな'}、これ全員通る悩みだよね`,
			commentAffinity: 0.9,
		},
		{
			id: 'contrarian',
			label: '逆張り型',
			desc: '常識否定で脳を止める',
			build: (p) => `${p.category || 'これ'}、実は選び方ほぼ全員間違ってる`,
			commentAffinity: 1.0,
		},
		{
			id: 'secret',
			label: '秘密暴露型',
			desc: '「知らないのは損」構造',
			build: () => '本当は教えたくなかったんだけど…',
			commentAffinity: 0.75,
		},
		{
			id: 'beforeafter',
			label: 'ビフォーアフター型',
			desc: '変化の予告で最後まで引っ張る',
			build: () => '30日前の自分に見せたい結果がこれ',
			commentAffinity: 0.7,
		},
		{
			id: 'warning',
			label: '警告型',
			desc: '損失回避バイアスを突く',
			build: (p) => `${p.category || 'これ'}買う前に絶対見て`,
			commentAffinity: 0.85,
		},
		{
			id: 'pov',
			label: 'POV型',
			desc: '当事者視点の没入フック',
			build: (p) => `POV: ${p.target || 'あなた'}がついに答えを見つけた日`,
			commentAffinity: 0.65,
		},
	];

	// ---- #2: バイラル証明済みスクリプト構造テンプレート ----
	// roles: 各シーンの役割。dur: 推奨秒数。フックは常に3秒以内。
	const STRUCTURES = [
		{
			id: 'problem-solution-echo',
			label: 'Problem-Solution-Echo',
			desc: '悩み提示→解決→フックの回収。汎用で最も強い王道構造',
			beats: [
				{ role: 'hook', dur: 3, guide: 'フック。3秒以内、24文字以内' },
				{ role: 'problem', dur: 5, guide: 'ターゲットの悩みを具体的に言語化' },
				{ role: 'agitate', dur: 4, guide: '放置するとどうなるかを一押し' },
				{ role: 'solution', dur: 8, guide: '商品を解決策として提示。特徴は商品データのみ' },
				{ role: 'proof', dur: 6, guide: '根拠・スペック・使用感（商品データに忠実）' },
				{ role: 'echo', dur: 4, guide: 'フックの言葉を回収してCTAへ接続' },
			],
		},
		{
			id: 'listicle',
			label: 'リスト型（3選）',
			desc: '「◯つの理由」構造。保存されやすい',
			beats: [
				{ role: 'hook', dur: 3, guide: '「◯つ」を必ず数字で宣言' },
				{ role: 'point1', dur: 6, guide: '理由1。最も強い特徴' },
				{ role: 'point2', dur: 6, guide: '理由2' },
				{ role: 'point3', dur: 7, guide: '理由3。意外性のあるもの' },
				{ role: 'echo', dur: 4, guide: 'まとめ+CTA' },
			],
		},
		{
			id: 'storytime',
			label: 'ストーリー型',
			desc: '体験談で信頼を作るUGC相性最強の構造',
			beats: [
				{ role: 'hook', dur: 3, guide: '結末の予告 or 感情の宣言' },
				{ role: 'setup', dur: 6, guide: '状況説明。一人称で' },
				{ role: 'conflict', dur: 6, guide: 'つまずき・失敗・迷い' },
				{ role: 'solution', dur: 8, guide: '商品との出会いと変化' },
				{ role: 'echo', dur: 4, guide: '今の状態+CTA' },
			],
		},
		{
			id: 'beforeafter',
			label: 'ビフォーアフター型',
			desc: '変化の可視化。結果が絵になる商品向け',
			beats: [
				{ role: 'hook', dur: 3, guide: '変化の予告' },
				{ role: 'before', dur: 6, guide: 'ビフォーの具体描写' },
				{ role: 'process', dur: 8, guide: '商品の使い方・期間' },
				{ role: 'after', dur: 6, guide: 'アフターの具体描写' },
				{ role: 'echo', dur: 4, guide: '「あなたもなれる」+CTA' },
			],
		},
		{
			id: 'pov',
			label: 'POV型',
			desc: '没入シチュエーション。若年層ニッチに強い',
			beats: [
				{ role: 'hook', dur: 3, guide: 'POV:で始まるシチュエーション宣言' },
				{ role: 'scene', dur: 8, guide: 'シチュエーションの展開' },
				{ role: 'turn', dur: 7, guide: '商品が登場して状況が変わる瞬間' },
				{ role: 'echo', dur: 4, guide: '余韻+CTA' },
			],
		},
	];

	// ---- #8: トレンドフォーマット（キュレーション + 手動追記可能）----
	// ライブAPIが無い環境でも運用できるよう、普遍性の高いフォーマットを内蔵し
	// UIから「今週見たトレンド」を追記して推奨に混ぜられる設計。
	const TREND_FORMATS = [
		{ id: 'greenscreen', label: 'グリーンスクリーン解説', fit: ['解説', 'ガジェット', '知識系'], note: '商品ページのスクショを背景に本人が解説' },
		{ id: 'asmr-unbox', label: 'ASMR開封', fit: ['コスメ', 'ガジェット', '食品'], note: '無言+環境音。UGCモードと相性◎' },
		{ id: 'day-in-life', label: 'Day in my life', fit: ['ライフスタイル', '美容', '健康'], note: '日常の中に商品を自然に登場させる' },
		{ id: 'ranking', label: 'ティアリスト/ランキング', fit: ['比較', 'ガジェット'], note: '正直レビュー感が出る' },
		{ id: 'textwall', label: 'テキスト大量貼り', fit: ['知識系', '解説'], note: '一時停止誘発→エンゲージ加点' },
		{ id: 'reply-comment', label: 'コメント返信動画', fit: ['シリーズ', '全ジャンル'], note: 'Part2以降のシリーズ展開に最適' },
	];

	// ---- CTAパターン（フックタイプと対で一貫性を担保）----
	const CTAS = {
		question: (p) => `答えはプロフのリンクで確かめて。${p.name}をチェック`,
		shock: (p) => `この価格のうちに${p.name}を見てみて`,
		empathy: (p) => `同じ悩みの人は${p.name}試してみて。感想コメントで教えて`,
		contrarian: (p) => `正しい選び方はこれ。${p.name}の詳細はプロフから`,
		secret: (p) => `内緒だよ。${p.name}、リンク置いとくね`,
		beforeafter: (p) => `あなたの30日後のために。${p.name}はプロフから`,
		warning: (p) => `後悔する前に${p.name}を確認して`,
		pov: (p) => `続きはあなたの番。${p.name}で始めて`,
	};

	// ---- #6: UGCらしさマーカー ----
	const UGC = {
		fillers: ['てか', 'まじで', 'これさ、', 'いやほんと', 'ちょっと待って、', '正直'],
		imperfections: ['←語彙力', '(伝われ)', '※個人の感想', 'って思ってたんだけど', 'なんか'],
		adWords: ['購入はこちら', '今すぐ購入', 'お買い求め', '公式サイトへ', '広告'],
		casualEndings: ['なんだよね', 'でした', 'って話', 'かも', 'なの', 'すぎる'],
	};

	// ---- #7: コメント誘発パターン ----
	const COMMENT_BAITS = [
		{ id: 'poll', label: '二択投票', build: (p) => `${p.category || 'これ'}派？それとも今のまま派？コメントで教えて`, },
		{ id: 'experience', label: '体験募集', build: () => '同じ経験ある人いる？コメント欄で待ってる' },
		{ id: 'quiz', label: 'クイズ', build: () => '実はもう1個裏ワザがあるんだけど、分かる人いる？' },
		{ id: 'debate', label: '賛否両論', build: () => '賛否あると思うけど、正直どう思う？' },
		{ id: 'tag', label: 'タグ付け誘発', build: (p) => `${p.target || 'これが必要な人'}が友達にいたらメンションして` },
	];

	const HASHTAG_BASE = ['#tiktokで見つけた', '#正直レビュー', '#買ってよかった', '#pr'];

	return { HOOKS, STRUCTURES, TREND_FORMATS, CTAS, UGC, COMMENT_BAITS, HASHTAG_BASE };
})();
