# Contributing to node-red-contrib-goodwe

Thank you for your interest in contributing to node-red-contrib-goodwe! We welcome contributions from the community.

## Development Setup

### Prerequisites

- Node.js >= 20.0.0
- npm >= 6.0.0
- Git

### Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/node-red-contrib-goodwe.git
   cd node-red-contrib-goodwe
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a new branch for your feature or bug fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```

## Development Workflow

### Test-Driven Development (TDD)

This project follows TDD principles. When adding new features:

1. **Write tests first**: Before implementing a feature, write tests that define the expected behavior
2. **Run tests**: Verify that new tests fail (red phase)
3. **Implement**: Write the minimum code to make tests pass (green phase)
4. **Refactor**: Clean up and optimize while keeping tests green

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- test/goodwe.test.js
```

### Code Quality

#### Linting

```bash
# Check code style
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

#### Code Coverage

We aim for at least 70% code coverage. Run tests with coverage to check:

```bash
npm test -- --coverage
```

## Project Structure

```
node-red-contrib-goodwe/
├── nodes/              # Node implementation
│   ├── goodwe.js      # Node runtime logic (backend)
│   ├── goodwe.html    # Node UI and help (frontend)
│   └── icons/         # Node icons
├── test/              # Test files
│   └── goodwe.test.js # Main test suite
├── examples/          # Example flows
│   └── basic-read.json
├── .github/           # GitHub Actions workflows
│   └── workflows/
│       └── ci.yml
├── package.json       # Project dependencies and scripts
├── jest.config.js     # Jest test configuration
├── .eslintrc.json     # ESLint configuration
└── README.md          # Project documentation
```

## Making Changes

### Adding a New Feature

1. Create an issue describing the feature
2. Write tests that define the expected behavior
3. Implement the feature
4. Ensure all tests pass
5. Update documentation
6. Submit a pull request

### Fixing a Bug

1. Create an issue describing the bug (if one doesn't exist)
2. Write a test that reproduces the bug
3. Fix the bug
4. Ensure all tests pass
5. Submit a pull request

### Node Implementation Guidelines

When working on the node implementation:

- **goodwe.js**: Contains the Node-RED runtime logic
  - Use asynchronous operations with proper error handling
  - Follow Node-RED node best practices
  - Update node status appropriately (connecting, connected, error, etc.)
  - Clean up resources in the `close` event handler

- **goodwe.html**: Contains the editor UI and help documentation
  - Follow Node-RED UI conventions
  - Provide clear, helpful configuration options
  - Include comprehensive help text with examples

## Coding Standards

### JavaScript Style

- Use ES6+ features where appropriate
- Follow the ESLint configuration (`.eslintrc.json`)
- Use double quotes for strings
- Use 4 spaces for indentation
- Add JSDoc comments for functions and classes

### Example Code Style

```javascript
/**
 * Example function with proper documentation
 * @param {string} param1 - Description of param1
 * @param {number} param2 - Description of param2
 * @returns {Object} Description of return value
 */
function exampleFunction(param1, param2) {
    // Implementation
    return { result: true };
}
```

## Commit Messages

Follow conventional commit format:

- `feat: add new feature`
- `fix: resolve bug in feature`
- `docs: update documentation`
- `test: add or update tests`
- `refactor: code refactoring`
- `chore: maintenance tasks`

Example:
```
feat: add Modbus TCP support for ES series inverters

- Implement Modbus TCP protocol handler
- Add ES series register mapping
- Include unit tests for new functionality
```

## Pull Request Process

1. Ensure all tests pass and linting is clean
2. Update documentation if needed
3. Add an entry to the changelog (if applicable)
4. Submit the pull request with a clear description
5. Link any related issues
6. Wait for review and address feedback

### PR Checklist

- [ ] Tests added/updated and passing
- [ ] Linting passes (`npm run lint`)
- [ ] Code coverage maintained or improved
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts

## Testing Guidelines

### Writing Tests

- Use descriptive test names: `it("should connect to inverter via UDP", ...)`
- Test both success and error cases
- Mock external dependencies (network calls, etc.)
- Keep tests focused and independent
- Use the Node-RED test helper for node testing

### Test Structure

```javascript
describe("feature name", function () {
    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    it("should do something specific", function (done) {
        // Test implementation
    });
});
```

## Documentation

When contributing, please update:

- **README.md**: For user-facing changes
- **CONTRIBUTING.md**: For developer workflow changes
- **Code comments**: For complex logic
- **Help text in goodwe.html**: For node configuration changes

## Getting Help

- Open an issue for questions or discussions
- Join the Node-RED community forums
- Reference the [Node-RED documentation](https://nodered.org/docs/)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help create a welcoming environment for all contributors

Thank you for contributing to node-red-contrib-goodwe!
