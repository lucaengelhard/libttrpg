# lib5e

## Planned API

```ts
import { createLibrary } from "@lucaengelhard/lib5e";

// ... import and parse JSON beforehand!

const { createCharacter, library } = createLibrary(imported_data);

const character = createCharacter().name("Vaas").addClass("Ranger");
```
