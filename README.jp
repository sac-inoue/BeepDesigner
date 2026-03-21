# Beep Designer

A high-performance web-based sound design tool for microcontrollers (e.g., ESP32) using piezo buzzers.

![Beep Designer Screenshot](public/screenshot.png)

---

**Beep Designer** は、ESP32 などのマイコンと圧電サウンダを用いた音響設計のための高性能 Web ツールです。ピアノロール・インターフェースにより、直感的なメロディ作成と実機に近いプレビュー、ソースコード生成を同時に実現します。

### 主な機能

- **ピアノロール・エディタ (Piano Roll Editor)**
    - 62.5ms / 16分音符解像度の高精度なグリッドで編集を行う。
    - ノートの配置、削除、一括オクターブ・シフトをサポートする。
- **鼻歌入力 (Hum-to-Beep)**
    - マイクから入力された音声をリアルタイムで解析し、ノートに変換する。
    - スロー録音（1x, 2x, 3x）により、複雑なフレーズも正確に入力できる。
    - 先行録音と無音トリミングにより、歌い出しをパターンの先頭に自動で合わせる。
- **Web Audio プレビュー (Real-time Preview)**
    - 圧電サウンダの音色を模した矩形波で再生を行う。
    - 連続する同音高のノートを自動統合（レガート）し、途切れのない音を実現する。
- **C言語・WAV書き出し (Export Options)**
    - `{ 周波数, 長さ }` のペア形式で `uint32_t` 配列のソースコードを生成する。
    - 44.1kHz モノラル WAV ファイルとしてブラウザ内でレンダリングし、ダウンロードする。
- **プロジェクト管理 (Project Management)**
    - ブラウザの Local Storage を利用して編集内容を自動保存する。
    - JSON 形式によるプロジェクト全体のインポートおよびエクスポートをサポートする。

---

### 使い方

1.  **クローン**: `git clone https://github.com/sac-inoue/BeepDesigner.git`
2.  **インストール**: `npm install`
3.  **起動**: `npm run dev`
4.  **編集**: `http://localhost:5173/` を開き、ビープ音の設計を開始する。

### 技術スタック

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Audio Context**: Web Audio API

## ライセンス

MIT License
