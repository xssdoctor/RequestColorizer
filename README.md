# Caido Request Colorizer

A powerful Caido plugin that automatically colors HTTP requests based on patterns, making it easy to visually identify and group similar requests in your proxy history.

## 🎨 Features

- **Automatic Pattern Matching**: Colors requests based on method, host, and path patterns
- **Retroactive Coloring**: When you set a color rule, it automatically colors all existing matching requests
- **Real-time Coloring**: New requests that match existing patterns are automatically colored as they come in
- **Flexible Matching**: Uses "contains" matching for maximum flexibility (e.g., `/api/users` will match `/api/users/123`)
- **7 Color Options**: Choose from Red, Orange, Yellow, Green, Blue, Purple, and Grey
- **Persistent Rules**: Color rules are saved and persist across Caido sessions

## 📋 Requirements

- **Caido** (latest version recommended)
- **Caido Plugin System** enabled

## 🚀 Installation

### Method 1: Manual Installation

1. **Download the Plugin**

   ```bash
   git clone https://github.com/xssdoctor/caido-colorizer.git
   cd caido-colorizer
   ```

2. **Build the Plugin**

   ```bash
   npm install
   npm run build
   ```

3. **Install in Caido**
   - Open Caido
   - Go to **Settings** → **Plugins**
   - Click **Install Plugin**
   - Select the generated `dist/plugin_package.zip` file

### Method 2: Direct Download

1. Download the latest release from the [Releases](https://github.com/xssdoctor/caido-colorizer/releases) page
2. In Caido, go to **Settings** → **Plugins** → **Install Plugin**
3. Select the downloaded `.zip` file

## 🎯 Usage

### Setting Up Color Rules

1. **Right-click any request** in your proxy history
2. Select **"Color similar requests..."** from the context menu
3. **Choose a color** from the popup dialog
4. The plugin will:
   - Color the selected request immediately
   - Find and color all existing requests with the same pattern
   - Automatically color future requests that match the pattern

### Pattern Matching

The plugin matches requests based on:

- **Method**: GET, POST, PUT, DELETE, etc.
- **Host**: Domain name (e.g., `api.example.com`)
- **Path**: URL path (e.g., `/api/users`)

**Example**: If you color a `POST api.example.com/api/users` request:

- ✅ `POST api.example.com/api/users/123` (matches)
- ✅ `POST api.example.com/api/users?page=2` (matches)
- ✅ `POST subdomain.api.example.com/api/users` (matches - contains matching)
- ❌ `GET api.example.com/api/users` (different method)
- ❌ `POST other.com/api/users` (different host)

### Managing Colors

- **Multiple Rules**: You can create multiple color rules for different patterns
- **Persistent**: Rules are automatically saved and restored when you restart Caido
- **Override**: If a request matches multiple rules, the first matching rule is applied

## 🛠️ Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/xssdoctor/caido-colorizer.git
cd caido-colorizer

# Install dependencies
npm install

# Build the plugin
npm run build

# The built plugin will be in dist/plugin_package.zip
```

### Project Structure

```
caido-colorizer/
├── packages/
│   ├── backend/          # Backend logic (pattern matching, database)
│   ├── frontend/         # Frontend UI (color picker, GraphQL calls)
├── manifest.json         # Plugin metadata
└── caido.config.ts      # Build configuration
```

## 🔧 Technical Details

- **Backend**: Node.js/TypeScript with SQLite for rule storage
- **Frontend**: TypeScript with Caido SDK for UI integration
- **Pattern Matching**: Uses HTTPQL for efficient request querying
- **Coloring**: Direct GraphQL mutations to Caido's request metadata

## 🐛 Troubleshooting

### Plugin Not Loading

- Ensure you have the latest version of Caido
- Check that the plugin system is enabled in Caido settings
- Verify the plugin file is not corrupted

### Colors Not Applying

- Check the browser console for any error messages
- Ensure the requests are in scope (not filtered out)
- Try restarting Caido and reinstalling the plugin

### Performance Issues

- The plugin is optimized for large request histories
- If you have tens of thousands of requests, initial coloring may take a moment

## 📝 Changelog

### v0.0.2

- Improved pattern matching with "contains" logic
- Added support for unlimited request matching
- Removed debugging noise for cleaner operation
- Enhanced performance for large request histories

### v0.0.1

- Initial release
- Basic pattern matching and coloring functionality

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**xssdoctor**

- Email: xssdoctors@gmail.com
- GitHub: [@xssdoctor](https://github.com/xssdoctor)

## ⭐ Support

If you find this plugin useful, please consider giving it a star on GitHub! It helps others discover the project.

---

**Made with ❤️ for the Caido community**
