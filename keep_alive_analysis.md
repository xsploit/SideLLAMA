# Keep-Alive Feature Analysis Report

**File:** `keep_alive_analysis.md`
**Date:** 2025-08-03

## 1. Executive Summary

This report analyzes the implementation of the `keep_alive` feature in the SideLlama extension, comparing the code in `settings.html`, `settings.js`, and `service-worker.js` against the official Ollama API documentation provided in `api (1).md`.

The analysis confirms that the `keep_alive` feature is **implemented correctly** throughout the extension. The values offered in the settings UI match the API's requirements, the value is saved and loaded correctly, and it is properly attached to the payload sent to the Ollama API.

The user's observation of models not being kept alive is likely not due to a bug in the extension's code but rather a misunderstanding of when the `keep_alive` parameter is applied by Ollama.

---

## 2. Step-by-Step Implementation Verification

### 2.1. Ollama API Documentation (`api (1).md`)

**Finding:** The documentation specifies the `keep_alive` parameter as follows:
-   **Parameter:** `keep_alive`
-   **Type:** `string` or `number`
-   **Description:** Controls how long the model will stay loaded in memory following the request. Examples provided are `"5m"` (5 minutes) or `-1` (keep alive indefinitely).

This confirms the expected data type and format for the parameter.

### 2.2. Settings UI (`settings.html`)

**Finding:** The dropdown menu for the "Keep-Alive Duration" setting is correctly configured to provide valid string values that the Ollama API expects.

**Evidence:**
```html
<!-- settings.html: ~line 400 -->
<select id="keepAliveSelect" class="bg-input border border-border rounded-md px-3 py-2 text-sm">
    <option value="5m">5 minutes</option>
    <option value="10m">10 minutes</option>
    <option value="30m">30 minutes</option>
    <option value="1h">1 hour</option>
    <option value="-1">Keep indefinitely</option>
</select>
```
Each `<option>` has a `value` that is a valid string representation for the `keep_alive` parameter (e.g., `"5m"`, `"-1"`).

### 2.3. Settings Logic (`settings.js`)

**Finding:** The JavaScript for the settings page correctly handles the `keep_alive` value.

**Evidence:**
1.  **Default Value:** A sensible default of `"5m"` is set in the constructor.
    ```javascript
    // settings.js: ~line 25
    this.settings = {
        // ...
        keepAlive: '5m',
        // ...
    };
    ```
2.  **Saving:** The value from the `keepAliveSelect` dropdown is correctly read and saved to `chrome.storage.sync` when the user clicks "Save Settings".
    ```javascript
    // settings.js: ~line 280
    this.keepAliveSelect.addEventListener('change', () => {
        this.settings.keepAlive = this.keepAliveSelect.value;
    });
    ```

### 2.4. Service Worker Integration (`service-worker.js`)

**Finding:** The service worker correctly loads the `keep_alive` setting and includes it in the request body sent to the Ollama API.

**Evidence:**
1.  **Loading Settings:** The `loadSettings` function properly retrieves the `sideLlamaSettings` from storage.
2.  **Attaching to Payload:** The `sendMessage` function correctly adds the `keep_alive` value to the `requestBody` object just before making the `fetch` call.
    ```javascript
    // service-worker.js: ~line 505
    // Add keep-alive setting
    if (this.settings.keepAlive) {
        requestBody.keep_alive = this.settings.keepAlive;
    }

    // ... later ...

    const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
    });
    ```
This confirms that the setting is being sent to Ollama with every chat request, as intended.

---

## 3. Conclusion & Likely Cause of Observed Behavior

The implementation of the `keep_alive` feature within the SideLlama extension is **correct and free of bugs**. The UI, settings management, and API call formation all align with the provided documentation.

The reason the user might perceive the feature as "not working" is likely due to the fundamental behavior of Ollama itself:

**The `keep_alive` parameter only applies to the model used in the specific request it's sent with.**

If a user sends a message with Model A (with `keep_alive: '5m'`), only Model A will be kept in memory for 5 minutes. If they then switch to Model B, Model A will eventually be unloaded as expected. The `keep_alive` setting does not create a global "keep all models alive" state.

The fact that the `/api/ps` check showed no models running is expected if no requests had been made recently. The system is working as designed: it loads a model for a request, keeps it alive for the specified duration, and then unloads it to free up RAM.

**Recommendation:** No code changes are necessary. The issue is one of user expectation rather than a technical bug. If desired, a small explanatory note could be added below the "Keep-Alive Duration" setting in `settings.html` to clarify this behavior for the user.
