# Contributing to Criticaide

Thank you for your interest in contributing to Criticaide! This document provides guidelines and instructions for contributing to the project.

## Contribution Workflow

1. **Fork the repository** - Create your own copy of the project on GitHub
2. **Clone your fork** - `git clone https://github.com/YOUR-USERNAME/criticaide.git`
3. **Create a branch** - `git checkout -b descriptive-branch-name`
4. **Make your changes** - Implement your feature or fix
5. **Test thoroughly** - Ensure your changes work as expected
6. **Commit your changes** - `git commit -am "Add a descriptive commit message"`
7. **Push to your fork** - `git push origin descriptive-branch-name`
8. **Create a pull request** - Go to the original Criticaide repository and create a PR from your fork

## Development Setup

### Prerequisites
- Node.js (version 18 or higher recommended)
- npm (comes with Node.js)
- Git
- Basic understanding of Electron (v28.0.0)
- Familiarity with these key dependencies:
  - electron-builder (for packaging the application)
  - electron-log (for logging)
  - electron-store (for configuration storage)
  - node-global-key-listener (for keyboard shortcut handling)

### Setup Steps
1. Clone your fork: `git clone https://github.com/YOUR-USERNAME/criticaide.git`
2. Navigate to the project: `cd criticaide`
3. Install dependencies: `npm install`
4. Download the llama.cpp binary for your platform from [llama.cpp releases](https://github.com/ggerganov/llama.cpp/releases)
5. Place the binary in the appropriate directory:
   - Windows: `resources/llama/binaries/win/`
   - macOS: `resources/llama/binaries/mac/`
6. Run in development mode: `npm start`

## Project Architecture

Criticaide uses an agent-based architecture to analyze text:

- **Main Process** (`main.js`, `preload.js`): Handles application lifecycle, keyboard shortcuts, and communication with the llama.cpp server
- **Renderer Process** (`renderer.js`, `index.html`): Manages the user interface
- **Agent System** (`src/service/agents/`): A system of specialized AI agents that analyze text:
  - `BaseAgent`: The foundation for all agents
  - `ScreenerAgent`: Initial assessment of content 
  - `OrchestratorAgent`: Determines which specialists to use
  - `SpecialistAgent`: Various agents specialized in different analysis types
  - `SummarizerAgent`: Compiles findings into a final report
- **llama.cpp Integration** (`src/service/llama/llama.js`): Manages the local LLM

## Coding Guidelines

- **Simplicity over complexity** - Prefer straightforward, well-commented code over complex, clever solutions
- **Thorough comments** - Add comments for non-obvious code; explain *why* something is done, not just what is being done
- **Consistent formatting** - Follow the existing code style in the project
- **Error handling** - Always include appropriate error handling and logging
- **User experience** - Consider all aspects of UX, including error states and edge cases

## Testing Requirements

All contributions must be thoroughly tested before submitting a pull request:

1. **Development testing**: Test your changes in development mode
2. **Packaged build testing**: Build the application and test it as an installed application
   - For Windows: `npm run build:win`
   - For macOS: `npm run build:mac`
   - Test on actual hardware or in a virtual machine (e.g., VirtualBox for Windows testing)
3. **Edge cases**: Test with various types and lengths of text
4. **Error conditions**: Test how your changes handle errors

*Note: Changes not tested on packaged builds will not be merged.*

## Commit and PR Guidelines

- **Commit messages** should be clear and descriptive, explaining what was changed and why
- **Branch names** should describe the feature or fix (e.g., `fix-keyboard-shortcut`, `add-cognitive-bias-agent`)
- **Pull requests** should:
  - Have a clear, descriptive title
  - Include a detailed description of the changes
  - Reference any related issues
  - Include screenshots for UI changes

## Documentation

- Update documentation to reflect your changes
- If you add new features, include usage examples
- Consider updating the README.md if appropriate

## Questions or Suggestions?

If you have questions or suggestions about contributing:

- Open an issue for discussion
- Ask questions in pull request comments
- Provide feedback on existing issues or pull requests

We appreciate all contributions, from code to documentation to design suggestions!
