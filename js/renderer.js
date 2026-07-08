/**
 * TM.Renderer — Canvas + MediaRecorder 動画レンダリング
 * ビジュアルエフェクト/ペーシング最適化(#4) / UGC手持ちカメラ風(#6) /
 * サムネイル・ファーストフレーム最適化(#13)
 */
window.TM = window.TM || {};

TM.Renderer = (() => {
	const W = 1080;
	const H = 1920;
	const FPS = 30;

	const PALETTES = {
		hook: ['#0f0c29', '#302b63'],
		problem: ['#232526', '#414345'],
		agitate: ['#3a1c1c', '#642b2b'],
		solution: ['#0f2027', '#2c5364'],
		proof: ['#1a2a36', '#2e4a5e'],
		echo: ['#41295a', '#2f0743'],
		default: ['#141e30', '#243b55'],
	};

	function sceneAt(script, t) {
		return script.scenes.find((s) => t >= s.t[0] && t < s.t[1]) || script.scenes[script.scenes.length - 1];
	}

	// テキストの折返し（全角ベースで最大13文字/行）
	function wrap(text, max = 13) {
		const lines = [];
		let cur = '';
		for (const ch of text) {
			cur += ch;
			if (cur.length >= max || ch === '\n') { lines.push(cur.trim()); cur = ''; }
		}
		if (cur.trim()) lines.push(cur.trim());
		return lines.slice(0, 6);
	}

	// ---- 1フレーム描画 ----
	function drawFrame(ctx, script, t) {
		const scene = sceneAt(script, t);
		const dur = TM.Gen.totalDuration(script);
		const local = t - scene.t[0]; // シーン内経過秒
		const sceneDur = scene.t[1] - scene.t[0];

		ctx.save();

		// UGCモード: 手持ちカメラ風の微ジッター
		if (script.mode === 'ugc') {
			ctx.translate((Math.sin(t * 7.3) + Math.sin(t * 13.1)) * 4, (Math.cos(t * 9.7)) * 4);
			ctx.rotate(Math.sin(t * 3.1) * 0.004);
		}

		// エフェクト: zoom(緩やかなズームイン) / shake / pop はテキストで処理
		if (scene.effect === 'zoom') {
			const sc = 1 + Math.min(local / sceneDur, 1) * 0.08;
			ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
		}
		if (scene.effect === 'shake' && local < 0.5) {
			ctx.translate((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
		}

		// 背景グラデーション
		const pal = PALETTES[scene.role] || PALETTES.default;
		const g = ctx.createLinearGradient(0, 0, 0, H);
		g.addColorStop(0, pal[0]);
		g.addColorStop(1, pal[1]);
		ctx.fillStyle = g;
		ctx.fillRect(-40, -40, W + 80, H + 80);

		// flash: シーン頭の白フラッシュ
		if (scene.effect === 'flash' && local < 0.25) {
			ctx.fillStyle = `rgba(255,255,255,${(0.25 - local) * 2.4})`;
			ctx.fillRect(-40, -40, W + 80, H + 80);
		}

		// メインテキスト（pop: 頭で弾む）
		const fontSize = scene.role === 'hook' ? 88 : 68;
		let popScale = 1;
		if (scene.effect === 'pop' || scene.role === 'hook') {
			popScale = local < 0.3 ? 0.85 + 0.15 * easeOutBack(local / 0.3) : 1;
		}
		ctx.save();
		ctx.translate(W / 2, H / 2);
		ctx.scale(popScale, popScale);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `bold ${fontSize}px "Hiragino Sans", "Noto Sans JP", sans-serif`;
		const lines = wrap(scene.text, scene.role === 'hook' ? 10 : 13);
		const lh = fontSize * 1.35;
		lines.forEach((line, i) => {
			const y = (i - (lines.length - 1) / 2) * lh;
			ctx.lineWidth = 14;
			ctx.strokeStyle = 'rgba(0,0,0,0.85)';
			ctx.strokeText(line, 0, y);
			ctx.fillStyle = scene.role === 'hook' ? '#ffe14d' : '#ffffff';
			ctx.fillText(line, 0, y);
		});
		ctx.restore();

		// 商品バッジ（solution以降で表示）
		const showBadge = ['solution', 'proof', 'echo', 'turn', 'process', 'after', 'point1', 'point2', 'point3'].includes(scene.role);
		if (showBadge && script.product.name) {
			ctx.font = 'bold 44px "Hiragino Sans", "Noto Sans JP", sans-serif';
			ctx.textAlign = 'center';
			const label = `🛒 ${script.product.name.slice(0, 18)}${script.product.price ? ` ${script.product.price}` : ''}`;
			const tw = ctx.measureText(label).width + 60;
			ctx.fillStyle = 'rgba(255,255,255,0.92)';
			roundRect(ctx, (W - tw) / 2, H - 420, tw, 88, 44);
			ctx.fill();
			ctx.fillStyle = '#111';
			ctx.fillText(label, W / 2, H - 420 + 56);
		}

		// シリーズ表示
		if (script.seriesPart) {
			ctx.font = 'bold 52px "Hiragino Sans", sans-serif';
			ctx.textAlign = 'left';
			ctx.fillStyle = '#ffe14d';
			ctx.fillText(`Part ${script.seriesPart.part}/${script.seriesPart.total}`, 60, 160);
		}

		// プログレスバー（完走率対策の残り時間可視化）
		ctx.fillStyle = 'rgba(255,255,255,0.25)';
		ctx.fillRect(0, H - 14, W, 14);
		ctx.fillStyle = '#ff2c55';
		ctx.fillRect(0, H - 14, W * Math.min(t / dur, 1), 14);

		ctx.restore();
	}

	function easeOutBack(x) {
		const c1 = 1.70158;
		return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
	}

	function roundRect(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.arcTo(x + w, y, x + w, y + h, r);
		ctx.arcTo(x + w, y + h, x, y + h, r);
		ctx.arcTo(x, y + h, x, y, r);
		ctx.arcTo(x, y, x + w, y, r);
		ctx.closePath();
	}

	// ---- プレビュー再生 ----
	let previewHandle = null;
	function preview(canvas, script, onTick) {
		stopPreview();
		const ctx = canvas.getContext('2d');
		const dur = TM.Gen.totalDuration(script);
		const start = performance.now();
		const tick = () => {
			const t = ((performance.now() - start) / 1000) % dur;
			drawFrame(ctx, script, t);
			if (onTick) onTick(t, dur);
			previewHandle = requestAnimationFrame(tick);
		};
		tick();
	}
	function stopPreview() {
		if (previewHandle) cancelAnimationFrame(previewHandle);
		previewHandle = null;
	}

	// ---- MediaRecorder 書き出し ----
	function exportVideo(canvas, script, onProgress) {
		return new Promise((resolve, reject) => {
			stopPreview();
			const ctx = canvas.getContext('2d');
			const dur = TM.Gen.totalDuration(script);
			const stream = canvas.captureStream(FPS);
			const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
				.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
			if (!mime) { reject(new Error('このブラウザはMediaRecorderに対応していません')); return; }
			const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
			const chunks = [];
			rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
			rec.onerror = (e) => reject(e.error || new Error('録画エラー'));
			rec.onstop = () => resolve({ blob: new Blob(chunks, { type: mime }), mime, duration: dur });
			rec.start(250);

			const start = performance.now();
			const tick = () => {
				const t = (performance.now() - start) / 1000;
				if (t >= dur) {
					drawFrame(ctx, script, dur - 0.001);
					rec.stop();
					return;
				}
				drawFrame(ctx, script, t);
				if (onProgress) onProgress(t / dur);
				requestAnimationFrame(tick);
			};
			tick();
		});
	}

	// ---- #13: サムネイル・ファーストフレーム最適化 ----
	// フックの見せ方が異なる3候補を生成し、可読性ヒューリスティックでスコア付け。
	function thumbnailCandidates(script) {
		const variants = [
			{ id: 'full', label: 'フック全文', text: script.hook.text },
			{ id: 'punch', label: 'パンチライン抽出', text: punchline(script.hook.text) },
			{ id: 'tease', label: '続き気にならせ型', text: `${punchline(script.hook.text).slice(0, 8)}…` },
		];
		return variants.map((v) => {
			const canvas = document.createElement('canvas');
			canvas.width = W; canvas.height = H;
			const s = structuredClone(script);
			s.hook.text = v.text;
			s.scenes[0].text = v.text;
			drawFrame(canvas.getContext('2d'), s, 0.31); // popアニメ完了後のフレーム
			// 可読性スコア: 文字数が8-16文字で最大、短すぎ/長すぎは減点
			const len = v.text.length;
			const readability = len <= 4 ? 55 : len <= 16 ? 95 - Math.abs(11 - len) * 2 : Math.max(40, 95 - (len - 16) * 4);
			return { ...v, dataUrl: canvas.toDataURL('image/png'), readability };
		}).sort((a, b) => b.readability - a.readability);
	}

	function punchline(text) {
		// 句読点・助詞前後で最も情報密度の高そうな断片を抜く簡易版
		const parts = text.split(/[、。,\s]/).filter(Boolean).sort((a, b) => b.length - a.length);
		return parts[0] || text;
	}

	return { W, H, drawFrame, preview, stopPreview, exportVideo, thumbnailCandidates };
})();
