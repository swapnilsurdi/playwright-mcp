# Clipboard Permissions Example

This example demonstrates how to use the new `--permissions` feature to enable clipboard operations without user permission prompts.

## Usage

### Via Command Line Arguments

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@playwright/mcp@latest",
        "--permissions", "clipboard-read,clipboard-write"
      ]
    }
  }
}
```

### Via Configuration File

Create a config file `playwright-mcp-config.json`:

```json
{
  "browser": {
    "permissions": ["clipboard-read", "clipboard-write"]
  }
}
```

Then use it:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx", 
      "args": [
        "@playwright/mcp@latest",
        "--config", "playwright-mcp-config.json"
      ]
    }
  }
}
```

### Via Environment Variable

```bash
export PLAYWRIGHT_MCP_PERMISSIONS="clipboard-read,clipboard-write"
```

## Clipboard Operations

Once permissions are granted, you can use clipboard APIs via `browser_evaluate`:

```javascript
// Write to clipboard (no permission prompt)
await browser_evaluate({ 
  function: "() => navigator.clipboard.writeText('Copy this!')"
})

// Read from clipboard (no permission prompt)  
await browser_evaluate({ 
  function: "() => navigator.clipboard.readText()"
})
```

## Supported Permissions

You can grant multiple permissions as a comma-separated list:

- `clipboard-read`
- `clipboard-write` 
- `geolocation`
- `camera`
- `microphone`
- `notifications`
- And any other [Web API permissions](https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API)

Example with multiple permissions:

```bash
--permissions "clipboard-read,clipboard-write,geolocation,notifications"
```

## Notes

- Permissions are applied when the browser context is created
- The clipboard API requires secure contexts (HTTPS) in production environments
- Some permissions may not be supported in all browsers or may require additional user activation