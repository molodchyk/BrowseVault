# App Shell

Owns extension-page bootstrap composition and shared shell behavior. `src/app.js` should stay a thin runtime entrypoint that delegates here.

This feature should contain shell state, element collection, navigation/focus helpers, shared search scheduling, and UI wiring that are not specific to one product feature. Product-specific rendering and pure logic should stay in narrower feature folders.
