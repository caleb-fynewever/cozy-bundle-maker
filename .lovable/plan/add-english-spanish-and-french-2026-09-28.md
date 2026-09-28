# Add English, Spanish, and French

## What will change
- Add a **Language** control in Settings with English, Español, and Français.
- Change the app immediately when a language is selected and remember the choice for that signed-in account on the device.
- Translate every built-in screen: sign-in and setup, navigation, Feed, Quests, quest planning and completion, Squads, Ranks, Map, profiles, Settings, help, empty states, dialogs, notifications, validation, and error pages.
- Translate bundled demo content and quest labels where it is part of the app experience.
- Keep names, handles, squad names, comments, captions, bios, and user-created quests exactly as their authors wrote them.
- Format dates, times, and counts using the selected language where the browser supports it.

## Implementation
- Add a small typed localization layer with English as the fallback and interpolation/plural support.
- Store the selected locale in the existing account-scoped user state, defaulting new and existing accounts to English.
- Set the document language to `en`, `es`, or `fr` as the preference changes.
- Replace hard-coded interface copy route by route with shared translation keys, keeping the existing design and behavior unchanged.
- Add focused tests for language persistence, fallback text, interpolation, and pluralized labels.

## Validation
- Check all three languages on phone and desktop widths, including long French and Spanish labels.
- Verify sign-in, setup, quest planning, squad invites, profile settings, Feed, and Ranks remain usable.
- Check for untranslated built-in English strings, layout overflow, console errors, and build errors.
