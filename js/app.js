/**
 * TM.App — UI グルーコード
 * モード切替（作成 / シリーズ / 分析 / 運用）と各モジュールの結線。
 */
window.TM = window.TM || {};

TM.App = (() => {
	const $ = (id) => document.getElementById(id);
	const state = {
		product: null,
		script: null,      // 現在選択中のスクリプト
		variations: [],    // A/B用バリエーション
		series: [],        // Part1-3
		styleProfile: null,
	};

	// ---------- 初期化 ----------
	function init() {
		// セレクトボックスにライブラリを流し込む
		fillSelect('hookSelect', TM.LIB.HOOKS.map((h) => [h.id, `${h.label} — ${h.desc}`]));
		fillSelect('structureSelect', TM.LIB.STRUCTURES.map((s) => [s.id, `${s.label} — ${s.desc}`]));
		$('apiKey').value = TM.Claude.getKey();

		// タブ切替
		document.querySelectorAll('.tab').forEach((tab) => {
			tab.addEventListener('click', () => {
				document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
				document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
				tab.classList.add('active');
				$(tab.dataset.panel).classList.add('active');
			});
		});

		$('apiKey').addEventListener('change', (e) => TM.Claude.setKey(e.target.value.trim()));
		$('btnGenerate').addEventListener('click', () => generate(false));
		$('btnVariations').addEventListener('click', () => generate(true));
		$('btnSeries').addEventListener('click', generateSeries);
		$('btnAnalyzeStyle').addEventListener('click', analyzeStyle);
		$('btnPreview').addEventListener('click', () => state.script && TM.Renderer.preview($('canvas'), state.script));
		$('btnStop').addEventListener('click', TM.Renderer.stopPreview);
		$('btnExport').addEventListener('click', exportVideo);
		$('btnThumbs').addEventListener('click', renderThumbnails);
		$('btnCritic').addEventListener('click', runCritic);
		$('btnCriticLoop').addEventListener('click', runCriticLoop);
		$('btnNiche').addEventListener('click', runNiche);
		$('btnInsights').addEventListener('click', runInsights);
		$('btnAddTrend').addEventListener('click', addTrend);
		$('btnRecordPerf').addEventListener('click', recordPerformance);

		updateStreakBadge();
		renderFeedbackTable();
	}

	function fillSelect(id, pairs) {
		$(id).innerHTML = pairs.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
	}

	function esc(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
	}

	function toast(msg, isError = false) {
		const el = $('toast');
		el.textContent = msg;
		el.className = `toast show${isError ? ' error' : ''}`;
		setTimeout(() => el.classList.remove('show'), 3500);
	}

	function requireProduct() {
		const raw = $('productInput').value.trim();
		if (!raw) { toast('商品データを入力してください', true); return null; }
		state.product = TM.Gen.parseProduct(raw);
		return state.product;
	}

	function currentOpts() {
		return {
			hookId: $('hookSelect').value,
			structureId: $('structureSelect').value,
			mode: $('modeUgc').checked ? 'ugc' : 'normal',
			styleProfile: state.styleProfile,
		};
	}

	// ---------- 生成 ----------
	async function generate(withVariations) {
		const p = requireProduct();
		if (!p) return;
		toast(TM.Claude.available() ? 'Claudeで生成中…' : 'テンプレートで生成中…');
		const opts = currentOpts();
		if (withVariations) {
			// #10: バリエーション一括生成（テンプレエンジンで即時、Claude利用時は本命のみClaude）
			state.variations = TM.Gen.generateVariations(p, opts, 4);
			if (TM.Claude.available()) {
				const r = await TM.Claude.generate(p, opts);
				state.variations.unshift(r.script);
				if (r.error) toast(`Claude失敗→テンプレ: ${r.error}`, true);
			}
			state.series = [];
			selectScript(state.variations[0]);
			renderVariations();
		} else {
			const r = await TM.Claude.generate(p, opts);
			if (r.error) toast(`Claude失敗→テンプレ: ${r.error}`, true);
			state.variations = [];
			state.series = [];
			selectScript(r.script);
			renderVariations();
		}
	}

	function generateSeries() {
		const p = requireProduct();
		if (!p) return;
		state.series = TM.Gen.generateSeries(p, currentOpts());
		state.variations = [];
		selectScript(state.series[0]);
		renderVariations();
		toast('シリーズ Part1〜3 を生成しました');
	}

	function analyzeStyle() {
		const ref = $('styleInput').value.trim();
		if (!ref) { state.styleProfile = null; $('styleResult').textContent = '未設定'; return; }
		state.styleProfile = TM.Analysis.analyzeStyle(ref);
		$('styleResult').textContent =
			`トーン=${state.styleProfile.tone} / 平均シーン${state.styleProfile.avgSceneSec.toFixed(1)}秒 / 推奨フック=${state.styleProfile.hookStyle}`;
		toast('参考スタイルを解析しました。以降の生成に反映されます');
	}

	// ---------- 表示 ----------
	function selectScript(script) {
		state.script = script;
		renderScript();
		renderScore();
		renderCommentPredictions();
		renderTrends();
		TM.Renderer.preview($('canvas'), script);
	}

	function renderScript() {
		const s = state.script;
		if (!s) return;
		const rows = s.scenes.map((sc) =>
			`<tr><td>${sc.t[0].toFixed(0)}–${sc.t[1].toFixed(0)}s</td><td class="role">${esc(sc.role)}</td><td>${esc(sc.text)}</td><td class="fx">${esc(sc.effect || '')}</td></tr>`
		).join('');
		$('scriptView').innerHTML = `
			<div class="meta">
				<span class="badge">${esc(s.structure)}</span>
				<span class="badge">${esc(s.hookType)}</span>
				<span class="badge">${s.mode === 'ugc' ? 'UGC' : '通常'}</span>
				${s.seriesPart ? `<span class="badge series">Part${s.seriesPart.part}/${s.seriesPart.total}</span>` : ''}
				${s.source === 'claude' ? '<span class="badge claude">Claude</span>' : ''}
			</div>
			<table><thead><tr><th>時間</th><th>役割</th><th>テキスト</th><th>FX</th></tr></thead><tbody>${rows}</tbody></table>
			<p><b>CTA:</b> ${esc(s.cta)}</p>
			<p><b>コメント誘発:</b> ${esc(s.commentBait?.text || 'なし')}</p>
			<p><b>キャプション:</b> ${esc(s.caption)} ${s.hashtags.map((h) => esc(h)).join(' ')}</p>`;
	}

	function renderVariations() {
		const list = state.variations.length ? state.variations : state.series;
		if (!list.length) { $('variationsView').innerHTML = ''; return; }
		const isSeries = !!state.series.length;
		$('variationsView').innerHTML = `<h3>${isSeries ? 'シリーズ' : 'A/Bバリエーション'}</h3>` + list.map((v, i) => {
			const score = TM.Score.viralScore(v).total;
			const label = isSeries ? `Part${v.seriesPart.part}` : TM.LIB.HOOKS.find((h) => h.id === v.hookType)?.label || v.hookType;
			return `<button class="variation ${v.id === state.script?.id ? 'selected' : ''}" data-i="${i}">
				${esc(label)}<span class="vscore">${score}点</span><span class="vhook">${esc(v.hook.text)}</span></button>`;
		}).join('');
		$('variationsView').querySelectorAll('.variation').forEach((btn) => {
			btn.addEventListener('click', () => selectScript(list[Number(btn.dataset.i)]));
		});
	}

	function renderScore() {
		const s = state.script;
		if (!s) return;
		const r = TM.Score.viralScore(s);
		const bars = Object.entries(r.breakdown).map(([key, v]) => `
			<div class="scorebar"><span class="label">${key}</span>
				<div class="bar"><div class="fill ${v.score / v.max >= 0.8 ? 'good' : v.score / v.max >= 0.5 ? 'mid' : 'bad'}" style="width:${(v.score / v.max) * 100}%"></div></div>
				<span class="pts">${v.score}/${v.max}</span><span class="note">${esc(v.note)}</span></div>`).join('');
		$('scoreView').innerHTML = `
			<div class="totalscore ${r.total >= 80 ? 'good' : r.total >= 60 ? 'mid' : 'bad'}">${r.total}<small>/100</small></div>
			${bars}`;
	}

	function renderCommentPredictions() {
		const pred = TM.Analysis.predictComments(state.script);
		$('commentView').innerHTML = pred.predictions.map((p) =>
			`<div class="pred"><b>${esc(p.type)}</b>（量:${esc(p.volume)}） ${esc(p.example)}<br><small>→ ${esc(p.action)}</small></div>`
		).join('') + `<div class="pinned">${esc(pred.pinned)}</div>`;
	}

	function renderTrends() {
		const trends = TM.Analysis.recommendTrends(state.product || { category: '', raw: '' });
		$('trendView').innerHTML = trends.map((t) =>
			`<div class="trend">${t.custom ? '🔥' : '📌'} <b>${esc(t.label)}</b><br><small>${esc(t.note || '')}</small></div>`
		).join('');
	}

	// ---------- Critic ----------
	function runCritic() {
		if (!state.script) { toast('先にスクリプトを生成してください', true); return; }
		const review = TM.Critic.run(state.script);
		renderCriticResult(review, null);
	}

	function runCriticLoop() {
		if (!state.script) { toast('先にスクリプトを生成してください', true); return; }
		const result = TM.Critic.loop(state.script);
		state.script = result.script;
		renderScript();
		renderScore();
		TM.Renderer.preview($('canvas'), state.script);
		renderCriticResult(result.review, result.history);
		updateStreakBadge();
	}

	function renderCriticResult(review, history) {
		const items = [
			...review.critical.map((c) => `<li class="crit">🔴 ${esc(c)}</li>`),
			...review.warnings.map((w) => `<li class="warn">🟡 ${esc(w)}</li>`),
		].join('') || '<li class="ok">🟢 重大問題なし</li>';
		const hist = history
			? `<div class="history">${history.map((h) => `<div>Loop${h.iteration}: ${h.score}点 / 重大${h.critical.length}件</div>`).join('')}</div>`
			: '';
		$('criticView').innerHTML = `
			<div class="verdict ${review.pass ? 'pass' : 'fail'}">${review.pass ? '✅ PASS' : '❌ FAIL'}（${review.score}点）</div>
			<ul>${items}</ul>${hist}`;
		updateStreakBadge();
	}

	function updateStreakBadge() {
		const streak = TM.Critic.getStreak();
		$('streakBadge').textContent = `Critic連続PASS: ${streak}/3${TM.Critic.isComplete() ? ' 🏆完成形' : ''}`;
	}

	// ---------- 書き出し ----------
	async function exportVideo() {
		if (!state.script) { toast('先にスクリプトを生成してください', true); return; }
		toast('動画を書き出し中…（実時間かかります）');
		try {
			const { blob, mime } = await TM.Renderer.exportVideo($('canvas'), state.script, (p) => {
				$('exportProgress').style.width = `${p * 100}%`;
			});
			$('exportProgress').style.width = '0%';
			const ext = mime.includes('mp4') ? 'mp4' : 'webm';
			download(URL.createObjectURL(blob), `tiktok_${state.script.id}.${ext}`);
			toast('書き出し完了');
		} catch (e) {
			toast(`書き出し失敗: ${e.message}`, true);
		}
	}

	function renderThumbnails() {
		if (!state.script) { toast('先にスクリプトを生成してください', true); return; }
		const cands = TM.Renderer.thumbnailCandidates(state.script);
		$('thumbView').innerHTML = cands.map((c, i) => `
			<figure class="thumb ${i === 0 ? 'best' : ''}">
				<img src="${c.dataUrl}" alt="${esc(c.label)}">
				<figcaption>${i === 0 ? '⭐ ' : ''}${esc(c.label)}（可読性${c.readability}）
					<a href="${c.dataUrl}" download="thumb_${c.id}.png">保存</a></figcaption>
			</figure>`).join('');
	}

	function download(url, name) {
		const a = document.createElement('a');
		a.href = url;
		a.download = name;
		a.click();
	}

	// ---------- 分析モード ----------
	function runNiche() {
		const kw = $('nicheInput').value.trim();
		if (!kw) { toast('ニッチキーワードを入力してください', true); return; }
		const r = TM.Analysis.analyzeNiche(kw, state.product);
		$('nicheView').innerHTML = `
			<p><b>ポジショニング:</b> ${esc(r.positioning)}</p>
			<table><thead><tr><th>切り口</th><th>推奨フック</th><th>理由</th></tr></thead><tbody>
			${r.angles.map((a) => `<tr><td>${esc(a.angle)}</td><td>${esc(a.hook)}</td><td>${esc(a.why)}</td></tr>`).join('')}
			</tbody></table>
			<p><b>投稿計画:</b></p><ul>${r.postingPlan.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
			<p><b>チェックリスト:</b></p><ul>${r.checklist.map((x) => `<li>☐ ${esc(x)}</li>`).join('')}</ul>`;
	}

	function runInsights() {
		const raw = $('commentsInput').value.trim();
		if (!raw) { toast('コメントを貼り付けてください', true); return; }
		const r = TM.Analysis.extractInsights(raw);
		$('insightsView').innerHTML = `
			<p><b>${r.total}件</b>を分析 — 😊${r.sentiment.positive} / 😐${r.sentiment.neutral} / 😞${r.sentiment.negative}</p>
			<p><b>頻出テーマ:</b> ${r.themes.map((t) => `${esc(t.word)}(${t.count})`).join('、') || 'なし'}</p>
			<p><b>質問コメント:</b></p><ul>${r.questions.map((q) => `<li>${esc(q)}</li>`).join('') || '<li>なし</li>'}</ul>
			<p><b>次の動画案:</b></p><ul>${r.nextIdeas.map((x) => `<li>💡 ${esc(x)}</li>`).join('')}</ul>`;
	}

	function addTrend() {
		const label = $('trendLabel').value.trim();
		if (!label) { toast('トレンド名を入力してください', true); return; }
		TM.Analysis.addCustomTrend(label, $('trendNote').value.trim());
		$('trendLabel').value = '';
		$('trendNote').value = '';
		renderTrends();
		toast('トレンドを追加しました。推奨に反映されます');
	}

	// ---------- 運用モード（フィードバックループ #14）----------
	function recordPerformance() {
		if (!state.script && !$('perfHook').value) { toast('スクリプト未選択の場合はフック型を選んでください', true); return; }
		TM.Analysis.recordPerformance({
			scriptId: state.script?.id || 'manual',
			hookType: state.script?.hookType || $('perfHook').value,
			structure: state.script?.structure || '',
			views: Number($('perfViews').value) || 0,
			likes: Number($('perfLikes').value) || 0,
			comments: Number($('perfComments').value) || 0,
		});
		renderFeedbackTable();
		toast('実績を記録しました。以降のスコアと生成に反映されます');
	}

	function renderFeedbackTable() {
		const list = TM.Analysis.loadPerformance();
		const w = TM.Analysis.feedbackWeights();
		fillSelect('perfHook', TM.LIB.HOOKS.map((h) => [h.id, h.label]));
		$('feedbackView').innerHTML = `
			<p><b>学習済み重み</b>（${w.samples || 0}本の実績から）: ${Object.entries(w.hooks || {}).map(([k, v]) => `${esc(k)}=${v.toFixed(2)}`).join(' / ') || 'まだ実績なし'}</p>
			<table><thead><tr><th>日時</th><th>フック型</th><th>再生</th><th>いいね</th><th>コメント</th></tr></thead><tbody>
			${list.slice(0, 15).map((e) => `<tr><td>${esc((e.recordedAt || '').slice(0, 10))}</td><td>${esc(e.hookType)}</td><td>${e.views}</td><td>${e.likes}</td><td>${e.comments}</td></tr>`).join('')}
			</tbody></table>`;
	}

	document.addEventListener('DOMContentLoaded', init);
	return { state };
})();
