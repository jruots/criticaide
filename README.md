# Criticaide

Your first line of defense in an era of digital manipulation - a desktop application that helps analyze text content for misinformation, disinformation, and bias.

## Overview

Criticaide is a proof-of-concept desktop application that uses local LLM capabilities (via Ollama) to analyze text content for potential misinformation, disinformation, manipulation techniques, and bias. Simply select any text, copy it with Ctrl+C, and use the global shortcut (Ctrl+Alt+Shift+T), and get near-instant analysis.

## Features

- Global keyboard shortcuts (Ctrl+C and Ctrl+Alt+Shift+T) for instant analysis
- Local processing using Ollama - your data stays on your machine. Privacy first.
- Adaptive model selection based on system capabilities (downloads either Phi2 or Mistral 7B)
- Dark mode interface
- Detailed analysis including:
  - Credibility score
  - Potential issues identification
  - Key concerns
  - Reading recommendations

## Prerequisites

- Windows OS (other platforms coming soon)
- Minimum 8GB RAM recommended (4GB minimum for lighter model)
- 2GB free storage space

## Installation

1. Download the latest release from the releases page
2. Run the installer
3. Launch Criticaide
4. First launch will download the appropriate AI model

## Development

This is a proof-of-concept project built with:
- Electron
- Node.js
- Ollama

### Quick Start

```bash
# Clone the repository
git clone https://github.com/jruots/criticaide.git

# Install dependencies
npm install

# Run in development mode
npm start
```

## Contributing
This is a proof-of-concept project and I'm excited to see it grow. Contributions, ideas, and feedback are welcome! See our Contributing Guidelines for more information.

## License
MIT License

## Acknowledgments

This project is built upon or inspired by the work of:

- [chatd](https://github.com/BruceMacD/chatd) - Some of our Electron app structure and implementations are based on this project
- [Ollama](https://github.com/ollama/ollama) - Used as the underlying LLM service for text analysis

Both projects are MIT licensed. We're grateful to their creators and contributors.

Powered by Mistral and Phi-2 models