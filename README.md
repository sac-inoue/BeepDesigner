# Beep Designer

A high-performance web-based sound design tool for microcontrollers (e.g., ESP32) using piezo buzzers.

![Beep Designer Screenshot](public/screenshot.png)

[日本語のREADMEはこちら](#beep-designer-日本語)

---

## English Overview

**Beep Designer** is a professional-grade web application designed for embedded engineers and sound designers who need to create "musical" or "informative" beep patterns for piezo sounders. It provides a familiar Piano Roll interface and generates production-ready C code and high-quality WAV files instantly.

### Key Features

- **Piano Roll Editor**: High-precision grid (62.5ms / 16th note resolution).
- **Web Audio Engine**: Real-time preview with square waves, simulating the actual piezo sounder timbre.
- **Legato Playback**: Automatically merges consecutive identical notes for smooth, gap-free sound.
- **C-Code Generation**: Generates `uint32_t` arrays formatted as `{ frequency, duration }` pairs for direct hardware implementation.
- **WAV Export**: Direct rendering to 44.1kHz mono WAV files within the browser.
- **Pitch Management**: Symmetric scale centered on C4 (mapped to musical C8 = 4186Hz) and batch Octave-Shift functionality.
- **Project Persistence**: Local browser storage and JSON import/export support.

### Getting Started

1.  **Clone**: `git clone https://github.com/sac-inoue/BeepDesigner.git`
2.  **Install**: `npm install`
3.  **Run**: `npm run dev`
4.  **Edit**: Open `http://localhost:5173/`, add patterns, and paint your melody!

---

## Beep Designer (日本語)

**Beep Designer** は、ESP32 などのマイコンと圧電サウンダを用いたビープ音設計のための高性能な Web ツールです。

### 主な機能

- **ピアノロール・エディタ**: 高精度なグリッド（62.5ms / 16分音符解像度）による直感的な操作。
- **Web Audio プレビュー**: 圧電サウンダの音色を模した矩形波によるリアルタイム試聴。
- **レガート再生**: 連続する同じ音高のノートを自動統合し、途切れのない滑らかなサウンドを実現。
- **C言語コード生成**: `{ 周波数, 長さ }` のペア形式で `uint32_t` 配列をリアルタイム生成。
- **WAV書き出し**: ブラウザ内で 44.1kHz モノラル WAV ファイルとしてレンダリング・ダウンロード可能。
- **ピッチ管理**: C4（音楽的なC8 = 4186Hz相当）を基準とした対称スケールと、一括オクターブ・シフト機能。
- **プロジェクト管理**: ブラウザのLocal Storageによる自動保存、およびJSON形式でのインポート/エクスポート。

### 使い方

1.  **クローン**: `git clone https://github.com/sac-inoue/BeepDesigner.git`
2.  **インストール**: `npm install`
3.  **起動**: `npm run dev`
4.  **編集**: `http://localhost:5173/` を開き、サイドバーでパターンを追加してメロディを作成してください。

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Audio Context**: Web Audio API
- **State Management**: React Hooks (useState, useEffect, etc.)

## License

MIT License (or customized by user)
