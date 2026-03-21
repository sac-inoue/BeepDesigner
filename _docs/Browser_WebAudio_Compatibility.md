# Web Audio API ブラウザ互換性・対応実装仕様

本ドキュメントでは、Beep Designer の Web Audio API 実装において直面した、ブラウザ間（主に Chrome と Safari(WebKit) 間）の挙動の違いと、それらを解決するための実装手法についてまとめます。

## 1. AudioContext の状態管理とライフサイクル

### 課題
Chrome 等の Chromium 系ブラウザでは `AudioContext.suspend()` を利用したオーディオエンジンの再利用や一時停止が安定して動作します。しかし Safari (iOS/macOS) においては、ユーザーのジェスチャー無しに非同期処理内で `suspend()` または `resume()` を繰り返すと、**コンテキストが意図せず永続的に音声再生をミュート（フリーズ）してしまう問題** が発生します。

### 対応策
`AudioContext` はアプリ起動時の初回のユーザーアクションで生成し、その後は**グローバルスコープでシングルトンとして維持**します。
また、再生や停止の処理において `AudioContext.suspend()` は一切使用せず、常に `running` 状態を保ちます。停止時には、アクティブなすべての `OscillatorNode` インスタンスを配列（`activeOscillatorsRef`）で管理・追跡し、手動で `.stop()` および `.disconnect()` を呼び出して音をサイレントに停止させる実装を採用しました。

## 2. 初期化時の Unmute (Unlock) トリック

### 課題
Safari はセキュリティ上、明示的なユーザーアクションのコールスタック内（DOMのクリックイベントハンドラの同期実行領域）でなければ音声再生をブロックします。しかし、`AudioContext` の作成自体は非同期処理でなくてもよいため、コンテキストは作成されても音が鳴らない現象（Speaker アイコンすら表示されない等）が起きることがあります。

### 対応策
`getGlobalAudioCtx()` 初回呼び出し時（すなわちユーザーが初めてクリック等のアクションを起こした瞬間）に、以下の「iOS/Safari向けの unlock トリック」を同期的に実行してハードウェアのオーディオセッションを強引に確立させます。

1. 空のオシレーター (`createOscillator`) と 無音のゲイン (`createGain`, `gain.value = 0`) を作成
2. `destination` へ接続
3. 現在時刻からわずか `0.001` 秒間だけ `.start()` して即 `.stop()`
4. `AudioContext.resume()` を直ちに呼び出す

これにより、Safari はユーザーが音を出したと認識し、以降の任意のタイミングにおける発音を許可します。

## 3. 音量のエンベロープ（Attack / Release）の計算

### 課題
`AudioParam` を用いて、不快なポップノイズを防ぐためにフェードイン・フェードアウト（エンベロープ）を作成します。
Chrome では `gain.setValueAtTime(0, start)` から直ちに `gain.linearRampToValueAtTime(0.2, start + attack)` のように記述しても正常にランプします。しかし **Safari では、始点とランプの指定が同一時刻のスケジューリング（または直後）である場合、`linearRampToValueAtTime` が無視される・または NAN になって異常終了するバグ**が知られています。

### 対応策
Safari に非常に堅牢・安定動作し、内部的なエラーを起こしにくい定数漸近アルゴリズムである **`setTargetAtTime`** を採用しました。

```typescript
// Safari に安全なエンベロープ構築
gain.gain.value = 0;
gain.gain.setValueAtTime(0, startTime);
gain.gain.setTargetAtTime(0.2, startTime, attackConstant); // Fade In
gain.gain.setTargetAtTime(0, endTime - releaseTime, releaseConstant); // Fade Out
```

## 4. `osc.start()` への引数の明記と時間のジャンプ

### 課題
`oscillator.start()` を引数なしで呼び出すと仕様上は `now (0)` として扱われますが、Safari では文脈によっては「AudioContext 起動からの絶対的な時間 0（つまり大昔）」と解釈され、**未来のどの時点でも音が鳴らず即座に終了する** 現象が発生します。

また、`AudioContext` が一時休止（suspend）から復帰（resume）した際、Chrome では `currentTime` が連続して滑らかに動きますが、**Safari では `currentTime` がハードウェアのリアルタイムクロックに同期しようと瞬時に大きな値へとジャンプする**仕様があります。これに計算処理が巻き込まれると、予定したスケジュールがすべて「過去の時間」と見なされ、発音が即時スキップされる原因となります。

### 対応策
- 必ず `osc.start(ctx.currentTime)` またはそれ以降の未来の明示的なスケジュール時刻 (`now + offset`) を指定します。
- 発音が詰まるのを防ぐため、再生開始時には常に `0.15秒 (150ms)` の一定の「セーフ・スケジューリング・バッファ」を上乗せして各ノードをスケジュールしています。

## 5. UI（プログレスバー）進行基準の分離

### 課題
前述の通り Safari では `AudioContext.currentTime` が予期せずジャンプしたり、バックグラウンドタブでスロットルされたりするため、この値をそのままプログレスバーや再生終了の判定に用いると、UIの挙動が破綻（一瞬で終わる、ループがおかしくなる）します。

### 対応策
オーディオノードのスケジュールには `AudioContext.currentTime` を利用しますが、**UI（赤いハイライトの進行や `isPlaying` の終了判定）の計算には、ブラウザの絶対的かつ高精度なタイマーである `performance.now()`** を使用し、オーディオの内部時間の狂いに引きずられないロジックで制御を分離しています。
