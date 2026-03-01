# Archivist

A modern, cross-platform desktop application for managing and organizing your media library. Built with Electron and Angular, Archivist provides powerful tools for scanning, filtering, and maintaining your video collection.

![AI Analysis Dashboard 2](./docs/images/ai2.png)

## Features

### Intelligent AI Analysis

Transform your media library with AI-powered curator tools.
Use **local LLM** via ollama or provide your own api key for openai, claude, google sdks.

- **Smart Normalization**: Aggressive name normalization and conflict detection.
- **Confidence Scoring**: Color-coded confidence scores for AI matches.
- **TMDB Integration**: Automatic poster fetching and direct links to metadata sources (BYOK).
- **Batch Processing**: High-performance, multi-threaded scanning worker.
- **TV Series Organization**: Automated grouping of episodes into seasons with "Missing Episode" detection.

![TV Series View](./docs/images/shows.png)

![Series Details](./docs/images/shows2.png)

![AI Analysis Dashboard 1](./docs/images/ai1.png)

### Advanced Filtering & Sorting

- **Rich Metadata**: Filter by resolution, codec, audio tracks, bitrate, and more.
- **Incremental Scanning**: Local state persistence ensures only new files are processed.
- **SQLite Caching**: High-speed database layer for instant library loading.
- **Global Search**: Instant feedback as you type across your entire collection.

![Filtering Interface](./docs/images/demo1.png)

### Seamless Integration

- **VLC Playback**: Direct integration for launching files in VLC.
- **System Explorer**: Locate files on disk.
- **Metadata Embedding**: Edit and embed metadata directly into media files.

![Matching Dialog](./docs/images/demo2.png)

### Internationalization

Archivist is localized for:

- 🇺🇸 **English**
- 🇸🇪 **Svenska**
- 🇩🇪 **Deutsch**

---

## Ollama Setup

Archivist supports running AI analysis completely locally and privately using **Ollama**. Ollama allows you to run large language models on your own machine without relying on external cloud APIs or subscriptions.

### How to set it up:

1. **Install Ollama**: Download and install Ollama from [ollama.com](https://ollama.com/).
2. **Download a Model**: Open archivist settings and select the **Local (Ollama)** AI provider, and choose your downloaded model from the dropdown. Make sure Ollama is running in the background. Models are downloaded automatically but can be large files. Check the [ollama](https://ollama.com/models) website for available models.

---

### Building

I provide versions for Windows and macOS for convenience. You can find the latest builds in the releases section. However, since I do not own a paid Apple Developer account, I cannot sign the application for macOS. You will need to sign the application yourself if you want to run it on macOS or bypass the security settings.

You can build the application for different platforms using the following commands:

Intel Mac:

```bash
bun archivist:mac
```

Apple Silicon Mac:

```bash
bun archivist:mac:arm64
```

Windows:

```bash
bun archivist:win
```

Linux:

```bash
bun archivist:linux
```

Linux ARM64:

```bash
bun archivist:linux:arm64
```

## License

GNU GENERAL PUBLIC LICENSE v3.0
