# Online avatars

The game reuses `luigi-laekkermat-cutout.webp`. The original Dennis and Captain
artwork remains unchanged. New sprites were made with the built-in imagegen tool.
The Captain is a background extraction; Dennis is a new transparent sprite of
the existing character design after the extraction attempts failed alpha checks.

## Kaptajn Kvadratrod

- Input: `kaptajn-kvadratrod.webp`
- Game asset: `kaptajn-avatar.png`
- Prompt:

Use case: background-extraction. Asset type: transparent game avatar sprite for an existing school mathematics game. Input image 1 is the edit target, Kaptajn Kvadratrod. Remove only the illustrated blue/cream smoky background and background lightning, preserving the original superhero character, square-root chest emblem, red mask and cape, blue suit, compass in his right hand, calculator in his left hand, recognizable face and comic illustration style. Output one complete isolated full-body character with genuine transparent alpha background, no floor or cast shadow, no border, no text added, no checkerboard. Extend framing just enough to include both boots entirely, keeping the pose and character design. Preserve the red cape as part of the character. Center the full figure with small transparent margins. PNG with alpha.

## Divisions-Dennis

- Input: `divisions-dennis.webp`
- Game asset: `dennis-avatar.png`
- Prompt:

Use case: background-extraction. Asset type: transparent game avatar sprite. Edit target: the provided Divisions-Dennis illustration. Remove ONLY the solid black background outside the character, including the black regions between arms/lollipops and body. Keep the complete original penguin character identical: navy blue beret, cream belly and face, black/very dark penguin body and wings, orange beak and feet, green lollipop bearing number 7 and red lollipop bearing number 9. Preserve original style, pose, shape, proportions, colours and all character details. The black feathers are part of the penguin and MUST remain opaque. Genuine transparent alpha background, no black rectangle, no floor, no shadow, no glow, no checkerboard. Full body centered with both feet and both lollipops visible, small transparent margins. Output PNG with alpha.

The first output contained a baked-in checkerboard and was rejected after checking
the actual alpha channel. This correction also failed the alpha check:

BACKGROUND EXTRACTION ONLY. This image accidentally has a baked-in white and grey checkerboard, with NO alpha channel. Remove the checkerboard entirely and return a PNG with a REAL TRANSPARENT ALPHA CHANNEL (fully transparent pixels outside the character). Do not paint or draw a transparency pattern. No white, grey, black or colored background. Keep the penguin with its black feathers, navy beret, orange feet and beak, green 7 lollipop and red 9 lollipop exactly unchanged. Preserve all subject pixels and the existing full-body framing. The resulting game sprite must composite on any background without a rectangle. Genuine transparent background.

Final generation prompt:

Create a transparent-background game sprite, PNG with actual alpha transparency. One full-body cartoon penguin called Divisions-Dennis, centered, upright. He has black feathers, a cream white face and round cream belly, a dark navy blue French beret, an orange long beak and orange webbed feet. His left wing (on image left) is raised, holding a thin dark stick with a round turquoise-green lollipop, with a large bold black number '7'. His other wing, on image right, holds a round orange-red lollipop on a thin dark stick with a large bold black number '9'. Friendly slightly mischievous expression, large expressive eyes, polished illustrated children's mathematics game character with black outlines, subtle soft shaded volume, dark blue highlights in the feathers. Entire penguin and both lollipops in frame. Isolated cutout, no scene, no shadow, no background pattern, no checkerboard. Actual transparent pixels all around the character. Transparent background.
